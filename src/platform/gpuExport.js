import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';

import {ImageOutput} from './imageOutput.js';
import {alignedPaintRect, physicalRect} from '../core/geometry.js';
import {annotationBounds} from '../rendering/annotations.js';

function privateDirectory() {
    const path = GLib.build_filenamev([GLib.get_user_cache_dir(), 'mirx-spike']);
    if (GLib.mkdir_with_parents(path, 0o700) !== 0)
        throw new Error('Could not create spike diagnostics directory');
    const dir = Gio.File.new_for_path(path);
    dir.set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
    return dir;
}

function writePrivate(dir, name, writer) {
    const file = dir.get_child(name);
    const stream = file.replace(null, false, Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    try { writer(stream); } finally { stream.close(null); }
    file.set_attribute_uint32('unix::mode', 0o600, Gio.FileQueryInfoFlags.NONE, null);
}

function savePng(dir, name, pixbuf) {
    writePrivate(dir, name, stream => pixbuf.save_to_streamv(stream, 'png', [], [], null));
}

// Bounds intentionally err on the side of including arrowheads and antialiasing.
function annotationRegions(annotations, selection, scale) {
    return annotations.map(a => {
        const b = annotationBounds(a);
        const margin = Math.max(12, (a.width || 3) * 4) + (a.width || 3) + 2;
        return {left: (b.x - margin - selection.x) * scale,
            top: (b.y - margin - selection.y) * scale,
            right: (b.x + b.width + margin - selection.x) * scale,
            bottom: (b.y + b.height + margin - selection.y) * scale};
    });
}

function comparePixels(cairo, gpu, selection, annotations, scale) {
    const width = cairo.get_width(), height = cairo.get_height();
    if (width !== gpu.get_width() || height !== gpu.get_height())
        throw new Error(`GPU export dimensions ${gpu.get_width()}x${gpu.get_height()} differ from Cairo ${width}x${height}`);
    const cp = cairo.read_pixel_bytes().get_data(), gp = gpu.read_pixel_bytes().get_data();
    const ds = width * 3;
    const dp = new Uint8Array(ds * height);
    const cs = cairo.get_rowstride(), gs = gpu.get_rowstride();
    const cc = cairo.get_n_channels(), gc = gpu.get_n_channels();
    const regions = annotationRegions(annotations, selection, scale);
    const stats = {inside: {count: 0, max: 0}, outside: {count: 0, max: 0, overTolerance: 0}, spans: []};
    for (let y = 0; y < height; y++) {
        let span = null;
        for (let x = 0; x < width; x++) {
            let max = 0;
            for (let c = 0; c < 3; c++) {
                const delta = Math.abs(cp[y * cs + x * cc + c] - gp[y * gs + x * gc + c]);
                dp[y * ds + x * 3 + c] = delta;
                max = Math.max(max, delta);
            }
            const inside = regions.some(r => x >= r.left && x < r.right && y >= r.top && y < r.bottom);
            if (max) {
                const region = inside ? 'inside' : 'outside';
                const s = stats[region];
                s.count++; s.max = Math.max(s.max, max);
                if (!inside && max > 1) s.overTolerance++;
                if (span && span.region === region && span.xEnd === x - 1) {
                    span.xEnd = x; span.max = Math.max(span.max, max);
                } else {
                    span = {y, xStart: x, xEnd: x, region, max};
                    stats.spans.push(span);
                }
            } else span = null;
        }
    }
    const diff = GdkPixbuf.Pixbuf.new_from_bytes(GLib.Bytes.new(dp),
        GdkPixbuf.Colorspace.RGB, false, 8, width, height, ds);
    return {diff, stats};
}

// The sparse full-size pixbuf preserves the renderer's global pixel coordinates.
// Each update replaces it so the annotation renderer's WeakMap cannot retain stale bytes.
const pixelationStates = new WeakMap();

export function ensurePixelationPixels(snapshot, annotations) {
    let state = pixelationStates.get(snapshot);
    if (!state) {
        state = {tiles: new Set(), pending: Promise.resolve()};
        pixelationStates.set(snapshot, state);
    }
    const work = state.pending.then(async () => {
        const texture = snapshot.content.get_texture();
        const width = texture.get_width(), height = texture.get_height();
        const scale = snapshot.scale ?? 1;
        // Never encode the entire texture in one tile, including on small stages.
        const tileWidth = Math.min(512, width > 1 ? Math.ceil(width / 2) : 1);
        const tileHeight = Math.min(512, height);
        const needed = new Map();
        for (const annotation of annotations) {
            if (annotation.type !== 'pixelate') continue;
            const bounds = annotationBounds(annotation);
            const x1 = Math.max(0, Math.floor(bounds.x * scale));
            const y1 = Math.max(0, Math.floor(bounds.y * scale));
            const x2 = Math.min(width, Math.ceil((bounds.x + bounds.width) * scale));
            const y2 = Math.min(height, Math.ceil((bounds.y + bounds.height) * scale));
            for (let y = Math.floor(y1 / tileHeight) * tileHeight; y < y2; y += tileHeight) {
                for (let x = Math.floor(x1 / tileWidth) * tileWidth; x < x2; x += tileWidth) {
                    const key = `${x},${y}`;
                    if (!state.tiles.has(key)) needed.set(key, {x, y});
                }
            }
        }
        if (!needed.size) return snapshot.pixelationPixbuf ?? null;
        const result = snapshot.pixelationPixbuf?.copy() ??
            GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, true, 8, width, height);
        if (!snapshot.pixelationPixbuf) result.fill(0);
        // Publish only after all tiles succeed, so failures can be retried safely.
        for (const {x, y} of needed.values()) {
            const w = Math.min(tileWidth, width - x), h = Math.min(tileHeight, height - y);
            const stream = Gio.MemoryOutputStream.new_resizable();
            let tile;
            try {
                tile = await new Promise((resolve, reject) => {
                    Shell.Screenshot.composite_to_stream(texture, x, y, w, h, 1, null, 0, 0, 1, stream,
                        (_source, asyncResult) => {
                            try { resolve(Shell.Screenshot.composite_to_stream_finish(asyncResult)); }
                            catch (error) { reject(error); }
                        });
                });
            } finally { stream.close(null); }
            tile.copy_area(0, 0, w, h, result, x, y);
        }
        for (const key of needed.keys()) state.tiles.add(key);
        snapshot.pixelationPixbuf = result;
        return result;
    });
    state.pending = work.catch(() => {});
    return work;
}

export class GpuImageOutput extends ImageOutput {
    constructor({notify, engine = () => 'cairo'} = {}) {
        super({notify});
        this._engine = engine;
    }

    copy(snapshot, selection, annotations, monitor, operation = {}) {
        return ImageOutput.prototype.copy.call(this._delegate(operation), snapshot, selection, annotations, monitor, operation);
    }

    save(snapshot, selection, annotations, monitor, settings, operation = {}) {
        return ImageOutput.prototype.save.call(this._delegate(operation), snapshot, selection, annotations, monitor, settings, operation);
    }

    _delegate(operation) {
        const delegate = Object.create(this);
        const engine = operation.engine ?? this._engine();
        delegate.render = (snapshot, selection, annotations, monitor) =>
            this._renderForEngine(engine, operation, snapshot, selection, annotations, monitor);
        return delegate;
    }

    async _renderForEngine(engine, operation, snapshot, selection, annotations, monitor) {
        if (engine === 'cairo')
            return super.render(snapshot, selection, annotations, monitor);
        if (engine !== 'gpu' && engine !== 'compare')
            throw new Error(`Unknown export engine: ${engine}`);
        const scale = monitor?.scale ?? monitor?.scaleFactor ?? snapshot.scale ?? 1;
        const physical = physicalRect(selection, scale);
        const width = physical.width, height = physical.height;
        if (width <= 0 || height <= 0)
            throw new Error('The selection is empty');
        let cairo, cairoMs;
        if (engine === 'compare') {
            const start = GLib.get_monotonic_time();
            cairo = await super.render(snapshot, selection, annotations, monitor);
            cairoMs = (GLib.get_monotonic_time() - start) / 1000;
            console.log(`mirx-spike engine=cairo ms=${cairoMs}`);
        }
        const start = GLib.get_monotonic_time();
        if (typeof global.stage?.paint_to_content !== 'function' || typeof operation.withExportContent !== 'function')
            throw new Error('GPU export requires Clutter.Stage.paint_to_content and an active overlay');
        // GNOME 50 Clutter-18.gir:20685: rect, scale, nullable color_state, flags.
        // Mtk-18.gir:86 declares Rectangle.new; Clutter-18.gir:18641 declares NO_CURSORS.
        // An aligned rectangle makes the stage render 1:1 on the physical grid; the texture is cropped below.
        const aligned = alignedPaintRect(physical, scale);
        const paint = aligned?.rect ?? selection;
        const content = operation.withExportContent(() => global.stage.paint_to_content(
            Mtk.Rectangle.new(paint.x, paint.y, paint.width, paint.height),
            scale, null, Clutter.PaintFlag.NO_CURSORS));
        const texture = content?.get_texture();
        if (!texture)
            throw new Error('Clutter.Stage.paint_to_content did not return a usable texture');
        const stream = Gio.MemoryOutputStream.new_resizable();
        let gpu;
        try {
            // Shell-18.gir:1698,1744: composite only the already cropped texture.
            gpu = await new Promise((resolve, reject) => {
                Shell.Screenshot.composite_to_stream(texture, aligned?.offsetX ?? 0, aligned?.offsetY ?? 0,
                    aligned ? width : -1, aligned ? height : -1, 1, null, 0, 0, 1, stream,
                    (_source, result) => {
                        try { resolve(Shell.Screenshot.composite_to_stream_finish(result)); }
                        catch (error) { reject(error); }
                    });
            });
        } finally { stream.close(null); }
        const gpuMs = (GLib.get_monotonic_time() - start) / 1000;
        console.log(`mirx-spike engine=gpu ms=${gpuMs}`);
        if (gpu.get_width() !== width || gpu.get_height() !== height)
            throw new Error(`GPU export dimensions ${gpu.get_width()}x${gpu.get_height()} differ from expected ${width}x${height}`);
        if (engine === 'gpu') return gpu;
        const dir = privateDirectory();
        const {diff, stats} = comparePixels(cairo, gpu, selection, annotations, scale);
        savePng(dir, 'cairo.png', cairo); savePng(dir, 'gpu.png', gpu); savePng(dir, 'diff.png', diff);
        const record = {cairoMs, gpuMs, width, height, inside: stats.inside, outside: stats.outside,
            explanation: 'Classification uses conservative annotation bounds; causes of differences are unverified.'};
        writePrivate(dir, 'differing-pixels.json', output => output.write_all(new TextEncoder().encode(JSON.stringify(stats.spans)), null));
        const metricsFile = dir.get_child('metrics.jsonl');
        const metrics = metricsFile.append_to(Gio.FileCreateFlags.PRIVATE, null);
        try {
            metricsFile.set_attribute_uint32('unix::mode', 0o600, Gio.FileQueryInfoFlags.NONE, null);
            metrics.write_all(new TextEncoder().encode(`${JSON.stringify(record)}\n`), null); }
        finally { metrics.close(null); }
        return cairo;
    }
}
