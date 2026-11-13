import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { Editor } from '../src/core/editor.js';
import { contains, handles, physicalRect } from '../src/core/geometry.js';
import { decorationRect } from '../src/ui/decorations.js';
import { cursorFor } from '../src/ui/cursorModel.js';

class Actor {
    constructor(properties = {}) {
        Object.assign(this, properties);
        this.children = [];
        this.visible ??= true;
        this.text = '';
    }
    add_child(child) {
        this.children.push(child);
    }
    connect() {}
    contains(other) {
        return other === this || this.children.some((child) => child.contains(other));
    }
    destroy() {
        this.destroyed = true;
        this.children.forEach((child) => {
            child.destroy();
        });
    }
    get_preferred_width() {
        return [0, 50];
    }
    get_preferred_height() {
        return [0, 10];
    }
    set_cursor_type(value) {
        this.cursor = value;
    }
    set_position(x, y) {
        this.position = [x, y];
    }
    set_size(width, height) {
        this.size = [width, height];
    }
    show() {
        this.visible = true;
    }
    hide() {
        this.visible = false;
    }
    grab_key_focus() {}
    get clutter_text() {
        return { set_line_wrap() {} };
    }
}
class Aid {
    constructor() {
        this.actor = new Actor({ reactive: false });
        this.calls = [];
    }
    update(point, monitor, visible) {
        this.calls.push({ point, monitor, visible });
    }
}
class Stub {
    constructor() {
        this.actor = new Actor();
    }
    update() {}
    place() {}
    hideNow() {
        this.hides = (this.hides ?? 0) + 1;
        this.actor.hide();
    }
    destroy() {
        this.actor.destroy();
    }
}
const source = `${readFileSync(new URL('../src/ui/overlay.js', import.meta.url), 'utf8')
    .replace(/^import [^;]*;\n/gm, '')
    .replace('export class Overlay', 'class Overlay')}\nthis.Overlay = Overlay;`;

const monitors = [
    { x: 0, y: 0, width: 800, height: 600, scale: 2 },
    { x: 800, y: 100, width: 1280, height: 720, scale: 4 / 3 },
];
function fixture() {
    const pointerMoves = [];
    const Overlay = vm.runInNewContext(source, {
        Clutter: {
            Actor,
            EVENT_STOP: 'stop',
            EVENT_PROPAGATE: 'propagate',
            BUTTON_PRIMARY: 1,
            CursorType: { TEXT: 1, CROSSHAIR: 2, DEFAULT: 3, NONE: 4, NWSE_RESIZE: 5 },
            PickMode: { REACTIVE: 1 },
            ModifierType: { SHIFT_MASK: 1 },
            EventType: { KEY_PRESS: 1, MOTION: 2, BUTTON_RELEASE: 3 },
        },
        GLib: {},
        Shell: {},
        St: { Widget: Actor, Label: Actor },
        global: {
            get_pointer: () => [10, 20],
            stage: { width: 2080, height: 820, get_event_actor: () => null, get_actor_at_pos: () => null },
        },
        contains,
        handles,
        physicalRect,
        decorationRect,
        cursorFor,
        textFont: () => 'Sans',
        AnnotationActors: Stub,
        DecorationActors: Stub,
        Toolbar: Stub,
        Tooltip: Stub,
        Magnifier: Aid,
        AlignmentGuides: Aid,
        console,
    });
    const editor = new Editor({ monitors });
    const original = editor.pointerMove.bind(editor);
    editor.pointerMove = (point, options) => {
        pointerMoves.push({ ...point });
        original(point, options);
    };
    const overlay = new Overlay({
        snapshot: { monitors, scale: 2, content: {} },
        editor,
        onCancel() {},
        onExport() {},
        enterAction: () => 'copy',
    });
    editor.pointerMove(overlay._point);
    overlay._refresh();
    return { overlay, editor, magnifier: overlay._magnifier, guides: overlay._guides, pointerMoves };
}
const event = (x, y) => ({ get_coords: () => [x, y], get_button: () => 1, get_time: () => 0, get_state: () => 0 });
const last = (aid) => aid.calls[aid.calls.length - 1];
const plain = (value) => JSON.parse(JSON.stringify(value));

function assertShared({ magnifier, guides }, visible) {
    const [m, g] = [last(magnifier), last(guides)];
    assert.equal(m.visible, visible);
    assert.equal(g.visible, visible);
    assert.equal(g.point, m.point);
    assert.equal(g.monitor, m.monitor);
    assert.equal(magnifier.calls.length, guides.calls.length);
}

test('guides sit above annotations and shades, below frame, handles, labels, toolbar and magnifier', () => {
    const { overlay } = fixture();
    const order = overlay.actor.children;
    const index = (actor) => order.indexOf(actor);
    const guides = index(overlay._guides.actor);
    assert.ok(guides >= 0);
    for (const below of [
        ...overlay._shades,
        overlay._annotations.actor,
        overlay._draft.actor,
        overlay._annotationDecorations.actor,
    ])
        assert.ok(index(below) < guides);
    for (const above of [
        overlay._frameRing,
        overlay._frame,
        ...overlay._handles,
        overlay._dimensions,
        overlay._hint,
        overlay._error,
        overlay._toolbar.actor,
        overlay._tooltip.actor,
        overlay._magnifier.actor,
    ])
        assert.ok(index(above) > guides);
    assert.ok(index(overlay._toolbar.actor) < index(overlay._tooltip.actor));
    assert.ok(index(overlay._tooltip.actor) < index(overlay._magnifier.actor));
});

test('state matrix: initial, creation, completion, interior move, resize, tools, text, busy', () => {
    const f = fixture();
    const { overlay, editor } = f;
    assertShared(f, true); // initial, falls back to the integer point
    assert.deepEqual(plain(last(f.guides).point), { x: 10, y: 20 });
    overlay._motion(event(100.5, 50.25));
    assertShared(f, true);
    assert.deepEqual(plain(last(f.guides).point), { x: 100.5, y: 50.25 }); // fractional pointer
    overlay._press(event(100.5, 50.25));
    assertShared(f, true);
    overlay._motion(event(300.7, 200.2));
    assertShared(f, true);
    overlay._release(event(300.7, 200.2));
    assert.deepEqual(plain(editor.selection), { x: 100, y: 50, width: 200, height: 150 });
    assertShared(f, false);
    overlay._press(event(200, 120)); // idle: an interior press does nothing
    assert.equal(editor.interaction, null);
    assertShared(f, false);
    overlay._release(event(200, 120));
    editor.setTool('select');
    overlay._press(event(200, 120)); // interior move needs Select and move
    assert.equal(editor.interaction, 'selection-move');
    assertShared(f, false);
    overlay._motion(event(210, 130));
    assertShared(f, false);
    overlay._release(event(210, 130));
    assertShared(f, false);
    editor.setTool(null);
    const { x, y, width, height } = editor.selection;
    overlay._press(event(x + width, y + height)); // resize by the south-east handle
    assert.equal(editor.interaction, 'selection-resize');
    assertShared(f, true);
    overlay._motion(event(x + width + 20.5, y + height + 10.5));
    assertShared(f, true);
    overlay._release(event(x + width + 20.5, y + height + 10.5));
    assertShared(f, false);
    editor.setTool('rectangle'); // annotation tool
    overlay._refresh();
    assertShared(f, false);
    overlay._press(event(150, 100)); // drawing is not a selection drag
    assertShared(f, false);
    overlay._release(event(160, 110));
    const corner = handles(editor.selection)[0];
    overlay._press(event(corner.x, corner.y)); // tool active, but resizing the selection
    assert.equal(editor.interaction, 'selection-resize');
    assertShared(f, true);
    overlay._release(event(corner.x, corner.y));
    editor.setTool(null);
    overlay._textEdit = { actor: new Actor() };
    overlay._refresh();
    assertShared(f, false);
    overlay._textEdit = null;
    overlay._refresh();
    assertShared(f, false); // a completed selection stays hidden
    editor.selection = null;
    overlay._refresh();
    assertShared(f, true);
    overlay._textEdit = { actor: new Actor() };
    overlay._refresh();
    assertShared(f, false);
    overlay._textEdit = null;
    overlay.setBusy(true);
    assertShared(f, false);
    overlay.setBusy(false);
    assertShared(f, true);
    editor.selectMonitor({ x: 10, y: 10 }); // selecting a monitor hides both aids
    overlay._refresh();
    assertShared(f, false);
});

test('monitor transitions and no monitor are passed identically to both aids', () => {
    const f = fixture();
    f.overlay._motion(event(100.5, 50.5));
    assert.equal(last(f.guides).monitor, monitors[0]);
    assertShared(f, true);
    f.overlay._motion(event(900.25, 300.75));
    assert.equal(last(f.guides).monitor, monitors[1]);
    assertShared(f, true);
    f.overlay._motion(event(5000, 5000));
    assert.equal(last(f.guides).monitor, undefined);
    assert.equal(last(f.magnifier).monitor, undefined);
    assertShared(f, true);
    f.overlay._motion(event(10.5, 10.5));
    assert.equal(last(f.guides).monitor, monitors[0]);
});

test('the custom capture cross suppresses the platform crosshair only while it is visible', () => {
    const { overlay, editor } = fixture();
    assert.equal(overlay.actor.cursor, 4); // one GPU cross at session start
    overlay._press(event(100, 50));
    overlay._motion(event(300, 200));
    assert.equal(overlay.actor.cursor, 4); // selection drag
    overlay._motion(event(900, 300));
    assert.equal(overlay.actor.cursor, 4); // another monitor
    overlay._motion(event(5000, 5000));
    assert.equal(overlay.actor.cursor, 2); // no monitor: the custom aid cannot be drawn
    overlay._motion(event(300, 200));
    assert.equal(overlay.actor.cursor, 4);
    overlay._release(event(300, 200));
    overlay._motion(event(200, 120));
    assert.equal(overlay.actor.cursor, 3); // idle inside completed selection
    editor.setTool('rectangle');
    overlay._refresh();
    assert.equal(overlay.actor.cursor, 2); // annotation drawing uses its regular crosshair
    overlay._press(event(300, 200));
    assert.equal(editor.interaction, 'selection-resize');
    assert.equal(overlay.actor.cursor, 5); // custom aid does not suppress the resize cursor
});

test('busy and text-edit transitions restore the platform cursor without pointer motion', () => {
    const { overlay } = fixture();
    assert.equal(overlay.actor.cursor, 4);
    overlay.setBusy(true);
    assert.equal(overlay.actor.cursor, 2);
    overlay.setBusy(false);
    assert.equal(overlay.actor.cursor, 4);
    overlay._textEdit = { actor: new Actor() };
    overlay._refresh();
    assert.equal(overlay.actor.cursor, 2);
    overlay._textEdit = null;
    overlay._refresh();
    assert.equal(overlay.actor.cursor, 4);
    overlay.destroy();
    assert.equal(overlay.actor.destroyed, true); // suppression belongs to the destroyed actor
});

test('dragging onto another monitor moves the aids but keeps the selection on the first one', () => {
    const f = fixture();
    f.overlay._press(event(500, 300));
    f.overlay._motion(event(1200.5, 400.25));
    assert.equal(last(f.guides).monitor, monitors[1]);
    assertShared(f, true);
    f.overlay._release(event(1200.5, 400.25));
    assert.equal(f.editor.monitor, monitors[0]);
    const { x, y, width, height } = f.editor.selection;
    assert.ok(x >= 0 && y >= 0 && x + width <= 800 && y + height <= 600);
    assertShared(f, false);
});

test('guides never receive input and the editor gets the same points as without them', () => {
    const f = fixture();
    f.pointerMoves.length = 0;
    f.overlay._motion(event(100.5, 50.25));
    f.overlay._press(event(100.5, 50.25));
    f.overlay._motion(event(300.7, 200.2));
    assert.deepEqual(f.pointerMoves, [
        { x: 100, y: 50 },
        { x: 300, y: 200 },
    ]);
    assert.equal(f.overlay._guides.actor.reactive, false);
});

test('destroying the overlay destroys the guides and leaves none visible', () => {
    const f = fixture();
    f.overlay.destroy();
    assert.equal(f.overlay._guides.actor.destroyed, true);
    assert.equal(f.overlay._tooltip.actor.destroyed, true);
    assert.equal(f.overlay._toolbar.actor.destroyed, true);
});

test('selection loss and busy state immediately hide the tooltip', () => {
    const { overlay, editor } = fixture();
    editor.selectMonitor({ x: 10, y: 10 });
    overlay._refresh();
    overlay._tooltip.actor.show();
    overlay.setBusy(true);
    assert.equal(overlay._tooltip.actor.visible, false);
    overlay._tooltip.actor.show();
    editor.selection = null;
    overlay._refresh();
    assert.equal(overlay._tooltip.actor.visible, false);
    assert.equal(overlay._toolbar.actor.visible, false);
});

test('selection frame keeps its bounds and 10 px handles stay centred', () => {
    const { overlay, editor } = fixture();
    editor.selectMonitor({ x: 10, y: 10 });
    overlay._refresh();
    const selection = editor.selection;
    assert.deepEqual(overlay._frame.position, [selection.x, selection.y]);
    assert.deepEqual(overlay._frame.size, [selection.width, selection.height]);
    // The dark ring sits one pixel outside the frame and below it, never over the selection interior.
    assert.deepEqual(overlay._frameRing.position, [selection.x - 1, selection.y - 1]);
    assert.deepEqual(overlay._frameRing.size, [selection.width + 2, selection.height + 2]);
    assert.ok(overlay.actor.children.indexOf(overlay._frameRing) < overlay.actor.children.indexOf(overlay._frame));
    handles(selection).forEach((point, index) => {
        const handle = overlay._handles[index];
        assert.equal(handle.width, 10);
        assert.equal(handle.height, 10);
        assert.deepEqual(handle.position, [point.x - 5, point.y - 5]);
    });
});
