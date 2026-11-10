import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {arrowBars, effectTextureUniforms, ellipseUniforms, pixelateGeometry, pixelateUniforms, rectangleGeometry} from '../src/rendering/actorGeometry.js';
import * as shaders from '../src/ui/shaders.js';
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
    set_size(...value) { this.size = value; [this.width, this.height] = value; this.writes++; }
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
    queue_redraw() { this.redraws = (this.redraws ?? 0) + 1; }
    add_effect(effect) { this.effect = effect; effect.actor = this; }
    set_content_scaling_filters(...value) { this.filters = value; }
    get_resource_scale() { return this.resourceScale ?? 1; }
    get_allocation_box() {}
}
class Effect {
    constructor() { this.uniforms = {}; this.vfunc_build_pipeline(); }
    add_glsl_snippet(...value) { this.snippet = value; }
    get_uniform_location(name) { return name; }
    set_uniform_float(name, components, value) {
        assert.equal(arguments.length, 3);
        assert.equal(components, value.length);
        this.uniforms[name] = Array.from(value);
    }
    get_actor() { return this.actor; }
    get_texture() {
        const scale = this.actor.get_resource_scale();
        return {get_width: () => (Math.round(this.actor.width) + 3) * scale,
            get_height: () => (Math.round(this.actor.height) + 3) * scale};
    }
    vfunc_paint_target() { this.paints = (this.paints ?? 0) + 1; }
}
const source = readFileSync(new URL('../src/ui/annotationActors.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export class AnnotationActors', 'class AnnotationActors') + '\nthis.AnnotationActors = AnnotationActors;';
const AnnotationActors = vm.runInNewContext(source, {
    Clutter: {Actor, Text: Actor, RotateAxis: {Z_AXIS: 2}, ScalingFilter: {NEAREST: 0}},
    St: {Widget: Actor, DrawingArea: class { constructor() { assert.fail('Annotation created a DrawingArea'); } }},
    Cogl: {Color: {from_string: color => [true, color]}, SnippetHook: {FRAGMENT: 2048, TEXTURE_LOOKUP: 6145}},
    Shell: {GLSLEffect: Effect}, GObject: {registerClass: klass => klass}, ...shaders,
    textFont: width => `Sans ${width}`, arrowBars, rectangleGeometry,
    effectTextureUniforms, ellipseUniforms, pixelateGeometry, pixelateUniforms,
});
const selection = {x: 10, y: 20, width: 200, height: 100};
const item = (id, type) => ({id, type, x1: 30, y1: 40, x2: 90, y2: 80,
    width: 3, color: '#ff0000', text: 'hello\nworld'});
const content = {};
const create = (snapshot = {scale: 1, content}) => new AnnotationActors({snapshot, width: 500, height: 400});
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
    const original = ['rectangle', 'arrow', 'text', 'circle', 'pixelate'].map((type, i) => item(i + 1, type));
    renderer.update(original, selection);
    const actors = original.map(a => renderer._entries.get(a.id).actor);
    const changed = original.map(a => ({...a, x1: a.x1 + 7, width: 6, color: '#00ff00'}));
    renderer.update(changed, selection);
    assert.deepEqual(changed.map(a => renderer._entries.get(a.id).actor), actors);
    renderer.update(original.map(a => ({...a})), selection); // undo replaces model objects
    renderer.update(changed.map(a => ({...a})), selection); // redo
    assert.deepEqual(changed.map(a => renderer._entries.get(a.id).actor), actors);
    renderer.update(changed.slice(0, 2), selection);
    for (const actor of actors.slice(2)) assert.equal(actor.destroyed, true);
    renderer.update(changed, selection);
    for (let i = 2; i < actors.length; i++) assert.notEqual(renderer._entries.get(i + 1).actor, actors[i]);
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

for (const type of ['rectangle', 'circle', 'pixelate']) test(`${type}: editor history creates and destroys actors only when ids enter or leave`, () => {
    const editor = new Editor({monitors: [{x: 0, y: 0, width: 500, height: 400}]});
    editor.selectMonitor({x: 10, y: 10});
    editor.setTool(type);
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

test('pixelate movement and resize reuse the frozen content without reading or preparing any JS pixels', () => {
    const snapshot = {scale: 4 / 3, content};
    for (const name of ['pixbuf', 'pixbufReady', 'pixelationPixbuf', 'ensurePixelation', 'ensurePixbuf'])
        Object.defineProperty(snapshot, name, {get() { assert.fail(`Read ${name}`); }});
    const renderer = create(snapshot);
    const annotation = item(1, 'pixelate');
    renderer.update([annotation], selection);
    const {actor, image, effect} = renderer._entries.get(1);
    assert.equal(image.content, content);
    assert.equal(actor.clip_to_allocation, true);
    assert.deepEqual(plain(image.size ?? [image.width, image.height]), [500, 400]);
    for (let i = 1; i <= 10; i++) {
        renderer.update([{...annotation, x1: annotation.x1 + i, x2: annotation.x2 + i * 2}], selection);
        assert.equal(renderer._entries.get(1).actor, actor);
        assert.equal(actor.effect, effect);
        assert.deepEqual(plain(image.position), [-30 - i, -40]);
        assert.equal(actor.repaints, 0);
    }
    assert.equal(actor.redraws, 11);
});

test('selection clipping updates pixelate bounds and anchor in place, leaving other actors untouched', () => {
    const renderer = create();
    const annotations = [item(1, 'pixelate'), item(2, 'circle')];
    renderer.update(annotations, selection);
    const {actor, effect, image} = renderer._entries.get(1);
    const ellipse = renderer._entries.get(2).actor;
    const before = ellipse.writes;
    renderer.update(annotations, {x: 50, y: 50, width: 200, height: 100});
    assert.equal(renderer._entries.get(1).actor, actor);
    assert.deepEqual(plain(actor.position), [50, 50]);
    assert.deepEqual(plain(actor.size), [40, 30]);
    assert.deepEqual(plain(effect.geometry.anchor), [20, 10]);
    assert.deepEqual(plain(image.position), [-50, -50]);
    assert.equal(ellipse.writes, before);
    renderer.update(annotations, {x: 100, y: 100, width: 20, height: 20});
    assert.equal(actor.visible, false);
    renderer.update(annotations, selection);
    assert.equal(actor.visible, true);
    assert.equal(renderer._entries.get(1).actor, actor);
});

test('shader callbacks use actual padded textures and ceiled resource scale before chaining paint', () => {
    const renderer = create({scale: 4 / 3, content});
    renderer.update([item(1, 'circle'), item(2, 'pixelate')], selection);
    const ellipse = renderer._entries.get(1).actor;
    const pixelate = renderer._entries.get(2).actor;
    for (const actor of [ellipse, pixelate]) {
        actor.resourceScale = 2;
        actor.effect.vfunc_paint_target({}, {});
        assert.equal(actor.effect.paints, 1);
        assert.equal(actor.effect.snippet[0], actor === ellipse ? 2048 : 6145);
        assert.equal(actor.effect.snippet[3], true);
    }
    assert.deepEqual(plain(ellipse.effect.uniforms), {textureSize: [132, 92], contentOffset: [4, 4],
        extent: [126, 86], radii: [60, 40], stroke: [6], antialias: [1.5], ringColor: [1, 0, 0]});
    assert.deepEqual(plain(pixelate.effect.uniforms), {textureSize: [126, 86], contentOffset: [4, 4],
        extent: [120, 80], anchor: [0, 0], block: [24]});
});

test('ellipse antialiasing follows the selected monitor scale', () => {
    const renderer = create({scale: 2, content,
        monitors: [{x: 0, y: 0, width: 500, height: 400, scale: 4 / 3}]});
    renderer.update([item(1, 'circle')], selection);
    const actor = renderer._entries.get(1).actor;
    actor.resourceScale = 2;
    actor.effect.vfunc_paint_target({}, {});
    assert.deepEqual(plain(actor.effect.uniforms.antialias), [1.5]);
});

test('degenerate ellipses hide and a Shift circle follows the unchanged editor model', () => {
    const renderer = create();
    const annotation = item(1, 'circle');
    renderer.update([{...annotation, x2: annotation.x1}], selection);
    const actor = renderer._entries.get(1).actor;
    assert.equal(actor.visible, false);
    renderer.update([{...annotation, y2: annotation.y1}], selection);
    assert.equal(actor.visible, false);
    renderer.update([annotation], selection);
    assert.equal(actor.visible, true);
    const editor = new Editor({monitors: [{x: 0, y: 0, width: 500, height: 400}]});
    editor.selectMonitor({x: 10, y: 10});
    editor.setTool('circle');
    editor.pointerDown({x: 50, y: 50});
    editor.pointerUp({x: 100, y: 80}, {shift: true});
    renderer.update(editor.annotations, editor.selection);
    const circle = renderer._entries.get(editor.annotations[0].id).actor;
    circle.effect.vfunc_paint_target({}, {});
    assert.equal(circle.effect.uniforms.radii[0], circle.effect.uniforms.radii[1]);
});
