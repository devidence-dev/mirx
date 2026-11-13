import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { alignedPaintRect, physicalRect } from '../src/core/geometry.js';

async function load({ deferComposite = false } = {}) {
    const outputSource = (await readFile(new URL('../src/platform/imageOutput.js', import.meta.url), 'utf8'))
        .replace(/^import [^;]*;\n/gm, '')
        .replace('export class ImageOutput', 'class ImageOutput');
    const gpuSource = (await readFile(new URL('../src/platform/gpuExport.js', import.meta.url), 'utf8'))
        .replace(/^import [^;]*;\n/gm, '')
        .replace('export class GpuImageOutput', 'class GpuImageOutput');
    const events = [];
    const bytes = { get_data: () => new Uint8Array([1, 2, 3]) };
    // The compositor returns RGBA; JPEG must be encoded from an opaque copy.
    const opaque = { save_to_streamv: (...args) => events.push(['encode', 'opaque', ...args]) };
    const pixbuf = {
        get_width: () => 800,
        get_height: () => 533,
        get_has_alpha: () => true,
        composite: (dest, ...args) => events.push(['composite', dest === opaque, ...args]),
        save_to_streamv: (...args) => events.push(['encode', 'rgba', ...args]),
    };
    const stream = {
        closed: false,
        close() {
            this.closed = true;
            events.push('close');
        },
        is_closed() {
            return this.closed;
        },
        steal_as_bytes() {
            events.push('steal');
            return bytes;
        },
    };
    const fileStream = {
        write_all: (data) => events.push(['write', Array.from(data)]),
        close: () => events.push('file-close'),
    };
    const file = {
        create: (flags) => {
            events.push(['create', flags]);
            return fileStream;
        },
        get_path: () => '/screenshots/image',
        delete: () => events.push('delete'),
    };
    const dir = {
        make_directory_with_parents: () => events.push('mkdir'),
        get_child: (name) => {
            events.push(name);
            return file;
        },
    };
    const context = {
        alignedPaintRect,
        physicalRect,
        global: {
            stage: {
                paint_to_content: (...args) => {
                    events.push(args);
                    return { get_texture: () => 'texture' };
                },
            },
        },
        Clutter: { PaintFlag: { NO_CURSORS: 7 } },
        Mtk: { Rectangle: { new: (...args) => args } },
        GLib: {
            path_is_absolute: (path) => path.startsWith('/'),
            get_monotonic_time: () => {
                throw new Error('Disabled export profiling must not read the clock');
            },
        },
        console: { log: (message) => events.push(['perf', message]) },
        GdkPixbuf: {
            Colorspace: { RGB: 0 },
            InterpType: { NEAREST: 0 },
            Pixbuf: {
                new: (...args) => {
                    events.push(['new', ...args]);
                    return { ...opaque, fill: () => {} };
                },
            },
        },
        Gio: {
            MemoryOutputStream: { new_resizable: () => stream },
            File: { new_for_path: () => dir },
            FileCreateFlags: { NONE: 0, PRIVATE: 1 },
            IOErrorEnum: { EXISTS: 2 },
        },
        St: {
            ClipboardType: { CLIPBOARD: 1 },
            Clipboard: { get_default: () => ({ set_content: (...args) => events.push(['clipboard', ...args]) }) },
        },
        Shell: {
            Screenshot: {
                composite_to_stream: (...args) => {
                    events.push(args.slice(0, -1));
                    if (deferComposite) queueMicrotask(() => args.at(-1)(null, 'result'));
                    else args.at(-1)(null, 'result');
                },
                composite_to_stream_finish: () => pixbuf,
            },
        },
    };
    vm.runInNewContext(`${outputSource}\n${gpuSource}\nthis.Output = GpuImageOutput;`, context);
    return { Output: context.Output, context, events, bytes, pixbuf, fileStream };
}

const selection = { x: 20, y: 30, width: 600, height: 400 };
const snapshot = { scale: 1, capturedAt: 'date' };
const monitor = { scale: 4 / 3 };
const operation = { withExportContent: (callback) => callback() };

test('GPU copy paints on the physical grid and reuses the compositor PNG', async () => {
    const { Output, events, bytes } = await load();
    await new Output({ notify: () => events.push('notify') }).copy(snapshot, selection, [], monitor, {
        onComplete: () => events.push('complete'),
        withExportContent(callback) {
            events.push('hide');
            try {
                return callback();
            } finally {
                events.push('restore');
            }
        },
    });
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

test('export profiling separates paint, synchronous readback setup, PNG wait and clipboard delivery', async () => {
    const { Output, context, events, bytes } = await load();
    let now = 0;
    context.GLib.get_monotonic_time = () => now;
    context.global.stage.paint_to_content = () => {
        now += 1000;
        return { get_texture: () => 'texture' };
    };
    context.Shell.Screenshot.composite_to_stream = (...args) => {
        now += 2500;
        queueMicrotask(() => {
            now += 500000;
            args.at(-1)(null, 'result');
        });
    };
    await new Output({ perfLog: () => true }).copy(snapshot, selection, [], monitor, operation);
    const timings = events.filter((event) => event[0] === 'perf').map((event) => event[1]);
    assert.deepEqual(timings, [
        `mirx-perf export-paint ms=1 pixels=800x533 scale=${monitor.scale}`,
        'mirx-perf export-composite-sync ms=2.5',
        'mirx-perf export-png-wait ms=500',
        'mirx-perf export-clipboard ms=0',
    ]);
    assert.equal(events.find((event) => event[0] === 'clipboard')[3], bytes);
});

test('file export profiling identifies PNG write versus JPEG encoding and write', async () => {
    for (const format of ['PNG', 'JPG']) {
        const { Output, context, events } = await load({ deferComposite: true });
        let now = 0;
        context.GLib.get_monotonic_time = () => (now += 1000);
        await new Output({ perfLog: () => true }).save(
            snapshot,
            selection,
            [],
            monitor,
            { folder: '/screenshots', format },
            operation,
        );
        const phases = events.filter((event) => event[0] === 'perf').map((event) => event[1].split(' ')[1]);
        assert.deepEqual(phases, [
            'export-file-prepare',
            'export-paint',
            'export-composite-sync',
            'export-png-wait',
            format === 'PNG' ? 'export-png-write' : 'export-jpeg-and-write',
        ]);
    }
});

test('PNG save writes the compositor bytes and JPG encodes the pixbuf', async () => {
    for (const format of ['PNG', 'JPG']) {
        const { Output, events } = await load();
        await new Output({ notify: () => events.push('notify') }).save(
            snapshot,
            selection,
            [],
            monitor,
            { folder: '/screenshots', format },
            { ...operation, onComplete: () => events.push('complete') },
        );
        assert.deepEqual(events.slice(-3), ['file-close', 'complete', 'notify']);
        assert.ok(events.some((e) => Array.isArray(e) && e[0] === 'create' && e[1] === 0));
        assert.ok(events.includes(`Screenshot_date.${format === 'PNG' ? 'png' : 'jpg'}`));
        assert.equal(
            events.some((e) => Array.isArray(e) && e[0] === 'write'),
            format === 'PNG',
        );
        assert.equal(
            events.some((e) => Array.isArray(e) && e[0] === 'encode'),
            format === 'JPG',
        );
        if (format === 'JPG') {
            assert.deepEqual(
                events.find((e) => e[0] === 'new'),
                ['new', 0, false, 8, 800, 533],
            );
            assert.ok(events.some((e) => e[0] === 'encode' && e[1] === 'opaque' && e[2] !== undefined));
            assert.equal(
                events.some((e) => e[0] === 'encode' && e[1] === 'rgba'),
                false,
            );
        }
    }
});

test('save errors propagate and remove the partial file', async () => {
    const { Output, events, fileStream } = await load();
    fileStream.write_all = () => {
        throw new Error('disk full');
    };
    await assert.rejects(
        new Output().save(
            snapshot,
            selection,
            [],
            monitor,
            { folder: '/screenshots' },
            { ...operation, onComplete: () => events.push('complete') },
        ),
        /disk full/,
    );
    assert.equal(events.includes('complete'), false);
    assert.ok(events.includes('delete'));
});

test('save reserves the file before capture and preserves the editor on creation failure', async () => {
    const { Output, context, events } = await load();
    const denied = new Error('permission denied');
    denied.matches = () => false;
    context.Gio.File.new_for_path = () => ({
        make_directory_with_parents() {},
        get_child: () => ({
            create: () => {
                throw denied;
            },
        }),
    });
    let captured = false;
    await assert.rejects(
        new Output().save(
            snapshot,
            selection,
            [],
            monitor,
            { folder: '/readonly' },
            {
                ...operation,
                onCaptured: () => (captured = true),
            },
        ),
        /permission denied/,
    );
    assert.equal(captured, false);
    assert.equal(
        events.some((event) => Array.isArray(event) && event[0] === 'texture'),
        false,
    );
});

test('save removes its reserved file when rendering fails or is cancelled', async () => {
    for (const cancelled of [false, true]) {
        const { Output, context, events } = await load();
        if (!cancelled)
            context.global.stage.paint_to_content = () => {
                throw new Error('paint failed');
            };
        const saving = new Output().save(
            snapshot,
            selection,
            [],
            monitor,
            { folder: '/screenshots' },
            {
                ...operation,
                isCancelled: () => cancelled,
            },
        );
        if (cancelled) await saving;
        else await assert.rejects(saving, /paint failed/);
        assert.ok(events.includes('file-close'));
        assert.ok(events.includes('delete'));
        assert.ok(
            events.findIndex((event) => Array.isArray(event) && event[0] === 'create') < events.indexOf('delete'),
        );
    }
});

test('cancellation avoids clipboard writes and stage failure restores visibility', async () => {
    const first = await load();
    await new first.Output().copy(snapshot, selection, [], monitor, { ...operation, isCancelled: () => true });
    assert.equal(
        first.events.some((e) => Array.isArray(e) && e[0] === 'clipboard'),
        false,
    );
    const { Output, context } = await load();
    let visible = true;
    context.global.stage.paint_to_content = () => {
        throw new Error('paint failed');
    };
    await assert.rejects(
        new Output().copy(snapshot, selection, [], monitor, {
            withExportContent(callback) {
                visible = false;
                try {
                    return callback();
                } finally {
                    visible = true;
                }
            },
        }),
        /paint failed/,
    );
    assert.equal(visible, true);
});

test('save accepts an existing directory, expands home paths and resolves collisions', async () => {
    for (const folder of ['~', '~/Pictures']) {
        const { Output, context, events } = await load();
        const exists = { matches: (_domain, code) => code === context.Gio.IOErrorEnum.EXISTS };
        let creates = 0;
        const file = {
            create: () => {
                if (creates++ === 0) throw exists;
                return { write_all() {}, close() {} };
            },
            get_path: () => '/saved',
        };
        context.GLib.get_home_dir = () => '/home/user';
        context.GLib.build_filenamev = (parts) => parts.join('/');
        context.Gio.File.new_for_path = (path) => {
            events.push(path);
            return {
                make_directory_with_parents() {
                    throw exists;
                },
                get_child(name) {
                    events.push(name);
                    return file;
                },
            };
        };
        await new Output().save(snapshot, selection, [], monitor, { folder }, operation);
        assert.ok(events.includes(folder === '~' ? '/home/user' : '/home/user/Pictures'));
        assert.ok(events.includes('Screenshot_date.png'));
        assert.ok(events.includes('Screenshot_date-1.png'));
    }
});

test('directory creation failure propagates without completion or notification', async () => {
    const { Output, context, events } = await load();
    const denied = new Error('permission denied');
    denied.matches = () => false;
    context.Gio.File.new_for_path = () => ({
        make_directory_with_parents() {
            throw denied;
        },
    });
    await assert.rejects(
        new Output({ notify: () => events.push('notify') }).save(
            snapshot,
            selection,
            [],
            monitor,
            { folder: '/unwritable' },
            { ...operation, onComplete: () => events.push('complete') },
        ),
        /permission denied/,
    );
    assert.equal(events.includes('complete'), false);
    assert.equal(events.includes('notify'), false);
});

test('a folder error rejects before the capture is announced or rendered', async () => {
    const { Output, context } = await load();
    let captured = false;
    let composited = false;
    const composite = context.Shell.Screenshot.composite_to_stream;
    context.Shell.Screenshot.composite_to_stream = (...args) => {
        composited = true;
        composite(...args);
    };
    await assert.rejects(
        new Output().save(
            snapshot,
            selection,
            [],
            monitor,
            { folder: 'relative/dir' },
            { ...operation, onCaptured: () => (captured = true) },
        ),
        /absolute path/,
    );
    assert.equal(captured, false);
    assert.equal(composited, false);
});

test('compositor failure closes its stream and invalid dimensions fail export', async () => {
    const failed = await load();
    failed.context.Shell.Screenshot.composite_to_stream_finish = () => {
        throw new Error('composite failed');
    };
    await assert.rejects(new failed.Output().render(snapshot, selection, [], monitor, operation), /composite failed/);
    assert.ok(failed.events.includes('close'));
    assert.equal(failed.events.includes('steal'), false);
    const mismatch = await load();
    mismatch.pixbuf.get_width = () => 799;
    await assert.rejects(
        new mismatch.Output().render(snapshot, selection, [], monitor, operation),
        /dimensions 799x533 differ from expected 800x533/,
    );
});

test('empty selections and missing stage paint API fail before rendering', async () => {
    const { Output, context, events } = await load();
    const output = new Output();
    await assert.rejects(
        output.render(snapshot, { ...selection, width: 0 }, [], monitor, operation),
        /selection is empty/,
    );
    delete context.global.stage.paint_to_content;
    await assert.rejects(
        output.render(snapshot, selection, [], monitor, operation),
        /requires Clutter.Stage.paint_to_content/,
    );
    assert.deepEqual(events, []);
});

test('unaligned fallback validates the full texture dimensions', async () => {
    const { Output, context, events, pixbuf } = await load();
    const texture = { get_width: () => 823, get_height: () => 548 };
    context.global.stage.paint_to_content = (...args) => {
        events.push(args);
        return { get_texture: () => texture };
    };
    pixbuf.get_width = () => 823;
    pixbuf.get_height = () => 548;
    await new Output().render(snapshot, { x: 1, y: 1, width: 601, height: 400 }, [], { scale: 1.37 }, operation);
    assert.deepEqual(Array.from(events[0][0]), [1, 1, 601, 400]);
    assert.deepEqual(events[1].slice(0, 5), [texture, 0, 0, -1, -1]);
    pixbuf.get_width = () => 822;
    await assert.rejects(
        new Output().render(snapshot, { x: 1, y: 1, width: 601, height: 400 }, [], { scale: 1.37 }, operation),
        /expected 823x548/,
    );
});

test('capture is announced after readback and before the PNG completes', async () => {
    const { Output, events } = await load({ deferComposite: true });
    await new Output().copy(snapshot, selection, [], monitor, {
        ...operation,
        onCaptured: () => events.push('captured'),
    });
    const captured = events.indexOf('captured');
    assert.equal(events[captured - 1][0], 'texture');
    assert.equal(events[captured + 1], 'close');
});
