import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/ui/overlay.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export class Overlay', 'class Overlay') + '\nthis.Overlay = Overlay;';

function fixture({action = 'copy', timed = true, selection = true} = {}) {
    let now = 1000, complete;
    const calls = [];
    const Clutter = {EVENT_STOP: 'stop', EVENT_PROPAGATE: 'propagate',
        KEY_Return: 13, KEY_KP_Enter: 14, KEY_Escape: 27,
        KEY_c: 99, KEY_C: 67, KEY_s: 115, KEY_S: 83,
        ModifierType: {CONTROL_MASK: 1}};
    const Overlay = vm.runInNewContext(source, {Clutter,
        GLib: {get_monotonic_time() { calls.push('clock'); return now; }},
        console: {log: line => calls.push(line)}});
    const view = Object.create(Overlay.prototype);
    Object.assign(view, {_busy: false, _dragging: false, _textEdit: null,
        perfLog: () => timed, enterAction: () => action,
        editor: {selection: selection ? {} : null},
        _options: () => ({shift: false}),
        _finishText() { calls.push('text'); now += 200; },
        _refresh() { calls.push('refresh'); now += 300; },
        onExport(chosen, callback) {
            if (!view.editor.selection)
                return;
            calls.push(chosen);
            complete = callback;
        }});
    const event = (symbol = Clutter.KEY_Return, state = 0) => ({
        get_key_symbol() { now += 100; return symbol; }, get_state: () => state});
    return {view, calls, event, Clutter, deliver() { now += 2000; complete?.(); }};
}

for (const action of ['copy', 'save']) {
    test(`Enter dispatches configured ${action} and times through delivery`, () => {
        const {view, calls, event, deliver} = fixture({action});
        assert.equal(view._key(event()), 'stop');
        assert.deepEqual(calls, ['clock', 'text', 'refresh', action, 'refresh']);
        deliver();
        assert.deepEqual(calls.slice(-2), ['clock', 'mirx-perf export ms=2.9']);
    });
}

test('copy and save shortcuts use the same timed output path', () => {
    for (const [key, action] of [['KEY_c', 'copy'], ['KEY_s', 'save']]) {
        const {view, calls, event, Clutter, deliver} = fixture();
        view._key(event(Clutter[key], Clutter.ModifierType.CONTROL_MASK));
        assert.ok(calls.includes(action));
        deliver();
        assert.ok(calls.some(call => call.startsWith('mirx-perf export ms=')));
    }
});

test('disabled timing never reads the clock or logs export', () => {
    const {view, calls, event, deliver} = fixture({timed: false});
    view._key(event());
    deliver();
    assert.deepEqual(calls, ['text', 'refresh', 'copy', 'refresh']);
});

test('Enter without selection or when committing text does not report an export', () => {
    const noSelection = fixture({selection: false});
    noSelection.view._key(noSelection.event());
    noSelection.deliver();
    assert.equal(noSelection.calls.includes('copy'), false);
    assert.equal(noSelection.calls.some(call => call.startsWith('mirx-perf')), false);
    const editing = fixture();
    editing.view._textEdit = {};
    editing.view._key(editing.event());
    editing.deliver();
    assert.deepEqual(editing.calls, ['clock', 'text', 'refresh']);
});

test('busy key and toolbar export do no work; toolbar timing includes text commit', () => {
    const busy = fixture();
    busy.view._busy = true;
    busy.view._key(busy.event());
    busy.view._export('copy');
    assert.deepEqual(busy.calls, []);
    const toolbar = fixture();
    toolbar.view._export('save');
    toolbar.deliver();
    assert.deepEqual(toolbar.calls, ['clock', 'text', 'refresh', 'save', 'clock',
        'mirx-perf export ms=2.5']);
});
