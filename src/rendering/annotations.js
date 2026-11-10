import Cairo from 'cairo';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';

import {pixelBlocks} from './pixels.js';

const pixelSources = new WeakMap();

export function textFont(width) {
    const font = Pango.FontDescription.from_string('Sans');
    font.set_absolute_size(Math.max(14, (width || 3) * 5) * Pango.SCALE);
    return font;
}

export function measureText(text, width) {
    const context = PangoCairo.FontMap.get_default().create_context();
    const layout = Pango.Layout.new(context);
    layout.set_font_description(textFont(width));
    layout.set_text(text ?? '', -1);
    const [w, h] = layout.get_pixel_size();
    return {width: Math.max(1, w), height: Math.max(1, h)};
}

export function annotationBounds(a) {
    return {x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
        width: Math.abs(a.x2 - a.x1), height: Math.abs(a.y2 - a.y1)};
}

function setColor(cr, color, alpha = 1) {
    let hex = (color ?? '#ff0000').replace('#', '');
    if (hex.length === 3)
        hex = [...hex].map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(hex))
        hex = 'ff0000';
    cr.setSourceRGBA(parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255, alpha);
}

// Sample the original frozen screenshot, never previously drawn annotations.
function pixelate(cr, a, pixbuf, scale) {
    if (!pixbuf)
        return;
    const b = annotationBounds(a);
    let source = pixelSources.get(pixbuf);
    if (!source) {
        source = {pixels: pixbuf.read_pixel_bytes().get_data(), cache: new Map()};
        pixelSources.set(pixbuf, source);
    }
    const pixels = source.pixels;
    const stride = pixbuf.get_rowstride();
    const channels = pixbuf.get_n_channels();
    const pw = pixbuf.get_width();
    const ph = pixbuf.get_height();
    const block = Math.max(8, (a.width || 3) * 4);
    const left = Math.max(0, b.x), top = Math.max(0, b.y);
    const right = Math.min(pw / scale, b.x + b.width);
    const bottom = Math.min(ph / scale, b.y + b.height);
    const key = [left, top, right, bottom, block, scale].join(',');
    let blocks = source.cache.get(key);
    if (!blocks) {
        blocks = pixelBlocks({pixels, stride, channels, width: pw, height: ph, scale}, b, block);
        if (source.cache.size >= 4)
            source.cache.delete(source.cache.keys().next().value);
        source.cache.set(key, blocks);
    }
    cr.save();
    cr.rectangle(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
    cr.clip();
    cr.setAntialias(Cairo.Antialias.NONE);
    for (const [x, y, w, h, r, g, blue] of blocks) {
        cr.setSourceRGB(r, g, blue);
        cr.rectangle(x, y, w, h);
        cr.fill();
    }
    cr.restore();
}

export function renderAnnotations(cr, annotations, {pixbuf = null, scale = 1} = {}) {
    for (const a of annotations) {
        const b = annotationBounds(a);
        const width = Math.max(1, a.width || 3);
        cr.save();
        cr.setLineWidth(width);
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        setColor(cr, a.color, a.type === 'highlighter' ? 0.35 : 1);
        switch (a.type) {
        case 'arrow': {
            const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
            const head = Math.max(12, width * 4);
            cr.moveTo(a.x1, a.y1); cr.lineTo(a.x2, a.y2);
            cr.moveTo(a.x2 - head * Math.cos(angle - Math.PI / 6),
                a.y2 - head * Math.sin(angle - Math.PI / 6));
            cr.lineTo(a.x2, a.y2);
            cr.lineTo(a.x2 - head * Math.cos(angle + Math.PI / 6),
                a.y2 - head * Math.sin(angle + Math.PI / 6));
            cr.stroke();
            break;
        }
        case 'rectangle':
            cr.rectangle(b.x, b.y, b.width, b.height); cr.stroke();
            break;
        case 'circle':
            if (b.width && b.height) {
                cr.save();
                cr.translate(b.x + b.width / 2, b.y + b.height / 2);
                cr.scale(b.width / 2, b.height / 2);
                cr.arc(0, 0, 1, 0, 2 * Math.PI);
                cr.restore();
                cr.stroke();
            }
            break;
        case 'highlighter':
            cr.rectangle(b.x, b.y, b.width, b.height); cr.fill();
            break;
        case 'pixelate':
            pixelate(cr, a, pixbuf, scale);
            break;
        case 'text': {
            const layout = PangoCairo.create_layout(cr);
            layout.set_font_description(textFont(width));
            layout.set_text(a.text ?? '', -1);
            cr.moveTo(a.x1, a.y1);
            PangoCairo.show_layout(cr, layout);
            break;
        }
        }
        cr.restore();
    }
}
