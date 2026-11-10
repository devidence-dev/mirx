import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {alignmentGuideGeometry} from '../src/rendering/alignmentGuideGeometry.js';
import {GUIDE_CODE, GUIDE_DECLARATIONS, RING_CODE, RING_DECLARATIONS} from '../src/ui/shaders.js';

class Actor {
    constructor(properties = {}) { Object.assign(this, properties); this.children = []; this.writes = 0; this.redraws = 0; this.visible = properties.visible ?? true; }
    add_child(child) { this.children.push(child); }
    add_effect(effect) { this.effect = effect; effect.actor = this; }
    set_position(...value) { this.position = value; this.writes++; }
    set_size(...value) { this.size = value; this.writes++; }
    queue_redraw() { this.redraws++; }
    get_resource_scale() { return this.resourceScale ?? 1; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    get_preferred_width() { return [0, 40]; }
    get_preferred_height() { return [0, 30]; }
}
class Effect {
    constructor() { this.vfunc_build_pipeline(); }
    add_glsl_snippet(...value) { this.snippet = value; }
    get_actor() { return this.actor; }
    vfunc_paint_target() { this.painted = true; }
}
const uniforms = [];
const source = readFileSync(new URL('../src/ui/alignmentGuides.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export class AlignmentGuides', 'class AlignmentGuides') + '\nthis.AlignmentGuides = AlignmentGuides;';
const AlignmentGuides = vm.runInNewContext(source, {
    Clutter: {Actor}, St: {Widget: Actor, Label: Actor, DrawingArea: class { constructor() { assert.fail('DrawingArea used'); } }},
    Cogl: {Color: {from_string: color => [true, color]}, SnippetHook: {FRAGMENT: 2048}},
    Shell: {GLSLEffect: Effect}, GObject: {registerClass: klass => klass},
    alignmentGuideGeometry, GUIDE_CODE, GUIDE_DECLARATIONS, RING_CODE, RING_DECLARATIONS,
    textureUniforms: () => ({textureSize: [10, 3], contentOffset: [0, 0], extent: [7, 3]}),
    setUniforms: (_effect, values) => uniforms.push(values),
});
const plain = value => JSON.parse(JSON.stringify(value));
const monitor = {x: 100, y: 50, width: 400, height: 300, scale: 2};

test('guides are inert and made of two strips and a ring with their shader snippets', () => {
    const guides = new AlignmentGuides({scale: 2});
    assert.equal(guides.actor.reactive, false);
    assert.equal(guides.actor.can_focus, false);
    assert.equal(guides.actor.visible, false);
    assert.equal(guides.actor.children.length, 4);
    const [horizontal, vertical, ring] = guides.actor.children;
    for (const strip of [horizontal, vertical]) {
        assert.equal(strip.reactive, false);
        assert.equal(strip.effect.snippet[1], GUIDE_DECLARATIONS);
        assert.equal(strip.effect.snippet[2], GUIDE_CODE);
        // The texture alpha masks the uneven offscreen padding, so the halo is symmetric.
        assert.ok(GUIDE_DECLARATIONS.includes('uniform sampler2D tex;') && GUIDE_CODE.includes('* coverage *'));
    }
    assert.equal(ring.reactive, false);
    assert.equal(ring.effect.snippet[1], RING_DECLARATIONS);
    assert.equal(ring.effect.snippet[2], RING_CODE);
});

test('the coordinates label is the last child of a clipped container, above the ring, and inert', () => {
    const guides = new AlignmentGuides({scale: 2});
    assert.equal(guides.actor.clip_to_allocation, true);
    assert.equal(guides.actor.children[2].effect.snippet[2], RING_CODE);
    const label = guides.actor.children.at(-1);
    assert.equal(label, guides._label);
    assert.equal(label.style_class, 'mirx-cursor-coordinates');
    assert.equal(label.reactive, false);
});

test('coordinates: x above y, +14/+12 from the cursor, snapped to physical pixels', () => {
    const guides = new AlignmentGuides({scale: 2});
    guides.update({x: 99.6, y: 49.9}, monitor, true);
    assert.equal(guides._label.text, 'x: 99\ny: 49');
    // Monitor-local cursor (-0.4, -0.1): -0.4 + 14 = 13.6 -> 13.5, -0.1 + 12 = 11.9 -> 12 at scale 2.
    assert.deepEqual(guides._label.position, [13.5, 12]);
    guides.update({x: 150.3, y: 90.7}, {...monitor, scale: 4 / 3}, true);
    const snap = v => Math.round(v * 4 / 3) / (4 / 3);
    assert.deepEqual(guides._label.position, [snap(50.3 + 14), snap(40.7 + 12)]);
});

test('coordinates flip to the left and above near the right and bottom edges', () => {
    const guides = new AlignmentGuides({scale: 1});
    const m = {x: 100, y: 50, width: 400, height: 300, scale: 1};
    guides.update({x: 100 + 380, y: 50 + 100}, m, true); // 380 + 14 + 40 > 400
    assert.deepEqual(guides._label.position, [380 - 14 - 40, 100 + 12]);
    guides.update({x: 100 + 100, y: 50 + 280}, m, true); // 280 + 12 + 30 > 300
    assert.deepEqual(guides._label.position, [100 + 14, 280 - 12 - 30]);
    guides.update({x: 100 + 380, y: 50 + 280}, m, true);
    assert.deepEqual(guides._label.position, [380 - 14 - 40, 280 - 12 - 30]);
});

test('the label is reused and only rewritten when the key changes', () => {
    const guides = new AlignmentGuides({scale: 2});
    const label = guides._label;
    guides.update({x: 150.3, y: 90.7}, monitor, true);
    const writes = label.writes;
    guides.update({x: 150.3, y: 90.7}, monitor, true);
    assert.equal(label.writes, writes);
    guides.update({x: 190, y: 120}, monitor, true);
    assert.equal(guides.actor.children.at(-1), label);
    assert.equal(label.text, 'x: 190\ny: 120');
});

test('the label hides with the container', () => {
    const guides = new AlignmentGuides({scale: 2});
    guides.update({x: 150, y: 90}, monitor, true);
    assert.equal(guides.actor.visible, true);
    guides.update({x: 150, y: 90}, monitor, false);
    assert.equal(guides.actor.visible, false);
    assert.equal(guides.actor.children.at(-1), guides._label);
});

test('hidden without a monitor or when not visible, shown and placed on the monitor otherwise', () => {
    const guides = new AlignmentGuides({scale: 2});
    guides.update({x: 150, y: 90}, null, true);
    assert.equal(guides.actor.visible, false);
    guides.update({x: 150, y: 90}, monitor, true);
    assert.equal(guides.actor.visible, true);
    assert.deepEqual(guides.actor.position, [100, 50]);
    assert.deepEqual(guides.actor.size, [400, 300]);
    guides.update({x: 150, y: 90}, monitor, false);
    assert.equal(guides.actor.visible, false);
    guides.update({x: 150, y: 90}, monitor, true);
    guides.update({x: 150, y: 90}, undefined, true);
    assert.equal(guides.actor.visible, false);
});

test('strips follow the geometry and are reused, not recreated or rewritten when unchanged', () => {
    const guides = new AlignmentGuides({scale: 2});
    const strips = [...guides.actor.children];
    const point = {x: 150.3, y: 90.7};
    guides.update(point, monitor, true);
    const g = alignmentGuideGeometry(point, monitor, 2);
    const [horizontal, vertical] = guides.actor.children;
    assert.deepEqual(horizontal.position, [g.horizontal.x, g.horizontal.y]);
    assert.deepEqual(horizontal.size, [g.horizontal.width, g.horizontal.height]);
    assert.deepEqual(vertical.position, [g.vertical.x, g.vertical.y]);
    assert.deepEqual(vertical.size, [g.vertical.width, g.vertical.height]);
    assert.deepEqual(plain(horizontal.effect.guide), {vertical: false, scale: 2, core: g.horizontal.core});
    assert.equal(vertical.effect.guide.vertical, true);
    const writes = vertical.writes, redraws = vertical.redraws;
    guides.update({...point}, monitor, true);
    assert.equal(vertical.writes, writes);
    assert.equal(vertical.redraws, redraws);
    guides.update({x: 190, y: 120}, {...monitor, x: 0, y: 0, scale: 1}, true);
    assert.deepEqual(guides.actor.children, strips);
    assert.deepEqual(guides.actor.position, [0, 0]);
    assert.equal(vertical.effect.guide.scale, 1);
});

test('the effect uploads physical-pixel uniforms for its strip when painted', () => {
    const guides = new AlignmentGuides({scale: 2});
    guides.update({x: 150, y: 90}, {...monitor, scale: 4 / 3}, true);
    const [horizontal, vertical] = guides.actor.children;
    vertical.resourceScale = 2;
    uniforms.length = 0;
    vertical.effect.vfunc_paint_target();
    const {guideVertical, guidePixel, guideCore} = uniforms[0];
    assert.deepEqual(plain(guideVertical), [1]);
    assert.equal('guideDash' in uniforms[0] || 'guidePeriod' in uniforms[0], false);
    assert.deepEqual(plain(guideCore), [vertical.effect.guide.core]);
    assert.ok(Math.abs(guidePixel[0] - 1.5) < 1e-9);
    assert.equal(vertical.effect.painted, true);
    horizontal.effect.vfunc_paint_target();
    assert.deepEqual(plain(uniforms[1].guideVertical), [0]);
});

test('ring follows the geometry and is reused, not recreated or rewritten when unchanged', () => {
    const guides = new AlignmentGuides({scale: 2});
    const ring = guides.actor.children[2];
    const point = {x: 150.3, y: 90.7};
    guides.update(point, monitor, true);
    const g = alignmentGuideGeometry(point, monitor, 2);
    assert.deepEqual(ring.position, [g.ring.x, g.ring.y]);
    assert.deepEqual(ring.size, [g.ring.size, g.ring.size]);
    assert.deepEqual(plain(ring.effect.ring), {...plain(g.ring), scale: 2});
    const writes = ring.writes, redraws = ring.redraws;
    guides.update({...point}, monitor, true);
    assert.equal(ring.writes, writes);
    assert.equal(ring.redraws, redraws);
    guides.update({x: 190, y: 120}, {...monitor, x: 0, y: 0, scale: 1}, true);
    assert.equal(guides.actor.children.length, 4);
    assert.equal(guides.actor.children[2], ring);
    const moved = alignmentGuideGeometry({x: 190, y: 120}, {...monitor, x: 0, y: 0, scale: 1}, 2);
    assert.deepEqual(ring.position, [moved.ring.x, moved.ring.y]);
    assert.equal(ring.effect.ring.scale, 1);
});

test('the ring hides with the container when not visible or without a monitor', () => {
    const guides = new AlignmentGuides({scale: 2});
    const ring = guides.actor.children[2];
    guides.update({x: 150, y: 90}, monitor, true);
    assert.equal(guides.actor.visible, true);
    guides.update({x: 150, y: 90}, monitor, false);
    assert.equal(guides.actor.visible, false);
    guides.update({x: 150, y: 90}, monitor, true);
    guides.update({x: 150, y: 90}, null, true);
    assert.equal(guides.actor.visible, false);
    guides.update({x: 150, y: 90}, monitor, true);
    assert.equal(guides.actor.visible, true);
    assert.equal(guides.actor.children[2], ring);
});

test('the ring effect uploads physical-pixel uniforms when painted', () => {
    const guides = new AlignmentGuides({scale: 2});
    const point = {x: 150, y: 90};
    guides.update(point, {...monitor, scale: 4 / 3}, true);
    const ring = guides.actor.children[2];
    const g = alignmentGuideGeometry(point, {...monitor, scale: 4 / 3}, 2);
    ring.resourceScale = 2;
    uniforms.length = 0;
    ring.effect.vfunc_paint_target();
    const [values] = uniforms;
    assert.deepEqual(plain([values.ringHalf, values.ringRadius, values.ringInner, values.ringOuter]),
        [[g.ring.half], [g.ring.radius], [g.ring.inner], [g.ring.outer]]);
    assert.ok(Math.abs(values.ringPixel[0] - 1.5) < 1e-9);
    assert.equal(ring.effect.painted, true);
});
