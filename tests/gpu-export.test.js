import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {alignedPaintRect, physicalRect} from '../src/core/geometry.js';

async function load() {
    const outputSource = (await readFile(new URL('../src/platform/imageOutput.js', import.meta.url), 'utf8'))
        .replace(/^import .*;\n/gm, '').replace('export class ImageOutput', 'class ImageOutput');
    const gpuSource = (await readFile(new URL('../src/platform/gpuExport.js', import.meta.url), 'utf8'))
        .replace(/^import .*;\n/gm, '').replace('export class GpuImageOutput', 'class GpuImageOutput');
    const events = [];
    const bytes = {get_data: () => new Uint8Array([1, 2, 3])};
    // The compositor returns RGBA; JPEG must be encoded from an opaque copy.
    const opaque = {save_to_streamv: (...args) => events.push(['encode', 'opaque', ...args])};
    const pixbuf = {get_width: () => 800, get_height: () => 533, get_has_alpha: () => true,
        composite: (dest, ...args) => events.push(['composite', dest === opaque, ...args]),
        save_to_streamv: (...args) => events.push(['encode', 'rgba', ...args])};
    const stream = {closed: false, close() { this.closed = true; events.push('close'); },
        is_closed() { return this.closed; }, steal_as_bytes() { events.push('steal'); return bytes; }};
    const fileStream = {write_all: data => events.push(['write', Array.from(data)]), close: () => events.push('file-close')};
    const file = {create: flags => { events.push(['create', flags]); return fileStream; }, get_path: () => '/screenshots/image', delete: () => events.push('delete')};
    const dir = {make_directory_with_parents: () => events.push('mkdir'), get_child: name => { events.push(name); return file; }};
    const context = {alignedPaintRect, physicalRect,
        global: {stage: {paint_to_content: (...args) => { events.push(args); return {get_texture: () => 'texture'}; }}},
        Clutter: {PaintFlag: {NO_CURSORS: 7}}, Mtk: {Rectangle: {new: (...args) => args}},
        GLib: {path_is_absolute: path => path.startsWith('/')},
        GdkPixbuf: {Colorspace: {RGB: 0}, InterpType: {NEAREST: 0},
            Pixbuf: {new: (...args) => { events.push(['new', ...args]); return {...opaque, fill: () => {}}; }}},
        Gio: {MemoryOutputStream: {new_resizable: () => stream}, File: {new_for_path: () => dir},
            FileCreateFlags: {NONE: 0, PRIVATE: 1}, IOErrorEnum: {EXISTS: 2}},
        St: {ClipboardType: {CLIPBOARD: 1}, Clipboard: {get_default: () => ({set_content: (...args) => events.push(['clipboard', ...args])})}},
        Shell: {Screenshot: {composite_to_stream: (...args) => { events.push(args.slice(0, -1)); args.at(-1)(null, 'result'); },
            composite_to_stream_finish: () => pixbuf}}};
    vm.runInNewContext(`${outputSource}\n${gpuSource}\nthis.Output = GpuImageOutput;`, context);
    return {Output: context.Output, context, events, bytes, pixbuf, fileStream};
}

const selection = {x: 20, y: 30, width: 600, height: 400};
const snapshot = {scale: 1, capturedAt: 'date'};
const monitor = {scale: 4 / 3};
const operation = {withExportContent: callback => callback()};

test('GPU copy paints on the physical grid and reuses the compositor PNG', async () => {
    const {Output, events, bytes} = await load();
    await new Output({notify: () => events.push('notify')}).copy(snapshot, selection, [], monitor, {onComplete: () => events.push('complete'), withExportContent(callback) {
        events.push('hide'); try { return callback(); } finally { events.push('restore'); }
    }});
    assert.equal(events[0], 'hide');
    assert.deepEqual(Array.from(events[1][0]), [18, 30, 603, 402]);
    assert.deepEqual(Array.from(events[1].slice(1)), [4 / 3, null, 7]);
    assert.equal(events[2], 'restore');
    assert.deepEqual(events[3].slice(0, 5), ['texture', 3, 0, 800, 533]);
    assert.deepEqual(events.slice(4, 6), ['close', 'steal']);
    assert.equal(events[6][0], 'clipboard');
    assert.equal(events[6][2], 'image/png');
    assert.equal(events[6][3], bytes);
    assert.deepEqual(events.slice(7), ['complete', 'notify']);
});

test('PNG save writes the compositor bytes and JPG encodes the pixbuf', async () => {
    for (const format of ['PNG', 'JPG']) {
        const {Output, events} = await load();
        await new Output({notify: () => events.push('notify')}).save(snapshot, selection, [], monitor, {folder: '/screenshots', format}, {...operation, onComplete: () => events.push('complete')});
        assert.deepEqual(events.slice(-3), ['file-close', 'complete', 'notify']);
        assert.ok(events.some(e => Array.isArray(e) && e[0] === 'create' && e[1] === 0));
        assert.ok(events.includes(`Screenshot_date.${format === 'PNG' ? 'png' : 'jpg'}`));
        assert.equal(events.some(e => Array.isArray(e) && e[0] === 'write'), format === 'PNG');
        assert.equal(events.some(e => Array.isArray(e) && e[0] === 'encode'), format === 'JPG');
        if (format === 'JPG') {
            assert.deepEqual(events.find(e => e[0] === 'new'), ['new', 0, false, 8, 800, 533]);
            assert.ok(events.some(e => e[0] === 'encode' && e[1] === 'opaque' && e[2] !== undefined));
            assert.equal(events.some(e => e[0] === 'encode' && e[1] === 'rgba'), false);
        }
    }
});

test('save errors propagate and remove the partial file', async () => {
    const {Output, events, fileStream} = await load();
    fileStream.write_all = () => { throw new Error('disk full'); };
    await assert.rejects(new Output().save(snapshot, selection, [], monitor, {folder: '/screenshots'},
        {...operation, onComplete: () => events.push('complete')}), /disk full/);
    assert.equal(events.includes('complete'), false);
    assert.ok(events.includes('delete'));
});

test('cancellation avoids clipboard writes and stage failure restores visibility', async () => {
    const first = await load();
    await new first.Output().copy(snapshot, selection, [], monitor, {...operation, isCancelled: () => true});
    assert.equal(first.events.some(e => Array.isArray(e) && e[0] === 'clipboard'), false);
    const {Output, context} = await load();
    let visible = true;
    context.global.stage.paint_to_content = () => { throw new Error('paint failed'); };
    await assert.rejects(new Output().copy(snapshot, selection, [], monitor,
        {withExportContent(callback) { visible = false; try { return callback(); } finally { visible = true; } }}), /paint failed/);
    assert.equal(visible, true);
});

test('save accepts an existing directory, expands home paths and resolves collisions', async () => {
    for (const folder of ['~', '~/Pictures']) {
        const {Output, context, events} = await load();
        const exists = {matches: (_domain, code) => code === context.Gio.IOErrorEnum.EXISTS};
        let creates = 0;
        const file = {create: () => {
            if (creates++ === 0)
                throw exists;
            return {write_all() {}, close() {}};
        }, get_path: () => '/saved'};
        context.GLib.get_home_dir = () => '/home/user';
        context.GLib.build_filenamev = parts => parts.join('/');
        context.Gio.File.new_for_path = path => {
            events.push(path);
            return {make_directory_with_parents() { throw exists; }, get_child(name) { events.push(name); return file; }};
        };
        await new Output().save(snapshot, selection, [], monitor, {folder}, operation);
        assert.ok(events.includes(folder === '~' ? '/home/user' : '/home/user/Pictures'));
        assert.ok(events.includes('Screenshot_date.png'));
        assert.ok(events.includes('Screenshot_date-1.png'));
    }
});

test('directory creation failure propagates without completion or notification', async () => {
    const {Output, context, events} = await load();
    const denied = new Error('permission denied');
    denied.matches = () => false;
    context.Gio.File.new_for_path = () => ({make_directory_with_parents() { throw denied; }});
    await assert.rejects(new Output({notify: () => events.push('notify')}).save(snapshot, selection, [], monitor,
        {folder: '/unwritable'}, {...operation, onComplete: () => events.push('complete')}), /permission denied/);
    assert.equal(events.includes('complete'), false);
    assert.equal(events.includes('notify'), false);
});

test('compositor failure closes its stream and invalid dimensions fail export', async () => {
    const failed = await load();
    failed.context.Shell.Screenshot.composite_to_stream_finish = () => { throw new Error('composite failed'); };
    await assert.rejects(new failed.Output().render(snapshot, selection, [], monitor, operation), /composite failed/);
    assert.ok(failed.events.includes('close'));
    assert.equal(failed.events.includes('steal'), false);
    const mismatch = await load();
    mismatch.pixbuf.get_width = () => 799;
    await assert.rejects(new mismatch.Output().render(snapshot, selection, [], monitor, operation), /dimensions 799x533 differ from expected 800x533/);
});

test('empty selections and missing stage paint API fail before rendering', async () => {
    const {Output, context, events} = await load();
    const output = new Output();
    await assert.rejects(output.render(snapshot, {...selection, width: 0}, [], monitor, operation), /selection is empty/);
    delete context.global.stage.paint_to_content;
    await assert.rejects(output.render(snapshot, selection, [], monitor, operation), /requires Clutter.Stage.paint_to_content/);
    assert.deepEqual(events, []);
});

test('unaligned fallback validates the full texture dimensions', async () => {
    const {Output, context, events, pixbuf} = await load();
    const texture = {get_width: () => 823, get_height: () => 548};
    context.global.stage.paint_to_content = (...args) => { events.push(args); return {get_texture: () => texture}; };
    pixbuf.get_width = () => 823;
    pixbuf.get_height = () => 548;
    await new Output().render(snapshot, {x: 1, y: 1, width: 601, height: 400}, [], {scale: 1.37}, operation);
    assert.deepEqual(Array.from(events[0][0]), [1, 1, 601, 400]);
    assert.deepEqual(events[1].slice(0, 5), [texture, 0, 0, -1, -1]);
    pixbuf.get_width = () => 822;
    await assert.rejects(new Output().render(snapshot, {x: 1, y: 1, width: 601, height: 400}, [], {scale: 1.37}, operation), /expected 823x548/);
});
