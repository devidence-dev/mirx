import test from 'node:test';
import assert from 'node:assert/strict';
import {CaptureSession} from '../src/application/captureSession.js';
import {Editor} from '../src/core/editor.js';

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}

const snapshot = {
    monitors: [{x: 0, y: 0, width: 800, height: 600, scale: 1}],
    windows: [],
};

function fixture() {
    const captures = [];
    const views = [];
    const notifications = [];
    const calls = [];
    let config = {color: '#ff0000', width: 3, enterAction: 'copy', folder: '/old'};
    let runOutput = () => Promise.resolve();
    const session = new CaptureSession({
        capture: {capture() { const pending = deferred(); captures.push(pending); return pending.promise; }},
        createEditor: options => new Editor(options),
        createView: args => {
            const view = {
                ...args, opens: 0, destroys: 0, busy: [], errors: [],
                open() { this.opens++; },
                destroy() { this.destroys++; },
                setBusy(value) { this.busy.push(value); },
                showError(message) { this.errors.push(message); },
                withExportContent(callback) { return callback(); },
            };
            views.push(view);
            return view;
        },
        output: {
            save(...args) { calls.push({action: 'save', args}); return runOutput(); },
            copy(...args) { calls.push({action: 'copy', args}); return runOutput(); },
        },
        settings: () => config,
        notifyError: (...args) => notifications.push(args),
    });
    return {
        session, captures, views, notifications, calls,
        setConfig(value) { config = value; },
        setOutput(value) { runOutput = value; },
        async open() { const pending = session.open(); captures.at(-1).resolve(snapshot); await pending; return views.at(-1); },
    };
}

function select(view) {
    view.editor.selectMonitor({x: 10, y: 10});
    view.editor.addText({x: 20, y: 20}, 'note');
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
    const before = structuredClone({selection: view.editor.selection, annotations: view.editor.annotations});
    f.setOutput(() => Promise.reject(new Error('disk full')));
    await view.onExport('save');
    assert.deepEqual({selection: view.editor.selection, annotations: view.editor.annotations}, before);
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
    f.setConfig({color: '#00ff00', width: 6, enterAction: 'save', folder: '/first'});
    f.captures[0].resolve(snapshot);
    await opening;
    const view = f.views[0];
    assert.deepEqual(view.editor.style, {color: '#00ff00', width: 6});
    select(view);
    const latest = {color: '#0000ff', width: 9, enterAction: 'copy', folder: '/latest'};
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
    await Promise.resolve(); // export awaits snapshot.pixbufReady before calling output
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
        capture: {capture: async () => snapshot},
        createEditor: options => new Editor(options),
        createView: () => {
            const view = {destroyed: 0, open() { if (++attempts === 1) throw new Error('modal unavailable'); }, destroy() { this.destroyed++; }};
            views.push(view);
            return view;
        },
        output: {}, settings: () => ({color: '#f00', width: 3}),
        notifyError: (...args) => errors.push(args),
    });
    await session.open();
    assert.equal(views[0].destroyed, 1);
    assert.deepEqual(errors, [['Could not capture the screen', 'modal unavailable']]);
    await session.open();
    assert.equal(views.length, 2);
    assert.equal(views[1].destroyed, 0);
});

test('export waits for the background pixbuf before copying', async () => {
    const f = fixture();
    const opening = f.session.open();
    const pixbuf = deferred();
    f.captures[0].resolve({...snapshot, pixbufReady: pixbuf.promise});
    await opening;
    const view = f.views[0];
    select(view);
    const exporting = view.onExport('copy');
    assert.deepEqual(f.calls, []);
    pixbuf.resolve();
    await exporting;
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].action, 'copy');
});


test('GPU export only requests the pixbuf when pixelation needs it', async () => {
    for (const [engine, pixelate, expected] of [['gpu', false, false], ['gpu', true, true],
        ['compare', false, true], ['cairo', false, true]]) {
        const f = fixture();
        f.setConfig({color: '#f00', width: 3, exportEngine: engine});
        const opening = f.session.open();
        let requests = 0;
        const captured = {...snapshot, get pixbufReady() { requests++; return Promise.resolve(); }};
        f.captures[0].resolve(captured);
        await opening;
        const view = f.views[0];
        select(view);
        if (pixelate)
            view.editor.annotations.push({type: 'pixelate'});
        await view.onExport('copy');
        assert.equal(requests > 0, expected, `${engine}, pixelate=${pixelate}`);
        const operation = f.calls[0].args[4];
        assert.equal(operation.withExportContent(() => 'painted'), 'painted');
    }
});


test('GPU pixelation prepares cropped pixels without requesting the full pixbuf', async () => {
    const f = fixture();
    f.setConfig({color: '#f00', width: 3, exportEngine: 'gpu'});
    const opening = f.session.open();
    const pending = deferred();
    let preparedAnnotations;
    const captured = {...snapshot,
        get pixbufReady() { throw new Error('full pixbuf requested'); },
        ensurePixelation(annotations) { preparedAnnotations = annotations; return pending.promise; },
    };
    f.captures[0].resolve(captured);
    await opening;
    const view = f.views[0];
    select(view);
    view.editor.annotations.push({type: 'pixelate'});
    const exporting = view.onExport('copy');
    assert.equal(preparedAnnotations, view.editor.annotations);
    assert.equal(f.calls.length, 0);
    f.setConfig({exportEngine: 'cairo'});
    pending.resolve();
    await exporting;
    assert.equal(f.calls[0].args[4].engine, 'gpu');
});
