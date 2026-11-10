import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
    arrowBars,
    arrowBounds,
    contrastColor,
    effectTextureUniforms,
    ellipseUniforms,
    gradientShades,
    gradientUniforms,
    markerDisc,
    markerLabel,
    pixelateGeometry,
    pixelateUniforms,
    rectangleGeometry,
} from '../src/rendering/actorGeometry.js';
import * as shaders from '../src/ui/shaders.js';
import {
    ELLIPSE_CODE,
    ELLIPSE_DECLARATIONS,
    GRADIENT_DECLARATIONS,
    GRADIENT_RECOLOR_CODE,
    GRADIENT_RECOLOR_DECLARATIONS,
} from '../src/ui/shaders.js';
import { Editor, markerNumbers } from '../src/core/editor.js';
import { contains, markerRadius, physicalRect } from '../src/core/geometry.js';

class Actor {
    constructor(properties = {}) {
        Object.assign(this, properties);
        this.children = [];
        this.visible = true;
        this.writes = 0;
        this.repaints = 0;
        this.styleWrites = 0;
    }
    add_child(child) {
        child.parent = this;
        this.children.push(child);
    }
    set_child_above_sibling(child, sibling) {
        this.children.splice(this.children.indexOf(child), 1);
        this.children.splice(sibling ? this.children.indexOf(sibling) + 1 : 0, 0, child);
    }
    destroy() {
        this.destroyed = true;
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }
    set_clip(...value) {
        this.clip = value;
        this.writes++;
    }
    set_position(...value) {
        this.position = value;
        this.writes++;
    }
    set_size(...value) {
        this.size = value;
        [this.width, this.height] = value;
        this.writes++;
    }
    set_style(value) {
        this.style = value;
        this.writes++;
        this.styleWrites++;
    }
    set_pivot_point(...value) {
        this.pivot = value;
        this.writes++;
    }
    set_rotation_angle(...value) {
        this.rotation = value;
        this.writes++;
    }
    set_text(value) {
        this.text = value;
        this.writes++;
    }
    set_font_description(value) {
        this.font = value;
        this.writes++;
    }
    set_color(value) {
        this.color = value;
        this.writes++;
    }
    get_preferred_width() {
        return [0, 7 * String(this.text ?? '').length];
    }
    get_preferred_height() {
        return [0, 11];
    }
    show() {
        this.visible = true;
        this.writes++;
    }
    hide() {
        this.visible = false;
        this.writes++;
    }
    connect() {}
    queue_repaint() {
        this.repaints++;
    }
    queue_redraw() {
        this.redraws = (this.redraws ?? 0) + 1;
    }
    add_effect(effect) {
        this.effect = effect;
        effect.actor = this;
        this.effectAdds = (this.effectAdds ?? 0) + 1;
    }
    remove_effect(effect) {
        if (this.effect === effect) this.effect = undefined;
        this.effectRemoves = (this.effectRemoves ?? 0) + 1;
    }
    set_content_scaling_filters(...value) {
        this.filters = value;
    }
    get_resource_scale() {
        return this.resourceScale ?? 1;
    }
    get_allocation_box() {}
}
class Effect {
    constructor() {
        this.uniforms = {};
        this.vfunc_build_pipeline();
    }
    add_glsl_snippet(...value) {
        this.snippet = value;
    }
    get_uniform_location(name) {
        return name;
    }
    set_uniform_float(...args) {
        const [name, components, value] = args;
        assert.equal(args.length, 3);
        assert.equal(components, value.length);
        this.uniforms[name] = Array.from(value);
    }
    get_actor() {
        return this.actor;
    }
    get_texture() {
        const scale = this.actor.get_resource_scale();
        return {
            get_width: () => (Math.round(this.actor.width) + 3) * scale,
            get_height: () => (Math.round(this.actor.height) + 3) * scale,
        };
    }
    vfunc_paint_target() {
        this.paints = (this.paints ?? 0) + 1;
    }
}
const source =
    readFileSync(new URL('../src/ui/annotationActors.js', import.meta.url), 'utf8')
        .replace(/^import [^;]*;\n/gm, '')
        .replace(/^export function /gm, 'function ')
        .replace('export class AnnotationActors', 'class AnnotationActors') +
    '\nthis.AnnotationActors = AnnotationActors;';
const AnnotationActors = vm.runInNewContext(source, {
    Clutter: { Actor, Text: Actor, RotateAxis: { Z_AXIS: 2 }, ScalingFilter: { NEAREST: 0 } },
    St: {
        Widget: Actor,
        DrawingArea: class {
            constructor() {
                assert.fail('Annotation created a DrawingArea');
            }
        },
    },
    Cogl: { Color: { from_string: (color) => [true, color] }, SnippetHook: { FRAGMENT: 2048, TEXTURE_LOOKUP: 6145 } },
    Shell: { GLSLEffect: Effect },
    GObject: { registerClass: (klass) => klass },
    ...shaders,
    textFont: (width, size) => ({ width, size }),
    arrowBars,
    arrowBounds,
    rectangleGeometry,
    effectTextureUniforms,
    ellipseUniforms,
    pixelateGeometry,
    pixelateUniforms,
    markerDisc,
    markerLabel,
    markerRadius,
    markerNumbers,
    contrastColor,
    gradientShades,
    gradientUniforms,
});
const selection = { x: 10, y: 20, width: 200, height: 100 };
const item = (id, type) => ({
    id,
    type,
    x1: 30,
    y1: 40,
    x2: 90,
    y2: 80,
    width: 3,
    color: '#ff0000',
    text: 'hello\nworld',
});
const content = {};
const create = (snapshot = { scale: 1, content }) => new AnnotationActors({ snapshot, width: 500, height: 400 });
const plain = (value) => JSON.parse(JSON.stringify(value));

function writes(actor) {
    return actor.writes + actor.children.reduce((n, child) => n + writes(child), 0);
}

test('mixed annotations retain model stacking order and a single selection clip', () => {
    const renderer = create();
    const annotations = ['rectangle', 'circle', 'arrow', 'pixelate', 'text', 'highlighter'].map((type, i) =>
        item(i + 1, type),
    );
    renderer.update(annotations, selection);
    assert.deepEqual(
        renderer.actor.children,
        annotations.map((a) => renderer._entries.get(a.id).actor),
    );
    assert.deepEqual(plain(renderer.actor.clip), selection && [10, 20, 200, 100]);
    renderer.update([...annotations].reverse(), { ...selection, x: 25 });
    assert.deepEqual(
        renderer.actor.children,
        [...annotations].reverse().map((a) => renderer._entries.get(a.id).actor),
    );
    assert.deepEqual(plain(renderer.actor.clip), [25, 20, 200, 100]);
});

test('mutation, style, and history snapshots update actors in place; removal and re-add create actors', () => {
    const renderer = create();
    const original = ['rectangle', 'arrow', 'text', 'circle', 'pixelate'].map((type, i) => item(i + 1, type));
    renderer.update(original, selection);
    const actors = original.map((a) => renderer._entries.get(a.id).actor);
    const changed = original.map((a) => ({ ...a, x1: a.x1 + 7, width: 6, color: '#00ff00' }));
    renderer.update(changed, selection);
    assert.deepEqual(
        changed.map((a) => renderer._entries.get(a.id).actor),
        actors,
    );
    renderer.update(
        original.map((a) => ({ ...a })),
        selection,
    ); // undo replaces model objects
    renderer.update(
        changed.map((a) => ({ ...a })),
        selection,
    ); // redo
    assert.deepEqual(
        changed.map((a) => renderer._entries.get(a.id).actor),
        actors,
    );
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
    renderer.update([{ ...annotations[0], text: 'changed\ntext' }, annotations[1]], selection);
    assert.equal(renderer._entries.get(1).actor, text);
    assert.equal(text.visible, true);
    assert.equal(text.text, 'changed\ntext');
});

test('unchanged mixed committed annotations cause no actor writes or fallback repaint', () => {
    const renderer = create();
    const annotations = ['rectangle', 'arrow', 'text', 'circle', 'pixelate'].map((type, i) => item(i, type));
    renderer.update(annotations, selection);
    const count = writes(renderer.actor);
    const repaints = renderer.actor.children.map((a) => a.repaints);
    for (let i = 0; i < 10; i++) renderer.update(annotations, selection);
    assert.equal(writes(renderer.actor), count);
    assert.deepEqual(
        renderer.actor.children.map((a) => a.repaints),
        repaints,
    );
});

for (const type of ['rectangle', 'circle', 'pixelate'])
    test(`${type}: editor history creates and destroys actors only when ids enter or leave`, () => {
        const editor = new Editor({ monitors: [{ x: 0, y: 0, width: 500, height: 400 }] });
        editor.selectMonitor({ x: 10, y: 10 });
        editor.setTool(type);
        editor.pointerDown({ x: 50, y: 50 });
        editor.pointerUp({ x: 100, y: 100 });
        const renderer = create();
        const update = () => renderer.update(editor.annotations, editor.selection);
        update();
        const id = editor.annotations[0].id;
        const first = renderer._entries.get(id).actor;
        editor.selectedId = id;
        editor.setStyle({ width: 6, color: '#00ff00' });
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
    const overlaySource = `${readFileSync(new URL('../src/ui/overlay.js', import.meta.url), 'utf8')
        .replace(/^import [^;]*;\n/gm, '')
        .replace('export class Overlay', 'class Overlay')}\nthis.Overlay = Overlay;`;
    const Overlay = vm.runInNewContext(overlaySource, {
        Clutter: { CursorType: { TEXT: 1, CROSSHAIR: 2, DEFAULT: 3 }, EVENT_STOP: 1 },
        contains,
        physicalRect,
    });
    const editor = new Editor({ monitors: [{ x: 0, y: 0, width: 500, height: 400, scale: 1 }] });
    editor.selectMonitor({ x: 10, y: 10 });
    editor.annotations = ['rectangle', 'arrow', 'text', 'circle', 'pixelate'].map((type, i) => item(i + 10, type));
    editor.setTool('rectangle');
    editor.pointerDown({ x: 100, y: 100 });
    const view = Object.create(Overlay.prototype);
    const committed = create(),
        draft = create();
    Object.assign(view, {
        editor,
        perfLog: () => false,
        _busy: false,
        _dragging: true,
        _point: { x: 100, y: 100 },
        _pointOf: (event) => event,
        _options: () => ({}),
        _isControl: () => false,
        snapshot: { monitors: editor.monitors },
        actor: { set_cursor_type() {} },
        _toolbar: { update() {}, place() {} },
        _dimensions: {
            show() {},
            get_preferred_width: () => [0, 1],
            get_preferred_height: () => [0, 1],
            set_position() {},
        },
        _hint: { hide() {} },
        _magnifier: { update() {} },
        _guides: { update() {} },
        _updateDecorations() {},
        _annotations: committed,
        _draft: draft,
        _annotationDecorations: { update() {} },
    });
    view._refresh();
    const before = writes(committed.actor);
    const canvasRepaints = committed.actor.children.map((a) => a.repaints);
    const draftActor = draft._entries.get(editor.draft.id).actor;
    const draftWrites = draftActor.writes,
        styleWrites = draftActor.styleWrites;
    for (let i = 1; i <= 10; i++) view._motion({ x: 100 + i * 5, y: 100 + i * 3 });
    assert.equal(writes(committed.actor), before);
    assert.deepEqual(
        committed.actor.children.map((a) => a.repaints),
        canvasRepaints,
    );
    assert.equal(draft._entries.get(editor.draft.id).actor, draftActor);
    assert.ok(draftActor.writes > draftWrites);
    assert.equal(draftActor.styleWrites, styleWrites);
    assert.deepEqual(plain(draftActor.size), [53, 33]);
});

test('pixelate movement and resize reuse the frozen content without reading or preparing any JS pixels', () => {
    const snapshot = { scale: 4 / 3, content };
    for (const name of ['pixbuf', 'pixbufReady', 'pixelationPixbuf', 'ensurePixelation', 'ensurePixbuf'])
        Object.defineProperty(snapshot, name, {
            get() {
                assert.fail(`Read ${name}`);
            },
        });
    const renderer = create(snapshot);
    const annotation = item(1, 'pixelate');
    renderer.update([annotation], selection);
    const { actor, image, effect } = renderer._entries.get(1);
    assert.equal(image.content, content);
    assert.equal(actor.clip_to_allocation, true);
    assert.deepEqual(plain(image.size ?? [image.width, image.height]), [500, 400]);
    for (let i = 1; i <= 10; i++) {
        renderer.update([{ ...annotation, x1: annotation.x1 + i, x2: annotation.x2 + i * 2 }], selection);
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
    const { actor, effect, image } = renderer._entries.get(1);
    const ellipse = renderer._entries.get(2).actor;
    const before = ellipse.writes;
    renderer.update(annotations, { x: 50, y: 50, width: 200, height: 100 });
    assert.equal(renderer._entries.get(1).actor, actor);
    assert.deepEqual(plain(actor.position), [50, 50]);
    assert.deepEqual(plain(actor.size), [40, 30]);
    assert.deepEqual(plain(effect.geometry.anchor), [20, 10]);
    assert.deepEqual(plain(image.position), [-50, -50]);
    assert.equal(ellipse.writes, before);
    renderer.update(annotations, { x: 100, y: 100, width: 20, height: 20 });
    assert.equal(actor.visible, false);
    renderer.update(annotations, selection);
    assert.equal(actor.visible, true);
    assert.equal(renderer._entries.get(1).actor, actor);
});

test('shader callbacks use actual padded textures and ceiled resource scale before chaining paint', () => {
    const renderer = create({ scale: 4 / 3, content });
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
    assert.deepEqual(plain(ellipse.effect.uniforms), {
        textureSize: [132, 92],
        contentOffset: [4, 4],
        extent: [126, 86],
        radii: [60, 40],
        stroke: [6],
        antialias: [1.5],
        fill: [0],
        gradient: [0],
        ringColor: [1, 0, 0],
    });
    assert.deepEqual(plain(pixelate.effect.uniforms), {
        textureSize: [126, 86],
        contentOffset: [4, 4],
        extent: [120, 80],
        anchor: [0, 0],
        block: [24],
    });
});

test('ellipse shader declares fill and keeps the ring coverage as the default path', () => {
    assert.match(shaders.ELLIPSE_DECLARATIONS, /^uniform float fill;$/m);
    assert.match(shaders.ELLIPSE_CODE, /if \(fill > 0\.5\) \{/);
    assert.ok(
        shaders.ELLIPSE_CODE.includes(`float alpha = 1.0 - smoothstep(stroke * 0.5 - antialias * 0.5,
                              stroke * 0.5 + antialias * 0.5, distance);`),
    );
});

test('gradient shader strings declare each uniform once and call gradientColor', () => {
    const declared = (source, name) => source.match(new RegExp(`^uniform \\w+ ${name};$`, 'gm'))?.length ?? 0;
    const defined = (source) => source.match(/vec3 gradientColor\(/g)?.length ?? 0;
    const gradient = ['gradient', 'gradStart', 'gradEnd', 'gradFrom', 'gradTo'];
    for (const source of [ELLIPSE_DECLARATIONS, GRADIENT_RECOLOR_DECLARATIONS]) {
        assert.ok(source.includes(GRADIENT_DECLARATIONS));
        for (const name of gradient) assert.equal(declared(source, name), 1, name);
        for (const name of ['textureSize', 'contentOffset']) assert.ok(declared(source, name) <= 1, name);
        assert.equal(defined(source), 1);
    }
    assert.doesNotMatch(GRADIENT_DECLARATIONS, /gradMid/);
    assert.equal(declared(ELLIPSE_DECLARATIONS, 'extent'), 1);
    assert.doesNotMatch(GRADIENT_DECLARATIONS, /\b(textureSize|contentOffset|extent)\b/);
    assert.ok(ELLIPSE_CODE.includes('gradientColor(p + extent * 0.5, ringColor)'));
    assert.ok(GRADIENT_RECOLOR_CODE.includes('gradientColor('));
});

test('ellipse antialiasing follows the selected monitor scale', () => {
    const renderer = create({ scale: 2, content, monitors: [{ x: 0, y: 0, width: 500, height: 400, scale: 4 / 3 }] });
    renderer.update([item(1, 'circle')], selection);
    const actor = renderer._entries.get(1).actor;
    actor.resourceScale = 2;
    actor.effect.vfunc_paint_target({}, {});
    assert.deepEqual(plain(actor.effect.uniforms.antialias), [1.5]);
});

test('degenerate ellipses hide and a Shift circle follows the unchanged editor model', () => {
    const renderer = create();
    const annotation = item(1, 'circle');
    renderer.update([{ ...annotation, x2: annotation.x1 }], selection);
    const actor = renderer._entries.get(1).actor;
    assert.equal(actor.visible, false);
    renderer.update([{ ...annotation, y2: annotation.y1 }], selection);
    assert.equal(actor.visible, false);
    renderer.update([annotation], selection);
    assert.equal(actor.visible, true);
    const editor = new Editor({ monitors: [{ x: 0, y: 0, width: 500, height: 400 }] });
    editor.selectMonitor({ x: 10, y: 10 });
    editor.setTool('circle');
    editor.pointerDown({ x: 50, y: 50 });
    editor.pointerUp({ x: 100, y: 80 }, { shift: true });
    renderer.update(editor.annotations, editor.selection);
    const circle = renderer._entries.get(editor.annotations[0].id).actor;
    circle.effect.vfunc_paint_target({}, {});
    assert.equal(circle.effect.uniforms.radii[0], circle.effect.uniforms.radii[1]);
});

const marker = (id, x1 = 30, color = '#ff0000') => ({
    id,
    type: 'marker',
    x1,
    y1: 40,
    x2: x1,
    y2: 40,
    width: 3,
    color,
});
const label = (renderer, id) => renderer._entries.get(id).label;

test('markers: one container per id, relabelled in place after an earlier delete', () => {
    // The harness throws if a St.DrawingArea is created, so marker creation covers that rule.
    const renderer = create();
    const markers = [marker(1), marker(2, 60), marker(3, 90)];
    renderer.update(markers, selection);
    const actors = markers.map((m) => renderer._entries.get(m.id).actor);
    assert.deepEqual(
        markers.map((m) => label(renderer, m.id).text),
        ['1', '2', '3'],
    );
    const kept = [markers[1], markers[2]];
    renderer.update(kept, selection);
    assert.deepEqual(
        kept.map((m) => renderer._entries.get(m.id).actor),
        actors.slice(1),
    );
    assert.deepEqual(
        kept.map((m) => label(renderer, m.id).text),
        ['1', '2'],
    );
    assert.equal(actors[0].destroyed, true);
    renderer.update([...kept, marker(4, 120)], selection);
    assert.equal(label(renderer, 4).text, '3');
});

test('markers: restyling resizes the disc about the same centre and switches the label contrast', () => {
    const renderer = create();
    renderer.update([marker(1)], selection);
    const entry = renderer._entries.get(1);
    assert.deepEqual(plain(entry.disc.position), [17, 27]);
    assert.deepEqual(plain(entry.disc.size), [26, 26]);
    assert.equal(label(renderer, 1).color, '#ffffff');
    renderer.update([{ ...marker(1), width: 6, color: '#ffffff' }], selection);
    assert.equal(renderer._entries.get(1), entry);
    assert.deepEqual(plain(entry.disc.position), [5, 15]);
    assert.deepEqual(plain(entry.disc.size), [50, 50]);
    assert.equal(label(renderer, 1).color, '#000000');
    assert.deepEqual(plain(label(renderer, 1).font), { width: 6, size: markerLabel(24, 1).fontSize });
    assert.deepEqual(plain(entry.effect.color), [1, 1, 1]);
});

test('markers: unchanged markers cause no writes, and the disc is drawn by the ellipse shader with fill', () => {
    const renderer = create();
    const markers = [marker(1), marker(2, 60)];
    renderer.update(markers, selection);
    const count = writes(renderer.actor);
    for (let i = 0; i < 10; i++) renderer.update(markers, selection);
    assert.equal(writes(renderer.actor), count);
    const { actor, disc, effect } = renderer._entries.get(1);
    assert.equal(disc.effect, effect);
    assert.equal(actor.effect, undefined);
    disc.resourceScale = 2;
    effect.vfunc_paint_target({}, {});
    assert.deepEqual(plain(effect.uniforms.fill), [1]);
    assert.deepEqual(plain(effect.uniforms.radii), [24, 24]);
    assert.deepEqual(plain(effect.uniforms.ringColor), [1, 0, 0]);
    assert.deepEqual(plain(effect.uniforms.gradient), [0]);
    assert.equal(effect.uniforms.gradStart, undefined);
});

const assertNear = (actual, expected) => {
    assert.equal(actual.length, expected.length);
    actual.forEach((value, i) => {
        assert.ok(Math.abs(value - expected[i]) < 1e-10, `${actual} vs ${expected}`);
    });
};

test('gradient ellipse and marker disc write the axis, shades and flag at resource scales 1, 2 and 4/3', () => {
    const renderer = create();
    renderer.update(
        [
            { ...item(1, 'circle'), gradient: true },
            { ...marker(2, 60, '#00ff00'), gradient: true },
        ],
        selection,
    );
    const circle = renderer._entries.get(1),
        dot = renderer._entries.get(2);
    for (const scale of [1, 2, 4 / 3]) {
        circle.actor.resourceScale = scale;
        dot.disc.resourceScale = scale;
        circle.effect.vfunc_paint_target({}, {});
        dot.effect.vfunc_paint_target({}, {});
        // Ellipse box is 63 x 43 logical px; the disc square is 26 x 26.
        assertNear(circle.effect.uniforms.gradient, [1]);
        assertNear(circle.effect.uniforms.gradStart, [0, 0]);
        assertNear(circle.effect.uniforms.gradEnd, [63 * scale, 43 * scale]);
        for (const [name, key] of [
            ['gradFrom', 'from'],
            ['gradTo', 'to'],
        ])
            assertNear(circle.effect.uniforms[name], gradientShades('#ff0000')[key]);
        assertNear(dot.effect.uniforms.gradient, [1]);
        assertNear(dot.effect.uniforms.gradStart, [0, 0]);
        assertNear(dot.effect.uniforms.gradEnd, [26 * scale, 26 * scale]);
        for (const [name, key] of [
            ['gradFrom', 'from'],
            ['gradTo', 'to'],
        ])
            assertNear(dot.effect.uniforms[name], gradientShades('#00ff00')[key]);
        assert.deepEqual(plain(dot.effect.uniforms.ringColor), [0, 1, 0]);
    }
});

test('markers: the label never has an effect, flat or gradient, and only the disc is shaded', () => {
    for (const annotation of [marker(1), { ...marker(1), gradient: true }]) {
        const renderer = create();
        renderer.update([annotation], selection);
        const entry = renderer._entries.get(1);
        assert.equal(entry.label.effect, undefined);
        assert.equal(entry.disc.effect, entry.effect);
    }
});

test('markers: label is centred on its preferred size and snapped to the physical pixel grid', () => {
    const renderer = create();
    renderer.update([marker(1)], selection);
    // Label size is 7 x 11, so its top-left is (26.5, 34.5) before snapping.
    assert.deepEqual(plain(label(renderer, 1).position), [27, 35]);
    assert.deepEqual(plain(label(renderer, 1).size), [7, 11]);
    const scaled = create({ scale: 4 / 3, content });
    scaled.update([marker(1)], selection);
    const [x, y] = label(scaled, 1).position;
    assert.ok(Math.abs(x - 26.25) < 1e-9, `x ${x}`);
    assert.ok(Math.abs(y - 34.5) < 1e-9, `y ${y}`);
});

test('markers: a soft shadow sits under the label, one physical pixel lower, and hides on black numbers', () => {
    const renderer = create();
    renderer.update([marker(1)], selection);
    const entry = renderer._entries.get(1);
    const { shadow } = entry;
    assert.ok(entry.actor.children.indexOf(shadow) < entry.actor.children.indexOf(entry.label));
    assert.equal(shadow.effect, undefined);
    assert.equal(shadow.text, entry.label.text);
    assert.deepEqual(plain(shadow.font), plain(entry.label.font));
    assert.equal(shadow.color, '#00000059');
    assert.deepEqual(plain(shadow.size), plain(entry.label.size));
    assert.equal(shadow.visible, true);
    assert.deepEqual(plain(shadow.position), [27, 36]);
    const scaled = create({ scale: 4 / 3, content });
    scaled.update([marker(1)], selection);
    const s = scaled._entries.get(1);
    assert.ok(Math.abs(s.shadow.position[1] - s.label.position[1] - 0.75) < 1e-9);
    renderer.update([{ ...marker(1), color: '#ffffff' }], selection);
    assert.equal(shadow.visible, false);
    assert.equal(entry.label.color, '#000000');
});

test('markers: export prepares the disc, which is the shader actor', () => {
    const renderer = create();
    renderer.update([marker(1)], selection);
    let prepared = 0;
    renderer._entries.get(1).disc.get_allocation_box = () => {
        prepared++;
    };
    renderer.prepareExport();
    assert.equal(prepared, 1);
});

const gradientOf = (annotation, id = 1) => ({ ...item(id, annotation), gradient: true });
// Replace snippet: the recolour samples the texture and takes the alpha St already painted.
const recolourSnippet = [2048, GRADIENT_RECOLOR_DECLARATIONS, GRADIENT_RECOLOR_CODE, true];

test('recolour shader samples its texture before writing cogl_color_out', () => {
    assert.ok(GRADIENT_RECOLOR_DECLARATIONS.includes('uniform sampler2D tex;'));
    assert.ok(GRADIENT_RECOLOR_CODE.includes('texture2D(tex'));
    assert.ok(GRADIENT_RECOLOR_CODE.includes('texel.a'));
    assert.ok(GRADIENT_RECOLOR_CODE.indexOf('cogl_color_out') === GRADIENT_RECOLOR_CODE.indexOf('cogl_color_out ='));
});

test('gradient rectangles and arrows get one recolour effect, and the harness never creates a DrawingArea', () => {
    const renderer = create();
    renderer.update([gradientOf('rectangle', 1), gradientOf('arrow', 2)], selection);
    for (const id of [1, 2]) {
        const { actor, effect } = renderer._entries.get(id);
        assert.equal(actor.effect, effect);
        assert.equal(actor.effectAdds, 1);
        assert.deepEqual(effect.snippet, recolourSnippet);
    }
});

test('gradient recolour effect is reused while the gradient stays on', () => {
    const renderer = create();
    const annotations = [gradientOf('rectangle', 1), gradientOf('arrow', 2)];
    renderer.update(annotations, selection);
    const effects = annotations.map((a) => renderer._entries.get(a.id).effect);
    renderer.update(
        annotations.map((a) => ({ ...a, x1: a.x1 + 5, color: '#00ff00' })),
        selection,
    );
    assert.deepEqual(
        annotations.map((a) => renderer._entries.get(a.id).effect),
        effects,
    );
    for (const a of annotations) assert.equal(renderer._entries.get(a.id).actor.effectAdds, 1);
    assert.equal(effects[0].annotation.x1, 35);
    assert.deepEqual(plain(effects[0].shades), plain(gradientShades('#00ff00')));
});

for (const type of ['rectangle', 'arrow'])
    test(`${type}: turning the gradient off removes the effect and turning it on again adds a fresh one`, () => {
        const renderer = create();
        const annotation = gradientOf(type);
        renderer.update([annotation], selection);
        const { actor, effect: first } = renderer._entries.get(1);
        renderer.update([{ ...annotation, gradient: false }], selection);
        assert.equal(actor.effect, undefined);
        assert.equal(actor.effectRemoves, 1);
        assert.equal(renderer._entries.get(1).effect, null);
        renderer.update([annotation], selection);
        const { effect } = renderer._entries.get(1);
        assert.notEqual(effect, first);
        assert.equal(actor.effect, effect);
        assert.equal(actor.effectAdds, 2);
    });

test('flat rectangles and arrows never get a recolour effect, and a flat ellipse keeps only its own', () => {
    const renderer = create();
    renderer.update(
        ['rectangle', 'arrow', 'circle'].map((type, i) => item(i + 1, type)),
        selection,
    );
    for (const id of [1, 2]) {
        const { actor, effect } = renderer._entries.get(id);
        assert.equal(actor.effect, undefined);
        assert.equal(actor.effectAdds, undefined);
        assert.equal(effect, null);
    }
    assert.equal(renderer._entries.get(3).actor.effect.snippet[2], ELLIPSE_CODE);
});

test('highlighter, text and pixelate never get a recolour effect, even with the gradient flag set', () => {
    const renderer = create();
    renderer.update(
        ['highlighter', 'text', 'pixelate'].map((type, i) => gradientOf(type, i + 1)),
        selection,
    );
    for (const id of [1, 2, 3]) {
        const { actor, effect } = renderer._entries.get(id);
        assert.notEqual(actor.effect?.snippet?.[2], GRADIENT_RECOLOR_CODE);
        assert.notEqual(effect?.snippet?.[2], GRADIENT_RECOLOR_CODE);
    }
});

test('arrow container takes the arrowBounds box, and each bar keeps its stage position in every direction', () => {
    const renderer = create();
    const arrows = [
        [30, 40, 90, 80],
        [90, 80, 30, 40],
        [90, 40, 30, 80],
        [30, 80, 90, 40],
        [60, 60, 60, 20],
    ].map(([x1, y1, x2, y2], i) => ({ ...item(i + 1, 'arrow'), x1, y1, x2, y2 }));
    renderer.update(arrows, selection);
    for (const arrow of arrows) {
        const { actor, bars } = renderer._entries.get(arrow.id);
        const bounds = arrowBounds(arrow);
        assert.deepEqual(plain(actor.position), [bounds.x, bounds.y]);
        assert.deepEqual(plain(actor.size), [bounds.width, bounds.height]);
        arrowBars(arrow).forEach((bar, i) => {
            const part = bars[i];
            assertNear([actor.position[0] + part.position[0], actor.position[1] + part.position[1]], [bar.x, bar.y]);
            assert.deepEqual(plain(part.size), [bar.width, bar.height]);
            assert.deepEqual(plain(part.pivot), [bar.pivotX, bar.pivotY]);
            assert.equal(part.rotation[1], bar.angle);
        });
    }
});

test('unchanged gradient rectangles and arrows cause no actor writes over repeated updates', () => {
    const renderer = create();
    const annotations = [gradientOf('rectangle', 1), gradientOf('arrow', 2)];
    renderer.update(annotations, selection);
    const count = writes(renderer.actor);
    const redraws = annotations.map((a) => renderer._entries.get(a.id).actor.redraws);
    for (let i = 0; i < 10; i++) renderer.update(annotations, selection);
    assert.equal(writes(renderer.actor), count);
    assert.deepEqual(
        annotations.map((a) => renderer._entries.get(a.id).actor.redraws),
        redraws,
    );
});

test('gradient rectangle recolour writes the axis, shades and flag, not extent, at resource scales 1, 2 and 4/3', () => {
    const renderer = create();
    renderer.update([{ ...gradientOf('rectangle'), color: '#ff0000' }], selection);
    const { actor, effect } = renderer._entries.get(1);
    // Rectangle box is 63 x 43 logical px (stroke included); the texture carries a 2 px offset.
    for (const scale of [1, 2, 4 / 3]) {
        actor.resourceScale = scale;
        effect.vfunc_paint_target({}, {});
        assert.deepEqual(Object.keys(effect.uniforms).sort(), [
            'contentOffset',
            'gradEnd',
            'gradFrom',
            'gradStart',
            'gradTo',
            'gradient',
            'textureSize',
        ]);
        assertNear(effect.uniforms.textureSize, [66 * scale, 46 * scale]);
        assertNear(effect.uniforms.contentOffset, [2 * scale, 2 * scale]);
        assertNear(effect.uniforms.gradient, [1]);
        assertNear(effect.uniforms.gradStart, [0, 0]);
        assertNear(effect.uniforms.gradEnd, [63 * scale, 43 * scale]);
        assertNear(effect.uniforms.gradFrom, gradientShades('#ff0000').from);
        assertNear(effect.uniforms.gradTo, gradientShades('#ff0000').to);
    }
});

test('gradient arrow recolour uses the axis relative to the bounds origin at resource scales 1, 2 and 4/3', () => {
    const renderer = create();
    const arrow = gradientOf('arrow');
    renderer.update([arrow], selection);
    const { actor, effect } = renderer._entries.get(1);
    const bounds = arrowBounds(arrow);
    for (const scale of [1, 2, 4 / 3]) {
        actor.resourceScale = scale;
        effect.vfunc_paint_target({}, {});
        assert.deepEqual(Object.keys(effect.uniforms).sort(), [
            'contentOffset',
            'gradEnd',
            'gradFrom',
            'gradStart',
            'gradTo',
            'gradient',
            'textureSize',
        ]);
        assertNear(effect.uniforms.gradStart, [(30 - bounds.x) * scale, (40 - bounds.y) * scale]);
        assertNear(effect.uniforms.gradEnd, [(90 - bounds.x) * scale, (80 - bounds.y) * scale]);
        assertNear(effect.uniforms.gradient, [1]);
    }
});
