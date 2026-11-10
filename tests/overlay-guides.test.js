import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { Editor } from '../src/core/editor.js';
import { contains, handles, physicalRect } from '../src/core/geometry.js';
import { decorationRect } from '../src/ui/decorations.js';

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
    set_cursor_type() {}
    set_position() {}
    set_size() {}
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
            CursorType: { TEXT: 1, CROSSHAIR: 2, DEFAULT: 3 },
            ModifierType: { SHIFT_MASK: 1 },
            EventType: { KEY_PRESS: 1, MOTION: 2, BUTTON_RELEASE: 3 },
        },
        GLib: {},
        Shell: {},
        St: { Widget: Actor, Label: Actor },
        global: { get_pointer: () => [10, 20], stage: { width: 2080, height: 820, get_event_actor: () => null } },
        contains,
        handles,
        physicalRect,
        decorationRect,
        textFont: () => 'Sans',
        AnnotationActors: Stub,
        DecorationActors: Stub,
        Toolbar: Stub,
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
        overlay._frame,
        ...overlay._handles,
        overlay._dimensions,
        overlay._hint,
        overlay._error,
        overlay._toolbar.actor,
        overlay._magnifier.actor,
    ])
        assert.ok(index(above) > guides);
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
    overlay._press(event(200, 120)); // interior move
    assert.equal(editor.interaction, 'selection-move');
    assertShared(f, false);
    overlay._motion(event(210, 130));
    assertShared(f, false);
    overlay._release(event(210, 130));
    assertShared(f, false);
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
});
