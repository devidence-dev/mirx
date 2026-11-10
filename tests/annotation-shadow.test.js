import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { annotationShadowGeometry } from '../src/rendering/annotationShadowGeometry.js';

test('shadow geometry preserves source size and phase with padded physical-grid bounds', () => {
    for (const scale of [1, 4 / 3, 2]) {
        const rect = { x: 10.2, y: 20.3, width: 34.5, height: 50.25 };
        const { wrapper, clone, radius } = annotationShadowGeometry(rect, scale);
        assert.equal(clone.width, rect.width);
        assert.equal(clone.height, rect.height);
        assert.ok(Math.abs(wrapper.x + clone.x - rect.x - Math.round(scale) / scale) < 1e-9);
        assert.ok(Math.abs(wrapper.y + clone.y - rect.y - Math.round(2 * scale) / scale) < 1e-9);
        assert.ok(clone.x >= 6 && clone.y >= 6);
        assert.ok(wrapper.width - clone.x - clone.width >= 6 - 1e-9);
        assert.ok(wrapper.height - clone.y - clone.height >= 6 - 1e-9);
        assert.ok(Math.abs(wrapper.x * scale - Math.round(wrapper.x * scale)) < 1e-9);
        assert.equal(radius, 3 * Math.ceil(scale));
    }
});

test('fractional physical scale uses the integer resource scale for blur', () => {
    const rect = { x: 0, y: 0, width: 20, height: 20 };
    assert.equal(annotationShadowGeometry(rect, 4 / 3, 2).radius, 6);
});

test('shadow component keeps the source silhouette and caches actor writes', () => {
    const writes = [];
    class Actor {
        constructor(properties = {}) {
            Object.assign(this, properties);
            this.effects = [];
        }
        add_child(child) {
            this.child = child;
        }
        add_effect(effect) {
            this.effects.push(effect);
        }
        set_position(...args) {
            writes.push(['position', ...args]);
        }
        set_size(...args) {
            writes.push(['size', ...args]);
        }
        get_allocation_box() {
            writes.push('allocation');
        }
        show() {
            writes.push('show');
        }
        hide() {
            writes.push('hide');
        }
        destroy() {
            writes.push('destroy');
        }
    }
    class Clone extends Actor {}
    class ColorizeEffect {
        constructor(properties) {
            Object.assign(this, properties);
        }
    }
    class BlurEffect {
        constructor(properties) {
            Object.assign(this, properties);
        }
        set_radius(radius) {
            writes.push(['radius', radius]);
        }
    }
    const sourceCode = `${readFileSync(new URL('../src/ui/annotationShadow.js', import.meta.url), 'utf8')
        .replace(/^import [^;]*;\n/gm, '')
        .replace(
            'export class AnnotationShadow',
            'class AnnotationShadow',
        )}\nthis.AnnotationShadow = AnnotationShadow;`;
    const AnnotationShadow = vm.runInNewContext(sourceCode, {
        Clutter: { Actor, Clone, ColorizeEffect },
        Cogl: { Color: { from_string: () => [true, 'black'] } },
        Shell: { BlurEffect, BlurMode: { ACTOR: 'actor' } },
        annotationShadowGeometry,
    });
    const source = new Actor();
    const shadow = new AnnotationShadow(source);
    assert.equal(shadow.clone.source, source);
    assert.equal(shadow.clone.effects[0].tint, 'black');
    assert.equal(shadow.actor.reactive, false);
    assert.equal(shadow.actor.opacity, 115);
    assert.equal(shadow.blur.mode, 'actor');
    const rect = { x: 1, y: 2, width: 30, height: 40 };
    shadow.update(rect, 2);
    assert.deepEqual(writes.at(-1), ['radius', 6]);
    const count = writes.length;
    shadow.update(rect, 2);
    assert.equal(writes.length, count);
    shadow.setVisible(false);
    shadow.setVisible(false);
    shadow.setVisible(true);
    assert.deepEqual(writes.slice(-2), ['hide', 'show']);
    shadow.prepareExport();
    assert.deepEqual(writes.slice(-3), ['allocation', 'allocation', 'allocation']);
    shadow.destroy();
    shadow.destroy();
    assert.equal(writes.filter((item) => item === 'destroy').length, 1);
});
