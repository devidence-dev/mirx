import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {alignmentGuideGeometry} from '../src/rendering/alignmentGuideGeometry.js';
import {GUIDE_CODE, GUIDE_DECLARATIONS} from '../src/ui/shaders.js';

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
    Clutter: {Actor}, St: {Widget: Actor, DrawingArea: class { constructor() { assert.fail('DrawingArea used'); } }},
    Cogl: {Color: {from_string: color => [true, color]}, SnippetHook: {FRAGMENT: 2048}},
    Shell: {GLSLEffect: Effect}, GObject: {registerClass: klass => klass},
    alignmentGuideGeometry, GUIDE_CODE, GUIDE_DECLARATIONS,
    textureUniforms: () => ({textureSize: [10, 3], contentOffset: [0, 0], extent: [7, 3]}),
    setUniforms: (_effect, values) => uniforms.push(values),
});
const plain = value => JSON.parse(JSON.stringify(value));
const monitor = {x: 100, y: 50, width: 400, height: 300, scale: 2};

test('guides are inert and made of exactly two strips with the shader snippet', () => {
    const guides = new AlignmentGuides({scale: 2});
    assert.equal(guides.actor.reactive, false);
    assert.equal(guides.actor.can_focus, false);
    assert.equal(guides.actor.visible, false);
    assert.equal(guides.actor.children.length, 2);
    for (const strip of guides.actor.children) {
        assert.equal(strip.reactive, false);
        assert.equal(strip.effect.snippet[1], GUIDE_DECLARATIONS);
        assert.equal(strip.effect.snippet[2], GUIDE_CODE);
    }
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
    assert.deepEqual(plain(horizontal.effect.guide), {vertical: false, scale: 2, core: g.horizontal.core, dash: g.dash, period: g.period});
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
    const {guideVertical, guidePixel, guideDash, guidePeriod, guideCore} = uniforms[0];
    assert.deepEqual(plain([guideVertical, guideDash, guidePeriod]), [[1], [5], [10]]);
    assert.deepEqual(plain(guideCore), [vertical.effect.guide.core]);
    assert.ok(Math.abs(guidePixel[0] - 1.5) < 1e-9);
    assert.equal(vertical.effect.painted, true);
    horizontal.effect.vfunc_paint_target();
    assert.deepEqual(plain(uniforms[1].guideVertical), [0]);
});
