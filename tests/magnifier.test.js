import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class Actor {
    constructor(properties = {}) { Object.assign(this, properties); this.children = []; }
    add_child(child) { this.children.push(child); }
    set_content_scaling_filters(...filters) { this.filters = filters; }
    set_scale(...scale) { this.scale = scale; }
    set_position(...position) { this.position = position; }
    set_size(...size) { this.size = size; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
}
const source = readFileSync(new URL('../src/ui/magnifier.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export class Magnifier', 'class Magnifier') + '\nthis.Magnifier = Magnifier;';
const Magnifier = vm.runInNewContext(source, {
    Clutter: {Actor, ScalingFilter: {NEAREST: 0}},
    St: {Widget: Actor, Label: Actor, DrawingArea: class { constructor() { assert.fail('DrawingArea used'); } }},
});

test('magnifier uses the frozen texture and tracks physical pixels within the monitor', () => {
    const content = {};
    const magnifier = new Magnifier({content, scale: 2}, 800, 600);
    const viewport = magnifier.actor.children[0];
    assert.equal(viewport.children[0].content, content);
    // Image, 8 faint extension lines, 8 tick lines and the centre box.
    assert.equal(viewport.children.length, 18);
    magnifier.update({x: 99.6, y: 49.9}, {x: 0, y: 0, width: 800, height: 600}, true);
    assert.equal(magnifier.actor.visible, true);
    assert.deepEqual(Array.from(magnifier._image.position), [72 - 99.75 * 16, 72 - 49.75 * 16]);
    assert.equal(magnifier._label.text, '99, 49');
    magnifier.update({x: 0, y: 0}, null, true);
    assert.equal(magnifier.actor.visible, false);
});

test('crosshair edges align to the monitor physical grid at fractional scale and small sizes', () => {
    const magnifier = new Magnifier({content: {}, scale: 2}, 800, 600);
    for (const monitor of [
        {x: 1, y: 2, width: 800, height: 600, scale: 4 / 3},
        {x: 1, y: 2, width: 100, height: 100, scaleFactor: 4 / 3},
    ]) {
        for (const point of [{x: monitor.x + 12.25, y: monitor.y + 13.5},
            {x: monitor.x + 13.5, y: monitor.y + 14.25},
            {x: monitor.x + monitor.width - 1, y: monitor.y + monitor.height - 1}]) {
            magnifier.update(point, monitor, true);
            const [x, y] = magnifier.actor.position;
            const [actorScale] = magnifier.actor.scale;
            for (const {actor} of magnifier._marks) {
                for (const [origin, offset, length, monitorOrigin] of [
                    [x, actor.position[0], actor.size[0], monitor.x],
                    [y, actor.position[1], actor.size[1], monitor.y],
                ]) {
                    for (const edge of [offset, offset + length]) {
                        const physical = (origin + edge * actorScale - monitorOrigin) * 4 / 3;
                        assert.ok(Math.abs(physical - Math.round(physical)) < 1e-9);
                    }
                }
            }
        }
    }
});
