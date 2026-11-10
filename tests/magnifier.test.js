import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { MASK_CODE, MASK_DECLARATIONS } from '../src/ui/shaders.js';

class Actor {
    constructor(properties = {}) {
        Object.assign(this, properties);
        this.children = [];
        this.effects = [];
    }
    add_child(child) {
        this.children.push(child);
    }
    add_effect(effect) {
        this.effects.push(effect);
        effect.actor = this;
    }
    get_resource_scale() {
        return this.resourceScale ?? 1;
    }
    set_content_scaling_filters(...filters) {
        this.filters = filters;
    }
    set_scale(...scale) {
        this.scale = scale;
    }
    set_position(...position) {
        this.position = position;
    }
    set_size(...size) {
        this.size = size;
    }
    show() {
        this.visible = true;
    }
    hide() {
        this.visible = false;
    }
}
class Effect {
    constructor() {
        this.vfunc_build_pipeline();
    }
    add_glsl_snippet(...value) {
        this.snippet = value;
    }
    get_actor() {
        return this.actor;
    }
    vfunc_paint_target() {
        this.painted = true;
    }
}
const uniforms = [];
const source =
    readFileSync(new URL('../src/ui/magnifier.js', import.meta.url), 'utf8')
        .replace(/^import [^;]*;\n/gm, '')
        .replace('export class Magnifier', 'class Magnifier') + '\nthis.Magnifier = Magnifier;';
const Magnifier = vm.runInNewContext(source, {
    Clutter: { Actor, ScalingFilter: { NEAREST: 0 } },
    Cogl: { SnippetHook: { FRAGMENT: 2048 } },
    GObject: { registerClass: (klass) => klass },
    Shell: { GLSLEffect: Effect },
    St: {
        Widget: Actor,
        Label: Actor,
        DrawingArea: class {
            constructor() {
                assert.fail('DrawingArea used');
            }
        },
    },
    MASK_CODE,
    MASK_DECLARATIONS,
    textureUniforms: () => ({ textureSize: [10, 3], contentOffset: [1, 0], extent: [7, 3] }),
    setUniforms: (_effect, values) => uniforms.push(values),
});

test('magnifier uses the frozen texture and tracks physical pixels within the monitor', () => {
    const content = {};
    const magnifier = new Magnifier({ content, scale: 2 }, 800, 600);
    const viewport = magnifier.actor.children[0];
    assert.equal(viewport.children[0].content, content);
    // Image and four band marks.
    assert.equal(viewport.children.length, 5);
    magnifier.update({ x: 99.6, y: 49.9 }, { x: 0, y: 0, width: 800, height: 600 }, true);
    assert.equal(magnifier.actor.visible, true);
    assert.deepEqual(Array.from(magnifier._image.position), [72 - 99.75 * 16, 72 - 49.75 * 16]);
    assert.equal(magnifier._label, undefined);
    assert.equal(magnifier.actor.width, 144);
    assert.equal(magnifier.actor.height, 144);
    assert.deepEqual(magnifier.actor.scale, [1, 1]);
    magnifier.update({ x: 0, y: 0 }, null, true);
    assert.equal(magnifier.actor.visible, false);
});

test('band crosshair frames the centre pixel at scale 1 without touching it', () => {
    const magnifier = new Magnifier({ content: {}, scale: 1 }, 800, 600);
    magnifier.update({ x: 100, y: 100 }, { x: 0, y: 0, width: 800, height: 600, scale: 1 }, true);
    // Arrays come from the vm realm, so compare plain copies.
    assert.deepEqual(JSON.parse(JSON.stringify(magnifier._marks.map(({ actor }) => [actor.position, actor.size]))), [
        [
            [0, 68],
            [68, 8],
        ],
        [
            [76, 68],
            [68, 8],
        ],
        [
            [68, 0],
            [8, 68],
        ],
        [
            [68, 76],
            [8, 68],
        ],
    ]);
    const c = 72;
    for (const { geometry: g } of magnifier._marks) {
        const overlaps = g.x < c + 4 && g.x + g.width > c - 4 && g.y < c + 4 && g.y + g.height > c - 4;
        assert.equal(overlaps, false);
    }
});

test('crosshair edges align to the monitor physical grid at fractional scale and small sizes', () => {
    const magnifier = new Magnifier({ content: {}, scale: 2 }, 800, 600);
    for (const monitor of [
        { x: 1, y: 2, width: 800, height: 600, scale: 4 / 3 },
        { x: 1, y: 2, width: 100, height: 100, scaleFactor: 4 / 3 },
    ]) {
        for (const point of [
            { x: monitor.x + 12.25, y: monitor.y + 13.5 },
            { x: monitor.x + 13.5, y: monitor.y + 14.25 },
            { x: monitor.x + monitor.width - 1, y: monitor.y + monitor.height - 1 },
        ]) {
            magnifier.update(point, monitor, true);
            const [x, y] = magnifier.actor.position;
            const [actorScale] = magnifier.actor.scale;
            for (const { actor } of magnifier._marks) {
                for (const [origin, offset, length, monitorOrigin] of [
                    [x, actor.position[0], actor.size[0], monitor.x],
                    [y, actor.position[1], actor.size[1], monitor.y],
                ]) {
                    for (const edge of [offset, offset + length]) {
                        const physical = ((origin + edge * actorScale - monitorOrigin) * 4) / 3;
                        assert.ok(Math.abs(physical - Math.round(physical)) < 1e-9);
                    }
                }
            }
        }
    }
});

test('rounded frame: one mask effect on the viewport and a non-reactive overlay last', () => {
    const magnifier = new Magnifier({ content: {}, scale: 1 }, 800, 600);
    const viewport = magnifier.actor.children[0];
    assert.equal(viewport.effects.length, 1);
    const [mask] = viewport.effects;
    assert.equal(mask.snippet[1], MASK_DECLARATIONS);
    assert.equal(mask.snippet[2], MASK_CODE);
    // Replace snippet: the mask samples the viewport texture itself.
    assert.equal(mask.snippet[3], true);
    assert.ok(MASK_DECLARATIONS.includes('uniform sampler2D tex;'));
    assert.ok(MASK_CODE.includes('texture2D(tex'));
    assert.equal(MASK_CODE.indexOf('cogl_color_out'), MASK_CODE.indexOf('cogl_color_out ='));
    viewport.resourceScale = 2;
    uniforms.length = 0;
    mask.vfunc_paint_target();
    assert.deepEqual(JSON.parse(JSON.stringify(uniforms[0].extent)), [288, 288]);
    assert.deepEqual(JSON.parse(JSON.stringify(uniforms[0].radius)), [20]);
    const frame = magnifier.actor.children.at(-1);
    assert.notEqual(frame, viewport);
    assert.equal(frame.reactive, false);
    assert.equal(frame.style_class, 'mirx-magnifier-frame');
    assert.equal(frame.width, 144);
    assert.equal(frame.height, 144);
});

test('placement keeps a 24 horizontal and a 52 vertical gap and flips above near the bottom and right edges', () => {
    const magnifier = new Magnifier({ content: {}, scale: 1 }, 800, 600);
    const monitor = { x: 0, y: 0, width: 800, height: 600, scale: 1 };
    magnifier.update({ x: 100, y: 100 }, monitor, true);
    assert.deepEqual(Array.from(magnifier.actor.position), [124, 152]);
    magnifier.update({ x: 100, y: 500 }, monitor, true); // 500 + 52 + 144 > 600
    assert.deepEqual(Array.from(magnifier.actor.position), [124, 500 - 144 - 52]);
    magnifier.update({ x: 700, y: 100 }, monitor, true); // 700 + 24 + 144 > 800
    assert.deepEqual(Array.from(magnifier.actor.position), [700 - 144 - 24, 152]);
});

test('magnifier draws its frame with St widgets only, never a DrawingArea', () => {
    assert.doesNotMatch(source, /DrawingArea|Clutter\.Canvas|cairo/i);
});
