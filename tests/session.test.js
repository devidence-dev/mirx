import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureSession } from '../src/application/captureSession.js';
import { Editor } from '../src/core/editor.js';

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

const snapshot = {
    monitors: [{ x: 0, y: 0, width: 800, height: 600, scale: 1 }],
    windows: [],
};

function fixture() {
    const captures = [];
    const views = [];
    const notifications = [];
    const calls = [];
    let config = { color: '#ff0000', width: 3, enterAction: 'copy', folder: '/old' };
    let runOutput = () => Promise.resolve();
    let writer = () => {};
    const session = new CaptureSession({
        capture: {
            capture() {
                const pending = deferred();
                captures.push(pending);
                return pending.promise;
            },
        },
        createEditor: (options) => new Editor(options),
        createView: (args) => {
            const view = {
                ...args,
                opens: 0,
                destroys: 0,
                busy: [],
                errors: [],
                open() {
                    this.opens++;
                },
                destroy() {
                    this.destroys++;
                },
                setBusy(value) {
                    this.busy.push(value);
                },
                showError(message) {
                    this.errors.push(message);
                },
                withExportContent(callback) {
                    return callback();
                },
            };
            views.push(view);
            return view;
        },
        output: {
            save(...args) {
                calls.push({ action: 'save', args });
                return runOutput();
            },
            copy(...args) {
                calls.push({ action: 'copy', args });
                return runOutput();
            },
        },
        settings: () => config,
        writePreferences: (patch) => writer(patch),
        notifyError: (...args) => notifications.push(args),
    });
    return {
        session,
        captures,
        views,
        notifications,
        calls,
        setConfig(value) {
            config = value;
        },
        setWriter(value) {
            writer = value;
        },
        setOutput(value) {
            runOutput = value;
        },
        async open() {
            const pending = session.open();
            captures.at(-1).resolve(snapshot);
            await pending;
            return views.at(-1);
        },
    };
}

function select(view) {
    view.editor.selectMonitor({ x: 10, y: 10 });
    view.editor.addText({ x: 20, y: 20 }, 'note');
}

test('duplicate shortcut while capture is pending or overlay is open is ignored', async () => {
    const f = fixture();
    const opening = f.session.open();
    await f.session.open();
    assert.equal(f.captures.length, 1);
    f.captures[0].resolve(snapshot);
    await opening;
    await f.session.open();
    assert.equal(f.captures.length, 1);
    assert.equal(f.views.length, 1);
    assert.equal(f.views[0].opens, 1);
});

test('closing or destroying during capture prevents late overlays', async () => {
    for (const action of ['close', 'destroy']) {
        const f = fixture();
        const opening = f.session.open();
        f.session[action]();
        f.captures[0].resolve(snapshot);
        await opening;
        assert.equal(f.views.length, 0, action);
        if (action === 'destroy') {
            await f.session.open();
            assert.equal(f.captures.length, 1);
        }
    }
});

test('capture failure reports the error and permits a new session', async () => {
    const f = fixture();
    const opening = f.session.open();
    f.captures[0].reject(new Error('capture failed'));
    await opening;
    assert.deepEqual(f.notifications, [['Could not capture the screen', 'capture failed']]);
    const view = await f.open();
    assert.equal(view.opens, 1);
    assert.equal(f.captures.length, 2);
});

test('save failure keeps the editor and overlay intact and clears busy state', async () => {
    const f = fixture();
    const view = await f.open();
    select(view);
    const before = structuredClone({ selection: view.editor.selection, annotations: view.editor.annotations });
    f.setOutput(() => Promise.reject(new Error('disk full')));
    await view.onExport('save');
    assert.deepEqual({ selection: view.editor.selection, annotations: view.editor.annotations }, before);
    assert.equal(view.destroys, 0);
    assert.deepEqual(view.busy, [true, false]);
    assert.deepEqual(view.errors, ['disk full']);
    assert.deepEqual(f.notifications, [['Could not export the capture', 'disk full']]);
    f.setOutput(() => Promise.resolve());
    await view.onExport('save');
    assert.equal(view.destroys, 1);
});

test('export without a selection is a no-op', async () => {
    const f = fixture();
    const view = await f.open();
    await view.onExport('copy');
    await view.onExport('save');
    assert.deepEqual(f.calls, []);
    assert.deepEqual(view.busy, []);
    assert.equal(view.destroys, 0);
});

test('successful export closes once and suppresses concurrent exports', async () => {
    const f = fixture();
    const view = await f.open();
    select(view);
    const output = deferred();
    f.setOutput(() => output.promise);
    const first = view.onExport('copy');
    await view.onExport('save');
    assert.equal(f.calls.length, 1);
    assert.deepEqual(view.busy, [true]);
    output.resolve();
    await first;
    assert.equal(view.destroys, 1);
    await view.onExport('copy');
    assert.equal(f.calls.length, 1);
    assert.equal(view.destroys, 1);
});

test('settings are read after capture and again when saving', async () => {
    const f = fixture();
    const opening = f.session.open();
    f.setConfig({ color: '#00ff00', width: 6, enterAction: 'save', folder: '/first' });
    f.captures[0].resolve(snapshot);
    await opening;
    const view = f.views[0];
    assert.deepEqual(view.editor.style, { color: '#00ff00', width: 6, gradient: false });
    select(view);
    const latest = { color: '#0000ff', width: 9, enterAction: 'copy', folder: '/latest' };
    f.setConfig(latest);
    assert.equal(view.enterAction(), 'copy');
    await view.onExport('save');
    assert.equal(f.calls[0].args[4], latest);
    assert.equal(f.calls[0].args[1], view.editor.selection);
    assert.equal(f.calls[0].args[2], view.editor.annotations);
});

test('stale failures do not disturb a newer session', async () => {
    const f = fixture();
    const oldCapture = f.session.open();
    f.session.close();
    const newCapture = f.session.open();
    f.captures[0].reject(new Error('old capture'));
    await oldCapture;
    f.captures[1].resolve(snapshot);
    await newCapture;
    assert.equal(f.views.length, 1);
    assert.deepEqual(f.notifications, []);
    const oldView = f.views[0];
    select(oldView);
    const output = deferred();
    f.setOutput(() => output.promise);
    const oldExport = oldView.onExport('save');
    await Promise.resolve(); // let the save start before cancelling, so its failure is stale
    oldView.onCancel();
    const currentView = await f.open();
    output.reject(new Error('old save'));
    await oldExport;
    assert.equal(currentView.destroys, 0);
    assert.deepEqual(currentView.busy, []);
    assert.deepEqual(f.notifications, []);
});

test('output cancellation follows the session generation', async () => {
    const f = fixture();
    const view = await f.open();
    select(view);
    const output = deferred();
    f.setOutput(() => output.promise);
    const exporting = view.onExport('copy');
    const operation = f.calls[0].args[4];
    assert.equal(operation.isCancelled(), false);
    view.onCancel();
    assert.equal(operation.isCancelled(), true);
    output.resolve();
    await exporting;
    assert.equal(view.destroys, 1);
});

test('modal open failure destroys the view and allows recovery', async () => {
    let attempts = 0;
    const views = [];
    const errors = [];
    const session = new CaptureSession({
        capture: { capture: async () => snapshot },
        createEditor: (options) => new Editor(options),
        createView: () => {
            const view = {
                destroyed: 0,
                open() {
                    if (++attempts === 1) throw new Error('modal unavailable');
                },
                destroy() {
                    this.destroyed++;
                },
            };
            views.push(view);
            return view;
        },
        output: {},
        settings: () => ({ color: '#f00', width: 3 }),
        notifyError: (...args) => errors.push(args),
    });
    await session.open();
    assert.equal(views[0].destroyed, 1);
    assert.deepEqual(errors, [['Could not capture the screen', 'modal unavailable']]);
    await session.open();
    assert.equal(views.length, 2);
    assert.equal(views[1].destroyed, 0);
});

test('export uses the view content without preparing pixel data', async () => {
    const f = fixture();
    const opening = f.session.open();
    const captured = {
        ...snapshot,
        get pixbufReady() {
            throw new Error('full pixbuf requested');
        },
        ensurePixelation() {
            throw new Error('pixelation tiles requested');
        },
    };
    f.captures[0].resolve(captured);
    await opening;
    const view = f.views[0];
    select(view);
    view.editor.annotations.push({ type: 'pixelate' });
    await view.onExport('copy');
    assert.equal(f.calls.length, 1);
    assert.equal(
        f.calls[0].args[4].withExportContent(() => 'painted'),
        'painted',
    );
});

test('export forwards the completion callback to the output port', async () => {
    const f = fixture();
    const view = await f.open();
    select(view);
    let completed = false;
    const onComplete = () => {
        completed = true;
    };
    await view.onExport('copy', onComplete);
    assert.equal(f.calls[0].args[4].onComplete, onComplete);
    f.calls[0].args[4].onComplete();
    assert.equal(completed, true);
});

test('appearance changes persist immediately and stale callbacks cannot write', async () => {
    const f = fixture();
    const stored = { color: '#ff0000', width: 3, gradient: false, toolWidths: {} };
    const writes = [];
    f.setConfig(stored);
    f.setWriter((patch) => {
        writes.push(patch);
        if (patch.color) stored.color = patch.color;
        if (patch.gradient !== undefined) stored.gradient = patch.gradient;
        if (patch.toolWidth) stored.toolWidths[patch.toolWidth.tool] = patch.toolWidth.width;
    });
    for (const [index, action] of ['cancel', 'copy', 'save'].entries()) {
        const view = await f.open();
        assert.equal(view.editor.annotations.length, 0);
        assert.equal(view.editor.selection, null);
        const count = writes.length;
        view.editor.setTool('arrow');
        view.editor.setTool('marker');
        assert.equal(writes.length, count);
        view.editor.setStyle({
            color: ['#0088ff', '#ffcc00', '#0088ff'][index],
            gradient: index !== 1,
            width: index + 5,
        });
        if (action === 'cancel') view.onCancel();
        else {
            view.editor.selectMonitor({ x: 10, y: 10 });
            await view.onExport(action);
        }
        const afterClose = writes.length;
        view.editor.setStyle({ color: '#ffffff' });
        assert.equal(writes.length, afterClose);
    }
    stored.color = '#ffcc00';
    const current = await f.open();
    assert.equal(current.editor.style.color, '#ffcc00');
    assert.equal(current.editor.style.gradient, true);
    current.editor.setTool('marker');
    assert.equal(current.editor.style.width, 7);
    f.session.destroy();
    current.editor.setStyle({ width: 6 });
    assert.equal(writes.at(-1).toolWidth.width, 7);
});

test('failed preference writes report once without preventing editing or export', async () => {
    const f = fixture();
    f.setWriter(() => {
        throw new Error('read only');
    });
    const view = await f.open();
    view.editor.setTool('marker');
    view.editor.setStyle({ width: 5 });
    view.editor.setStyle({ color: '#0088ff' });
    assert.equal(view.editor.style.width, 5);
    assert.deepEqual(f.notifications, [['Could not save annotation preferences', 'read only']]);
    view.editor.selectMonitor({ x: 10, y: 10 });
    await view.onExport('copy');
    const next = await f.open();
    next.editor.setTool('marker');
    assert.equal(next.editor.style.width, 3);
    assert.equal(next.editor.style.color, '#ff0000');
});

test('failed view opening invalidates retained preference callback', async () => {
    let editor;
    const writes = [];
    const session = new CaptureSession({
        capture: { capture: async () => snapshot },
        createEditor: (options) => (editor = new Editor(options)),
        createView: () => ({
            open() {
                throw new Error('failed');
            },
            destroy() {},
        }),
        settings: () => ({}),
        output: {},
        writePreferences: (patch) => writes.push(patch),
        notifyError: () => {},
    });
    await session.open();
    editor.setStyle({ color: '#0088ff' });
    assert.deepEqual(writes, []);
});

test('overlay closes when the output holds the pixels and delivery still completes or reports', async () => {
    for (const fail of [false, true]) {
        const f = fixture();
        const view = await f.open();
        select(view);
        const output = deferred();
        f.setOutput(() => output.promise);
        const exporting = view.onExport('copy');
        const operation = f.calls[0].args[4];
        operation.onCaptured();
        assert.equal(view.destroys, 1);
        assert.equal(operation.isCancelled(), false);
        // A new capture may start while the previous one is still encoding.
        const next = await f.open();
        if (fail) output.reject(new Error('encode failed'));
        else output.resolve();
        await exporting;
        assert.equal(view.destroys, 1);
        assert.equal(next.destroys, 0);
        assert.deepEqual(next.errors, []);
        assert.deepEqual(f.notifications, fail ? [['Could not export the capture', 'encode failed']] : []);
    }
});

test('a newer copy cancels an older copy but never a save', async () => {
    const f = fixture();
    const first = await f.open();
    select(first);
    const output = deferred();
    f.setOutput(() => output.promise);
    const copying = first.onExport('copy');
    const older = f.calls[0].args[4];
    older.onCaptured();
    const second = await f.open();
    select(second);
    const saving = second.onExport('save');
    const save = f.calls[1].args[5];
    save.onCaptured();
    assert.equal(older.isCancelled(), false);
    const third = await f.open();
    select(third);
    const newer = third.onExport('copy');
    const latest = f.calls[2].args[4];
    assert.equal(older.isCancelled(), true);
    assert.equal(latest.isCancelled(), false);
    assert.equal(save.isCancelled(), false);
    output.resolve();
    await Promise.all([copying, saving, newer]);
});

test('a cancelled export ignores a late capture announcement', async () => {
    const f = fixture();
    const view = await f.open();
    select(view);
    const output = deferred();
    f.setOutput(() => output.promise);
    const exporting = view.onExport('copy');
    const operation = f.calls[0].args[4];
    view.onCancel();
    operation.onCaptured();
    assert.equal(operation.isCancelled(), true);
    output.resolve();
    await exporting;
});
