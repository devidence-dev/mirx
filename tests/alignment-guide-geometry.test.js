import assert from 'node:assert/strict';
import test from 'node:test';
import { alignmentGuideGeometry, guideScale } from '../src/rendering/alignmentGuideGeometry.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);
const grid = (value, scale) => near(value * scale, Math.round(value * scale));

test('guides centre on the magnifier source pixel and snap to the physical grid', () => {
    for (const [scale, texture] of [
        [1, 1],
        [2, 2],
        [4 / 3, 2],
        [4 / 3, 4 / 3],
        [2, 1],
    ]) {
        for (const monitor of [
            { x: 0, y: 0, width: 800, height: 600 },
            { x: -1920, y: 37, width: 1280, height: 720 },
        ]) {
            for (const [fx, fy] of [
                [5.3, 5.9],
                [100.25, 50.75],
                [399.6, 299.4],
            ]) {
                const point = { x: monitor.x + fx, y: monitor.y + fy };
                const g = alignmentGuideGeometry(point, { ...monitor, scale }, texture);
                const centreX = (Math.floor(point.x * texture) + 0.5) / texture;
                const centreY = (Math.floor(point.y * texture) + 0.5) / texture;
                // The core pixel is the (start + core)-th physical pixel; its centre is within half a pixel.
                const coreX = monitor.x + g.vertical.x + (g.vertical.core + 0.5) / scale;
                const coreY = monitor.y + g.horizontal.y + (g.horizontal.core + 0.5) / scale;
                assert.ok(Math.abs(coreX - centreX) <= 0.5 / scale + 1e-9, `x ${scale}/${texture}`);
                assert.ok(Math.abs(coreY - centreY) <= 0.5 / scale + 1e-9, `y ${scale}/${texture}`);
                for (const value of [g.vertical.x, g.vertical.width, g.horizontal.y, g.horizontal.height])
                    grid(value, scale);
                near(g.vertical.width * scale, 3);
                near(g.horizontal.height * scale, 3);
                assert.deepEqual([g.vertical.y, g.vertical.height], [0, monitor.height]);
                assert.deepEqual([g.horizontal.x, g.horizontal.width], [0, monitor.width]);
            }
        }
    }
});

test('strips and outlines are clipped to the monitor at edges and corners', () => {
    const monitor = { x: 100, y: 50, width: 200, height: 100, scale: 2 };
    const corners = [
        [0, 0],
        [199.9, 0],
        [0, 99.9],
        [199.9, 99.9],
        [200, 100],
        [-5, -5],
    ];
    for (const [fx, fy] of corners) {
        const g = alignmentGuideGeometry({ x: monitor.x + fx, y: monitor.y + fy }, monitor, 2);
        for (const strip of [g.vertical, g.horizontal]) {
            assert.ok(strip.width >= 0 && strip.height >= 0);
            assert.ok(strip.x >= 0 && strip.y >= 0);
            assert.ok(strip.x + strip.width <= monitor.width + 1e-9);
            assert.ok(strip.y + strip.height <= monitor.height + 1e-9);
            assert.ok(strip.core >= 0 && strip.core <= 2);
        }
    }
    const first = alignmentGuideGeometry({ x: 100, y: 50 }, monitor, 2);
    assert.deepEqual([first.vertical.x, first.vertical.width, first.vertical.core], [0, 1, 0]); // outline clipped
    const last = alignmentGuideGeometry({ x: 299.9, y: 149.9 }, monitor, 2);
    assert.deepEqual([last.vertical.x + last.vertical.width, last.horizontal.y + last.horizontal.height], [200, 100]);
});

test('fractional monitor sizes never produce negative or oversize strips', () => {
    const monitor = { x: 0, y: 0, width: 1280, height: 721, scale: 4 / 3 };
    for (const point of [
        { x: 1279.99, y: 720.99 },
        { x: 1280, y: 721 },
        { x: 0, y: 0 },
    ]) {
        const g = alignmentGuideGeometry(point, monitor, 4 / 3);
        for (const v of [g.vertical.width, g.horizontal.height]) assert.ok(v >= 0 && v <= 3 / (4 / 3) + 1e-9);
        assert.ok(g.vertical.x + g.vertical.width <= 1280 + 1e-9);
        assert.ok(g.horizontal.y + g.horizontal.height <= 721 + 1e-9);
    }
});

test('monitor scale precedence matches the magnifier', () => {
    assert.equal(guideScale({ scale: 2, scaleFactor: 3 }, 4), 2);
    assert.equal(guideScale({ scaleFactor: 3 }, 4), 3);
    assert.equal(guideScale({}, 4), 4);
    const monitor = { x: 0, y: 0, width: 100, height: 100 };
    assert.equal(alignmentGuideGeometry({ x: 10, y: 10 }, { ...monitor, scaleFactor: 2 }, 1).scale, 2);
    assert.equal(alignmentGuideGeometry({ x: 10, y: 10 }, monitor, 1.5).scale, 1.5);
});

test('guides are solid: no dash or period, long axis starts at the monitor origin', () => {
    const g = alignmentGuideGeometry({ x: 20, y: 20 }, { x: 0, y: 0, width: 100, height: 100, scale: 1 }, 1);
    assert.equal('dash' in g, false);
    assert.equal('period' in g, false);
    const a = alignmentGuideGeometry({ x: 20, y: 20 }, { x: 0, y: 0, width: 100, height: 100 }, 1);
    const b = alignmentGuideGeometry({ x: 70, y: 20 }, { x: 0, y: 0, width: 100, height: 100 }, 1);
    assert.deepEqual([a.horizontal.x, a.horizontal.width], [b.horizontal.x, b.horizontal.width]); // long axis starts at origin
});

test('cross core stays within 21 logical units with just one physical pixel of outline', () => {
    for (const scale of [1, 1.25, 4 / 3, 1.5, 1.75, 2, 3]) {
        const { cross } = alignmentGuideGeometry(
            { x: 50, y: 50 },
            { x: 0, y: 0, width: 100, height: 100, scale },
            scale,
        );
        assert.ok((2 * cross.outer + 1) / scale <= 21);
        assert.ok((2 * cross.outer + 3) / scale > 21); // longest odd physical span that fits
        near(cross.half - cross.outer, 1); // outline reaches exactly one pixel beyond each tip
        near(cross.size * scale, 2 * cross.outer + 3);
        assert.equal('radius' in cross || 'inner' in cross, false);
    }
});

test('cross is an odd physical square centred on the strips core at every scale and corner', () => {
    for (const [scale, texture] of [
        [1, 1],
        [2, 2],
        [4 / 3, 4 / 3],
        [4 / 3, 2],
        [2, 1],
    ]) {
        for (const monitor of [
            { x: 0, y: 0, width: 800, height: 600 },
            { x: -1920, y: 37, width: 1280, height: 720 },
        ]) {
            const corners = [
                [0.2, 0.3],
                [monitor.width - 0.4, 0.3],
                [0.2, monitor.height - 0.4],
                [monitor.width - 0.4, monitor.height - 0.4],
                [300.5, 200.5],
            ];
            for (const [fx, fy] of corners) {
                const point = { x: monitor.x + fx, y: monitor.y + fy };
                const g = alignmentGuideGeometry(point, { ...monitor, scale }, texture);
                const { cross } = g;
                near(cross.x * scale + cross.half + 0.5, g.vertical.x * scale + g.vertical.core + 0.5);
                near(cross.y * scale + cross.half + 0.5, g.horizontal.y * scale + g.horizontal.core + 0.5);
                near(cross.size * scale, 2 * cross.half + 1);
                grid(cross.size, scale);
                assert.equal(Math.round(cross.size * scale) % 2, 1);
                grid(cross.x, scale);
                grid(cross.y, scale);
                assert.ok(cross.outer < cross.half);
            }
        }
    }
});
