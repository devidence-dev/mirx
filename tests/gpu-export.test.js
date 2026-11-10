import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

import {alignedPaintRect, physicalRect} from '../src/core/geometry.js';

async function load() {
    const source = (await readFile(new URL('../src/platform/gpuExport.js', import.meta.url), 'utf8'))
        .replace(/^import .*;\n/gm, '').replace('export class GpuImageOutput', 'class GpuImageOutput')
        .replace('export function ensurePixelationPixels', 'function ensurePixelationPixels') +
        '\nthis.GpuImageOutput = GpuImageOutput; this.ensurePixelationPixels = ensurePixelationPixels;';
    const events = [];
    const files = new Map();
    const pixbuf = {get_width: () => 800, get_height: () => 533};
    class ImageOutput {
        constructor({notify} = {}) { this._notify = notify; }
        async render() { events.push('cairo'); return pixbuf; }
        async copy(snapshot, selection, annotations, monitor, operation) {
            const result = await this.render(snapshot, selection, annotations, monitor);
            if (!operation.isCancelled?.()) events.push(result);
        }
    }
    const context = {ImageOutput, alignedPaintRect, physicalRect, annotationBounds: () => ({}), console: {log: () => {}}, TextEncoder,
        global: {stage: {paint_to_content: (...args) => { events.push(args); return {get_texture: () => 'texture'}; }}},
        Clutter: {PaintFlag: {NO_CURSORS: 7}}, Mtk: {Rectangle: {new: (...args) => args}},
        GLib: {get_monotonic_time: () => 0},
        Gio: {MemoryOutputStream: {new_resizable: () => ({close: () => events.push('close')})}},
        Shell: {Screenshot: {composite_to_stream: (...args) => { events.push(args.slice(0, -1)); args.at(-1)(null, 'result'); },
            composite_to_stream_finish: () => pixbuf}}};
    vm.runInNewContext(source, context);
    return {Output: context.GpuImageOutput, context, events, pixbuf, files};
}

const selection = {x: 20, y: 30, width: 600, height: 400};
const snapshot = {scale: 1};
const monitor = {scale: 4 / 3};

test('GPU capture hides decorations only for the synchronous stage paint and uses a cropped texture', async () => {
    const {Output, events, pixbuf} = await load();
    const output = new Output({engine: () => 'gpu'});
    await output.copy(snapshot, selection, [], monitor, {withExportContent(callback) {
        events.push('hide'); const content = callback(); events.push('restore'); return content;
    }});
    assert.equal(events[0], 'hide');
    // Physical rect {27, 40, 800, 533}; q = 3 gives the aligned logical rect {18, 30, 603, 402}
    // (x 27/(4/3)/3 = 6.75 -> 6, y 40/(4/3)/3 = 10, right 827/(4/3)/3 = 206.75 -> 207, bottom 573/(4/3)/3 = 143.25 -> 144),
    // offsets 27 - 24 = 3 and 40 - 40 = 0.
    assert.deepEqual(Array.from(events[1][0]), [18, 30, 603, 402]);
    assert.deepEqual(Array.from(events[1].slice(1)), [4 / 3, null, 7]);
    assert.equal(events[2], 'restore');
    assert.deepEqual(events[3].slice(0, 5), ['texture', 3, 0, 800, 533]);
    assert.equal(events[4], 'close');
    assert.equal(events[5], pixbuf);
});

test('GPU capture without an aligned paint rectangle paints the selection and keeps the whole texture', async () => {
    const {Output, context, events} = await load();
    context.Shell.Screenshot.composite_to_stream_finish = () => ({get_width: () => 822, get_height: () => 548});
    await new Output({engine: () => 'gpu'}).copy(snapshot, selection, [], {scale: 1.37},
        {withExportContent: callback => callback()});
    assert.deepEqual(Array.from(events[0][0]), [20, 30, 600, 400]);
    assert.deepEqual(events[1].slice(0, 5), ['texture', 0, 0, -1, -1]);
});

test('default engine keeps Cairo and unavailable GPU fails explicitly', async () => {
    const {Output, context, events} = await load();
    await new Output().copy(snapshot, selection, [], monitor);
    assert.equal(events[0], 'cairo');
    delete context.global.stage.paint_to_content;
    await assert.rejects(new Output({engine: () => 'gpu'}).copy(snapshot, selection, [], monitor,
        {withExportContent: callback => callback()}), /paint_to_content/);
});

test('export keeps the engine selected before asynchronous preparation', async () => {
    const {Output, events} = await load();
    await new Output({engine: () => 'cairo'}).copy(snapshot, selection, [], monitor,
        {engine: 'gpu', withExportContent: callback => callback()});
    assert.equal(events.includes('cairo'), false);
    assert.ok(Array.isArray(events[0]));
});


test('compare writes actual RGB differences, classified spans, and appendable JSONL', async () => {
    const {Output, context, files} = await load();
    const makePixbuf = pixels => ({get_width: () => 3, get_height: () => 1,
        get_rowstride: () => 9, get_n_channels: () => 3,
        read_pixel_bytes: () => ({get_data: () => pixels}),
        save_to_streamv: stream => stream.write_all(new Uint8Array([42]))});
    const cairo = makePixbuf(new Uint8Array([0, 0, 0, 10, 10, 10, 20, 20, 20]));
    const gpu = makePixbuf(new Uint8Array([1, 0, 0, 13, 8, 10, 20, 20, 20]));
    context.ImageOutput.prototype.render = async () => cairo;
    context.Shell.Screenshot.composite_to_stream_finish = () => gpu;
    context.annotationBounds = () => ({x: -20, y: -20, width: 4, height: 40});
    let diffBytes;
    context.GdkPixbuf = {Colorspace: {RGB: 0}, Pixbuf: {new_from_bytes(bytes, _color, _alpha, _bits, width, height, stride) {
        diffBytes = Array.from(bytes); assert.equal(width, 3); assert.equal(height, 1); assert.equal(stride, 9);
        return makePixbuf(bytes);
    }}};
    context.GLib.Bytes = {new: bytes => bytes};
    context.GLib.get_user_cache_dir = () => '/cache';
    context.GLib.build_filenamev = parts => parts.join('/');
    context.GLib.mkdir_with_parents = () => 0;
    context.Gio.FileCreateFlags = {PRIVATE: 1, REPLACE_DESTINATION: 2};
    context.Gio.FileQueryInfoFlags = {NONE: 0};
    const directory = {set_attribute_uint32() {}, get_child(name) {
        const stream = append => ({write_all(bytes) {
            const old = append ? files.get(name) ?? '' : '';
            files.set(name, old + new TextDecoder().decode(bytes));
        }, close() {}});
        return {replace: () => stream(false), append_to: () => stream(true), set_attribute_uint32() {}};
    }};
    context.Gio.File = {new_for_path: () => directory};
    const output = new Output({engine: () => 'compare'});
    const operation = {withExportContent: callback => callback()};
    const small = {x: 0, y: 0, width: 3, height: 1};
    await output.copy({scale: 1}, small, [{}], {scale: 1}, operation);
    await output.copy({scale: 1}, small, [{}], {scale: 1}, operation);
    assert.deepEqual(diffBytes, [1, 0, 0, 3, 2, 0, 0, 0, 0]);
    const lines = files.get('metrics.jsonl').trim().split('\n').map(JSON.parse);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].inside.count, 1);
    assert.equal(lines[0].inside.max, 1);
    assert.equal(lines[0].outside.overTolerance, 1);
    assert.equal(lines[0].outside.max, 3);
    const spans = JSON.parse(files.get('differing-pixels.json'));
    assert.deepEqual(spans, [{y: 0, xStart: 0, xEnd: 0, region: 'inside', max: 1},
        {y: 0, xStart: 1, xEnd: 1, region: 'outside', max: 3}]);
});

test('stage failure restores visibility and propagates error', async () => {
    const {Output, context} = await load();
    let visible = true;
    context.global.stage.paint_to_content = () => { throw new Error('paint failed'); };
    await assert.rejects(new Output({engine: () => 'gpu'}).copy(snapshot, selection, [], monitor,
        {withExportContent(callback) { visible = false; try { return callback(); } finally { visible = true; } }}), /paint failed/);
    assert.equal(visible, true);
});


test('pixelation reads only needed tiles, shares requests, and replaces cached pixbuf on growth', async () => {
    const {context, events} = await load();
    const copies = [];
    const makeDestination = () => ({fill(value) { assert.equal(value, 0); },
        copy() { const next = makeDestination(); copies.push(next); return next; }});
    context.GdkPixbuf = {Colorspace: {RGB: 0}, Pixbuf: {new: () => makeDestination()}};
    context.annotationBounds = a => ({x: a.x1, y: a.y1, width: a.x2 - a.x1, height: a.y2 - a.y1});
    context.Shell.Screenshot.composite_to_stream_finish = () => ({copy_area: (...args) => copies.push(args)});
    const original = {};
    const snapshot = {pixbuf: original, scale: 1, content: {get_texture: () => ({get_width: () => 1200, get_height: () => 800})}};
    const first = [{type: 'pixelate', x1: 10, y1: 20, x2: 30, y2: 40}];
    const [a, b] = await Promise.all([context.ensurePixelationPixels(snapshot, first), context.ensurePixelationPixels(snapshot, first)]);
    assert.equal(a, b);
    assert.equal(snapshot.pixbuf, original);
    assert.equal(snapshot.pixelationPixbuf, a);
    const requests = () => events.filter(e => Array.isArray(e) && e.length === 11);
    assert.equal(requests().length, 1);
    assert.deepEqual(Array.from(requests()[0].slice(1, 5)), [0, 0, 512, 512]);
    const second = [...first, {type: 'pixelate', x1: 600, y1: 40, x2: 700, y2: 60}];
    const c = await context.ensurePixelationPixels(snapshot, second);
    assert.notEqual(c, a);
    assert.equal(snapshot.pixelationPixbuf, c);
    assert.equal(requests().length, 2);
    assert.deepEqual(Array.from(requests()[1].slice(1, 5)), [512, 0, 512, 512]);
    assert.equal(snapshot.pixbuf, original);
});
