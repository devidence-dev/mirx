import {markerRadius} from '../core/geometry.js';

/** Geometry is in logical stage pixels. */
export function rectangleGeometry(a) {
    const width = Math.max(1, a.width || 3);
    const x = Math.min(a.x1, a.x2), y = Math.min(a.y1, a.y2);
    const w = Math.abs(a.x2 - a.x1), h = Math.abs(a.y2 - a.y1);
    if (a.type === 'highlighter')
        return {x, y, width: w, height: h};
    return {x: x - width / 2, y: y - width / 2,
        width: w + width, height: h + width};
}

export function arrowBars(a) {
    const width = Math.max(1, a.width || 3);
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const head = Math.max(12, width * 4);
    const bar = (x1, y1, x2, y2) => {
        const length = Math.hypot(x2 - x1, y2 - y1);
        const total = length + width;
        return {x: x1 - width / 2, y: y1 - width / 2,
            width: total, height: width, pivotX: width / (2 * total), pivotY: 0.5,
            angle: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI};
    };
    return [bar(a.x1, a.y1, a.x2, a.y2),
        ...[-1, 1].map(sign => bar(a.x2, a.y2,
            a.x2 - head * Math.cos(angle + sign * Math.PI / 6),
            a.y2 - head * Math.sin(angle + sign * Math.PI / 6)))];
}

// Box around the tail, the tip and both head-bar ends. The pad of width / sqrt(2) holds the corners of the
// rotated bars, which lie further out than the half width the rounded stroke itself needs.
export function arrowBounds(a) {
    const width = Math.max(1, a.width || 3);
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const head = Math.max(12, width * 4);
    const points = [[a.x1, a.y1], [a.x2, a.y2],
        ...[-1, 1].map(sign => [a.x2 - head * Math.cos(angle + sign * Math.PI / 6),
            a.y2 - head * Math.sin(angle + sign * Math.PI / 6)])];
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const pad = width * Math.SQRT1_2;
    const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    return {x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y};
}

// Gradient direction in actor pixels: tail to tip for arrows, else the normalized box diagonal.
export function gradientAxis(a, size) {
    if (a.type !== 'arrow')
        return {start: [0, 0], end: [size.width, size.height]};
    const {x, y} = arrowBounds(a);
    return {start: [a.x1 - x, a.y1 - y], end: [a.x2 - x, a.y2 - y]};
}

export function pixelateGeometry(a, selection, stage) {
    const x = Math.min(a.x1, a.x2), y = Math.min(a.y1, a.y2);
    const left = Math.max(x, selection?.x ?? 0, 0);
    const top = Math.max(y, selection?.y ?? 0, 0);
    const right = Math.min(Math.max(a.x1, a.x2),
        selection ? selection.x + selection.width : 0, stage.width);
    const bottom = Math.min(Math.max(a.y1, a.y2),
        selection ? selection.y + selection.height : 0, stage.height);
    return {rect: {x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top)},
        anchor: [left - x, top - y], block: Math.max(8, (a.width || 3) * 4)};
}

// GNOME 50.1 enlarges the local paint volume before allocating the offscreen
// texture (clutter-actor-box.c:474). Recover its origin from the actual texture,
// not width * screenshot scale: Actor.get_resource_scale() is rounded up.
export function effectTextureUniforms(rect, textureSize, resourceScale) {
    return {textureSize,
        contentOffset: [textureSize[0] - Math.ceil(rect.width + 0.75) * resourceScale,
            textureSize[1] - Math.ceil(rect.height + 0.75) * resourceScale],
        extent: [rect.width * resourceScale, rect.height * resourceScale]};
}

export function ellipseUniforms(a, resourceScale, physicalScale, fill = 0) {
    return {radii: [Math.abs(a.x2 - a.x1) * resourceScale / 2,
        Math.abs(a.y2 - a.y1) * resourceScale / 2],
        stroke: [Math.max(1, a.width || 3) * resourceScale],
        antialias: [resourceScale / physicalScale],
        fill: [fill]};
}

// Digit count to label size, as a fraction of the marker radius.
export function markerLabel(radius, digits) {
    const factor = [1.1, 0.95, 0.7, 0.5][Math.max(1, Math.min(digits, 4)) - 1];
    return {fontSize: radius * factor};
}

// Hex colour to 0..255 channels; 3-digit hex repeats each digit.
function parseHex(hex) {
    let digits = hex.replace('#', '');
    if (digits.length === 3)
        digits = [...digits].map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16));
}

// White text everywhere (the number carries a soft shadow), black only on White and near-white; a deliberate trade-off over WCAG ratios.
export function contrastColor(hex) {
    const [r, g, b] = parseHex(hex);
    return (299 * r + 587 * g + 114 * b) / 1000 >= 230 ? '#000000' : '#ffffff';
}

// rotate towards pink/violet: warm hues go back, cool hues go forward
const WARM_ROTATION = -45;
const COOL_ROTATION = 50;
const START_LIGHTNESS_BOOST = 0.04;
// Both ends are lifted to a vivid pastel so the sweep stays visible on dark content.
const MIN_LIGHTNESS = 0.62;
// Purples would end in the same hot pink as red; start them bluer and stop at magenta instead.
const PURPLE_START_SHIFT = -12;
const PURPLE_ROTATION = 28;

function rgbToHsl([r, g, b]) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    if (d === 0)
        return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}

function hslToRgb([h, s, l]) {
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
}

// Start and end of the hue sweep as 0..1 RGB; greys keep both ends equal to the colour.
export function gradientShades(hex) {
    const color = parseHex(hex).map(v => v / 255);
    const [h, s, l] = rgbToHsl(color);
    if (s === 0)
        return {from: color, to: color};
    const lift = Math.max(l, MIN_LIGHTNESS);
    if (h >= 250 && h < 300)
        return {from: hslToRgb([h + PURPLE_START_SHIFT, s, lift]), to: hslToRgb([h + PURPLE_ROTATION, s, lift])};
    const rotation = h < 90 || h >= 300 ? WARM_ROTATION : COOL_ROTATION;
    return {from: hslToRgb([h, s, Math.min(1, lift + START_LIGHTNESS_BOOST)]),
        to: hslToRgb([(h + rotation + 360) % 360, s, lift])};
}

// Flat annotations send only the flag, so their other uniforms are unchanged.
export function gradientUniforms(a, size, shades, resourceScale) {
    if (!a.gradient)
        return {gradient: [0]};
    const {start, end} = gradientAxis(a, size);
    return {gradient: [1], gradStart: start.map(v => v * resourceScale), gradEnd: end.map(v => v * resourceScale),
        gradFrom: shades.from, gradTo: shades.to};
}

// Filled disc: the square is padded by one logical pixel for the antialiasing fringe.
export function markerDisc(a, resourceScale, physicalScale) {
    const r = markerRadius(a.width);
    const cx = a.x1, cy = a.y1;
    return {rect: {x: cx - r - 1, y: cy - r - 1, width: 2 * r + 2, height: 2 * r + 2},
        uniforms: ellipseUniforms({x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r, width: 1},
            resourceScale, physicalScale, 1)};
}

export function pixelateUniforms(geometry, resourceScale) {
    return {anchor: geometry.anchor.map(value => value * resourceScale),
        block: [geometry.block * resourceScale]};
}
