import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = `${readFileSync(new URL('../src/ui/overlay.js', import.meta.url), 'utf8')
    .replace(/^import [^;]*;\n/gm, '')
    .replace('export class Overlay', 'class Overlay')}\nthis.Overlay = Overlay;`;

function fixture() {
    const calls = [];
    let now = 1000;
    const Overlay = vm.runInNewContext(source, {
        Clutter: { EVENT_STOP: 'stop', EVENT_PROPAGATE: 'propagate' },
        GLib: {
            get_monotonic_time() {
                calls.push('clock');
                return now;
            },
        },
        console: { log: (line) => calls.push(line) },
    });
    const view = Object.create(Overlay.prototype);
    Object.assign(view, {
        _busy: false,
        _dragging: true,
        perfLog: () => true,
        _pointOf() {
            calls.push('point');
            now += 200;
            return { x: 10, y: 20 };
        },
        _options: () => ({ shift: false }),
        _isControl: () => false,
        editor: {
            pointerMove() {
                calls.push('editor');
                now += 300;
            },
        },
        _refresh() {
            calls.push('refresh');
            now += 700;
        },
    });
    return { view, calls };
}

test('motion timing includes pointer translation, editor changes and actor refresh', () => {
    const { view, calls } = fixture();
    assert.equal(view._motion({}), 'stop');
    assert.deepEqual(calls, ['clock', 'point', 'editor', 'refresh', 'clock', 'mirx-perf motion ms=1.2']);
});

test('disabled perf logging does not read the clock or print motion lines', () => {
    const { view, calls } = fixture();
    view.perfLog = () => false;
    view._dragging = false;
    assert.equal(view._motion({}), 'propagate');
    assert.deepEqual(calls, ['point', 'editor', 'refresh']);
});

test('busy overlays ignore pointer motion without timing or refreshing it', () => {
    const { view, calls } = fixture();
    view._busy = true;
    assert.equal(view._motion({}), 'stop');
    assert.deepEqual(calls, []);
});
