import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {arrowBars, rectangleGeometry} from '../src/rendering/actorGeometry.js';
import {Editor} from '../src/core/editor.js';
import {contains, physicalRect} from '../src/core/geometry.js';

class Actor {
    constructor(properties = {}) {
        Object.assign(this, properties);
        this.children = [];
        this.visible = true;
        this.writes = 0;
        this.repaints = 0;
        this.styleWrites = 0;
    }
    add_child(child) { child.parent = this; this.children.push(child); }
    set_child_above_sibling(child, sibling) {
        this.children.splice(this.children.indexOf(child), 1);
        this.children.splice(sibling ? this.children.indexOf(sibling) + 1 : 0, 0, child);
    }
    destroy() { this.destroyed = true; this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    set_clip(...value) { this.clip = value; this.writes++; }
    set_position(...value) { this.position = value; this.writes++; }
    set_size(...value) { this.size = value; this.writes++; }
    set_style(value) { this.style = value; this.writes++; this.styleWrites++; }
    set_pivot_point(...value) { this.pivot = value; this.writes++; }
    set_rotation_angle(...value) { this.rotation = value; this.writes++; }
    set_text(value) { this.text = value; this.writes++; }
    set_font_description(value) { this.font = value; this.writes++; }
    set_color(value) { this.color = value; this.writes++; }
    show() { this.visible = true; this.writes++; }
    hide() { this.visible = false; this.writes++; }
    connect() {}
    queue_repaint() { this.repaints++; }
    get_allocation_box() {}
}
const source = readFileSync(new URL('../src/ui/annotationActors.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export class AnnotationActors', 'class AnnotationActors') + '\nthis.AnnotationActors = AnnotationActors;';
const AnnotationActors = vm.runInNewContext(source, {
    Clutter: {Actor, Text: Actor, RotateAxis: {Z_AXIS: 2}},
    St: {Widget: Actor, DrawingArea: Actor}, Cogl: {Color: {from_string: color => [true, color]}},
    annotationBounds: a => ({x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
        width: Math.abs(a.x2 - a.x1), height: Math.abs(a.y2 - a.y1)}),
    renderAnnotations() {}, textFont: width => `Sans ${width}`, arrowBars, rectangleGeometry,
});
const selection = {x: 10, y: 20, width: 200, height: 100};
const item = (id, type) => ({id, type, x1: 30, y1: 40, x2: 90, y2: 80,
    width: 3, color: '#ff0000', text: 'hello\nworld'});
const create = () => new AnnotationActors({snapshot: {scale: 1}, width: 500, height: 400});
const plain = value => JSON.parse(JSON.stringify(value));

function writes(actor) { return actor.writes + actor.children.reduce((n, child) => n + writes(child), 0); }

test('mixed annotations retain model stacking order and a single selection clip', () => {
    const renderer = create();
    const annotations = ['rectangle', 'circle', 'arrow', 'pixelate', 'text', 'highlighter']
        .map((type, i) => item(i + 1, type));
    renderer.update(annotations, selection);
    assert.deepEqual(renderer.actor.children, annotations.map(a => renderer._entries.get(a.id).actor));
    assert.deepEqual(plain(renderer.actor.clip), selection && [10, 20, 200, 100]);
    renderer.update([...annotations].reverse(), {...selection, x: 25});
    assert.deepEqual(renderer.actor.children, [...annotations].reverse().map(a => renderer._entries.get(a.id).actor));
    assert.deepEqual(plain(renderer.actor.clip), [25, 20, 200, 100]);
});

test('mutation, style, and history snapshots update actors in place; removal and re-add create actors', () => {
    const renderer = create();
    const original = [item(1, 'rectangle'), item(2, 'arrow'), item(3, 'text')];
    renderer.update(original, selection);
    const actors = original.map(a => renderer._entries.get(a.id).actor);
    const changed = original.map(a => ({...a, x1: a.x1 + 7, width: 6, color: '#00ff00'}));
    renderer.update(changed, selection);
    assert.deepEqual(changed.map(a => renderer._entries.get(a.id).actor), actors);
    renderer.update(original.map(a => ({...a})), selection); // undo replaces model objects
    renderer.update(changed.map(a => ({...a})), selection); // redo
    assert.deepEqual(changed.map(a => renderer._entries.get(a.id).actor), actors);
    renderer.update(changed.slice(0, 2), selection);
    assert.equal(actors[2].destroyed, true);
    renderer.update(changed, selection);
    assert.notEqual(renderer._entries.get(3).actor, actors[2]);
});

test('editing hides only the existing text actor and restores its updated contents', () => {
    const renderer = create();
    const annotations = [item(1, 'text'), item(2, 'rectangle')];
    renderer.update(annotations, selection, 1);
    const text = renderer._entries.get(1).actor;
    assert.equal(text.visible, false);
    assert.equal(renderer._entries.get(2).actor.visible, true);
    renderer.update([{...annotations[0], text: 'changed\ntext'}, annotations[1]], selection);
    assert.equal(renderer._entries.get(1).actor, text);
    assert.equal(text.visible, true);
    assert.equal(text.text, 'changed\ntext');
});

test('unchanged mixed committed annotations cause no actor writes or fallback repaint', () => {
    const renderer = create();
    const annotations = ['rectangle', 'arrow', 'text', 'circle', 'pixelate'].map((type, i) => item(i, type));
    renderer.update(annotations, selection);
    const count = writes(renderer.actor);
    const repaints = renderer.actor.children.map(a => a.repaints);
    for (let i = 0; i < 10; i++) renderer.update(annotations, selection);
    assert.equal(writes(renderer.actor), count);
    assert.deepEqual(renderer.actor.children.map(a => a.repaints), repaints);
});

test('editor undo and redo create and destroy actors only when annotation ids enter or leave', () => {
    const editor = new Editor({monitors: [{x: 0, y: 0, width: 500, height: 400}]});
    editor.selectMonitor({x: 10, y: 10});
    editor.setTool('rectangle');
    editor.pointerDown({x: 50, y: 50});
    editor.pointerUp({x: 100, y: 100});
    const renderer = create();
    const update = () => renderer.update(editor.annotations, editor.selection);
    update();
    const id = editor.annotations[0].id;
    const first = renderer._entries.get(id).actor;
    editor.selectedId = id;
    editor.setStyle({width: 6, color: '#00ff00'});
    update();
    assert.equal(renderer._entries.get(id).actor, first);
    editor.undo();
    update();
    assert.equal(renderer._entries.get(id).actor, first);
    editor.redo();
    update();
    assert.equal(renderer._entries.get(id).actor, first);
    editor.deleteSelected();
    update();
    assert.equal(first.destroyed, true);
    editor.undo();
    update();
    const restored = renderer._entries.get(id).actor;
    assert.notEqual(restored, first);
    editor.redo();
    update();
    assert.equal(restored.destroyed, true);
});

test('rectangle pointer motions update only draft geometry and repaint no legacy canvas', () => {
    const overlaySource = readFileSync(new URL('../src/ui/overlay.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '')
        .replace('export class Overlay', 'class Overlay') + '\nthis.Overlay = Overlay;';
    const Overlay = vm.runInNewContext(overlaySource, {
        Clutter: {CursorType: {TEXT: 1, CROSSHAIR: 2, DEFAULT: 3}, EVENT_STOP: 1},
        contains, physicalRect,
    });
    const editor = new Editor({monitors: [{x: 0, y: 0, width: 500, height: 400, scale: 1}]});
    editor.selectMonitor({x: 10, y: 10});
    editor.annotations = ['rectangle', 'arrow', 'text', 'circle', 'pixelate'].map((type, i) => item(i + 10, type));
    editor.setTool('rectangle');
    editor.pointerDown({x: 100, y: 100});
    const view = Object.create(Overlay.prototype);
    const committed = create(), draft = create();
    Object.assign(view, {editor, perfLog: () => false, _busy: false, _dragging: true, _point: {x: 100, y: 100},
        _pointOf: event => event, _options: () => ({}), _isControl: () => false,
        snapshot: {monitors: editor.monitors}, actor: {set_cursor_type() {}},
        _toolbar: {update() {}, place() {}},
        _dimensions: {show() {}, get_preferred_width: () => [0, 1],
            get_preferred_height: () => [0, 1], set_position() {}},
        _hint: {hide() {}}, _magnifier: {update() {}}, _updateDecorations() {},
        _annotations: committed, _draft: draft, _annotationDecorations: {update() {}}});
    view._refresh();
    const before = writes(committed.actor);
    const canvasRepaints = committed.actor.children.map(a => a.repaints);
    const draftActor = draft._entries.get(editor.draft.id).actor;
    const draftWrites = draftActor.writes, styleWrites = draftActor.styleWrites;
    for (let i = 1; i <= 10; i++) view._motion({x: 100 + i * 5, y: 100 + i * 3});
    assert.equal(writes(committed.actor), before);
    assert.deepEqual(committed.actor.children.map(a => a.repaints), canvasRepaints);
    assert.equal(draft._entries.get(editor.draft.id).actor, draftActor);
    assert.ok(draftActor.writes > draftWrites);
    assert.equal(draftActor.styleWrites, styleWrites);
    assert.deepEqual(plain(draftActor.size), [53, 33]);
});

test('new screenshot pixels repaint pixelation without replacing any actor', () => {
    const renderer = create();
    const annotations = [item(1, 'rectangle'), item(2, 'pixelate'), item(3, 'circle')];
    renderer.update(annotations, selection);
    const actors = annotations.map(a => renderer._entries.get(a.id).actor);
    const counts = actors.map(a => a.repaints);
    renderer.invalidatePixels();
    renderer.update(annotations, selection);
    assert.deepEqual(annotations.map(a => renderer._entries.get(a.id).actor), actors);
    assert.deepEqual(actors.map(a => a.repaints), [counts[0], counts[1] + 1, counts[2]]);
});
