import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { cursorFor } from '../src/ui/cursorModel.js';
import { contains, physicalRect } from '../src/core/geometry.js';

const source = `${readFileSync(new URL('../src/ui/overlay.js', import.meta.url), 'utf8')
    .replace(/^import [^;]*;\n/gm, '')
    .replace('export class Overlay', 'class Overlay')}\nthis.Overlay = Overlay;`;

function fixture() {
    const calls = [];
    let now = 1000;
    const Overlay = vm.runInNewContext(source, {
        Clutter: { EVENT_STOP: 'stop', EVENT_PROPAGATE: 'propagate' },
        global: { stage: { get_event_actor: () => null } },
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
        _controlAt: () => null,
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

function cursorFixture() {
    class Button {
        constructor(parent, reactive = true, insensitive = false) {
            Object.assign(this, { parent, reactive, insensitive });
        }
        get_parent() {
            return this.parent;
        }
        has_style_pseudo_class(name) {
            return name === 'insensitive' && this.insensitive;
        }
    }
    const toolbar = {
        contains(actor) {
            return actor === this || actor?.toolbar === this;
        },
        hide() {},
    };
    const button = new Button(toolbar);
    button.toolbar = toolbar;
    const label = { toolbar, get_parent: () => button };
    const disabled = new Button(toolbar, true, true);
    disabled.toolbar = toolbar;
    const text = { contains: (actor) => actor === text };
    let picked = null;
    const cursors = Object.fromEntries(
        ['POINTER', 'MOVE', 'CROSSHAIR', 'TEXT', 'DEFAULT', 'NS_RESIZE', 'EW_RESIZE', 'NWSE_RESIZE', 'NESW_RESIZE'].map(
            (name) => [name, name],
        ),
    );
    const Overlay = vm.runInNewContext(source, {
        Clutter: { CursorType: cursors, PickMode: { REACTIVE: 1 } },
        St: { Button },
        cursorFor,
        contains,
        physicalRect,
        global: { stage: { get_actor_at_pos: () => picked, get_event_actor: () => picked } },
    });
    const view = Object.create(Overlay.prototype);
    const monitor = { x: 0, y: 0, width: 500, height: 400, scale: 1 };
    const noop = () => {};
    const actor = {
        show: noop,
        hide: noop,
        set_position: noop,
        get_preferred_width: () => [0, 20],
        get_preferred_height: () => [0, 10],
    };
    Object.assign(view, {
        _point: { x: 100, y: 100 },
        _busy: false,
        _dragging: false,
        _selectionDrag: false,
        _textEdit: null,
        snapshot: { monitors: [monitor] },
        editor: {
            selection: { x: 20, y: 20, width: 300, height: 300 },
            monitor,
            style: {},
            annotations: [],
            hitTarget: () => ({ kind: 'selection' }),
            pointerMove: noop,
        },
        actor: {
            set_cursor_type(value) {
                view.cursor = value;
            },
        },
        _toolbar: { actor: toolbar, update: noop, place: noop },
        _tooltip: { hideNow: noop },
        _dimensions: { ...actor },
        _hint: { ...actor },
        _magnifier: { update: noop },
        _guides: { update: noop },
        _annotations: { update: noop },
        _draft: { update: noop },
        _annotationDecorations: { update: noop },
        _updateDecorations: noop,
        _options: () => ({}),
        perfLog: () => false,
        _pointOf: () => ({ x: 100, y: 100 }),
    });
    return {
        view,
        toolbar,
        button,
        label,
        disabled,
        text,
        pick: (actor) => {
            picked = actor;
        },
    };
}

test('refresh resolves cursors and repicks controls after placement and tool changes', () => {
    const f = cursorFixture();
    const { view } = f;
    for (const [handle, expected] of Object.entries({
        n: 'NS_RESIZE',
        s: 'NS_RESIZE',
        e: 'EW_RESIZE',
        w: 'EW_RESIZE',
        nw: 'NWSE_RESIZE',
        se: 'NWSE_RESIZE',
        ne: 'NESW_RESIZE',
        sw: 'NESW_RESIZE',
        start: 'MOVE',
    })) {
        view.editor.hitTarget = () => ({ kind: 'selection-handle', handle });
        view._refresh();
        assert.equal(view.cursor, expected);
    }
    view.editor.hitTarget = () => ({ kind: 'selection' });
    view._refresh();
    assert.equal(view.cursor, 'MOVE');
    view.editor.hitTarget = () => ({ kind: 'annotation' });
    view._refresh();
    assert.equal(view.cursor, 'MOVE');
    view.editor.hitTarget = () => ({ kind: 'canvas' });
    view.editor.tool = 'arrow';
    view._refresh();
    assert.equal(view.cursor, 'CROSSHAIR');
    view.editor.tool = 'text';
    view._refresh();
    assert.equal(view.cursor, 'TEXT');
    view.editor.hitTarget = () => ({ kind: 'outside' });
    view._refresh();
    assert.equal(view.cursor, 'DEFAULT');
    f.pick(f.label);
    view._refresh();
    assert.equal(view.cursor, 'POINTER');
    f.pick(f.disabled);
    view._refresh();
    assert.equal(view.cursor, 'DEFAULT');
    f.pick(f.toolbar);
    view._refresh();
    assert.equal(view.cursor, 'DEFAULT');
    view._textEdit = { actor: f.text };
    f.pick(f.text);
    view._refresh();
    assert.equal(view.cursor, 'TEXT');
    f.pick(f.button);
    view._refresh();
    assert.equal(view.cursor, 'POINTER');
    view.editor.interaction = 'selection-resize';
    view.editor.interactionHandle = 'se';
    view._refresh();
    assert.equal(view.cursor, 'NWSE_RESIZE');
});
