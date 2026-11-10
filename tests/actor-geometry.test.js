import test from 'node:test';
import assert from 'node:assert/strict';
import {arrowBars, effectTextureUniforms, ellipseUniforms, pixelateGeometry, pixelateUniforms,
    rectangleGeometry} from '../src/rendering/actorGeometry.js';

test('rectangle stroke extends half its width on every side', () => {
    assert.deepEqual(rectangleGeometry({type: 'rectangle', x1: 40, y1: 20, x2: 10, y2: 5, width: 3}),
        {x: 8.5, y: 3.5, width: 33, height: 18});
    assert.deepEqual(rectangleGeometry({type: 'highlighter', x1: 40, y1: 20, x2: 10, y2: 5, width: 3}),
        {x: 10, y: 5, width: 30, height: 15});
    assert.deepEqual(rectangleGeometry({type: 'rectangle', x1: 10, y1: 5, x2: 40, y2: 20, width: 6}),
        {x: 7, y: 2, width: 36, height: 21});
});

test('ellipse uniforms use resource texels and one physical pixel of antialiasing', () => {
    const ellipse = {x1: 40, y1: 30, x2: 10, y2: 10, width: 6};
    assert.deepEqual(ellipseUniforms(ellipse, 1, 1),
        {radii: [15, 10], stroke: [6], antialias: [1]});
    const fractional = ellipseUniforms(ellipse, 4 / 3, 4 / 3);
    assert.ok(Math.abs(fractional.radii[1] - 40 / 3) < 1e-10);
    assert.equal(fractional.radii[0], 20);
    assert.deepEqual({stroke: fractional.stroke, antialias: fractional.antialias},
        {stroke: [8], antialias: [1]});
    assert.deepEqual(ellipseUniforms(ellipse, 2, 4 / 3),
        {radii: [30, 20], stroke: [12], antialias: [1.5]});
    assert.deepEqual(ellipseUniforms({...ellipse, x2: ellipse.x1}, 1, 1).radii, [0, 10]);
    assert.deepEqual(ellipseUniforms({...ellipse, y2: ellipse.y1}, 1, 1).radii, [15, 0]);
});

test('pixelation clips reversed bounds while retaining block anchor at both scales', () => {
    const a = {x1: 80, y1: 70, x2: 10, y2: 20, width: 3};
    const selection = {x: 25, y: 30, width: 40, height: 30};
    const geometry = pixelateGeometry(a, selection, {width: 100, height: 100});
    assert.deepEqual(geometry, {rect: {x: 25, y: 30, width: 40, height: 30},
        anchor: [15, 10], block: 12});
    assert.deepEqual(pixelateUniforms(geometry, 1), {anchor: [15, 10], block: [12]});
    const fractional = pixelateUniforms(geometry, 4 / 3);
    assert.equal(fractional.anchor[0], 20);
    assert.ok(Math.abs(fractional.anchor[1] - 40 / 3) < 1e-10);
    assert.deepEqual(fractional.block, [16]);
    assert.deepEqual(pixelateUniforms(geometry, 2), {anchor: [30, 20], block: [24]});
    assert.equal(pixelateGeometry({...a, width: 1}, selection, {width: 100, height: 100}).block, 8);
    assert.equal(pixelateGeometry({...a, width: 10}, selection, {width: 100, height: 100}).block, 40);
});

test('pixelation handles zero-size and offstage regions', () => {
    const selection = {x: 0, y: 0, width: 100, height: 100};
    const stage = {width: 100, height: 100};
    assert.deepEqual(pixelateGeometry({x1: 10, y1: 10, x2: 10, y2: 50}, selection, stage).rect,
        {x: 10, y: 10, width: 0, height: 40});
    assert.deepEqual(pixelateGeometry({x1: -20, y1: -10, x2: 10, y2: 5}, selection, stage),
        {rect: {x: 0, y: 0, width: 10, height: 5}, anchor: [20, 10], block: 12});
    assert.equal(pixelateGeometry({x1: 110, y1: 10, x2: 120, y2: 20}, selection, stage).rect.width, 0);
    assert.equal(pixelateGeometry({x1: 10, y1: 110, x2: 20, y2: 120}, selection, stage).rect.height, 0);
    assert.equal(pixelateGeometry({x1: 10, y1: 10, x2: 20, y2: 20}, null, stage).rect.width, 0);
});

test('offscreen uniforms account for padded FBO and fractional display scale', () => {
    const rect = {width: 40, height: 30};
    assert.deepEqual(effectTextureUniforms(rect, [43, 33], 1),
        {textureSize: [43, 33], contentOffset: [2, 2], extent: [40, 30]});
    // GNOME 50.1 uses the ceiled resource scale of 2 on a 4/3 display.
    assert.deepEqual(effectTextureUniforms(rect, [86, 66], 2),
        {textureSize: [86, 66], contentOffset: [4, 4], extent: [80, 60]});
    assert.deepEqual(effectTextureUniforms({width: 10.6, height: 20.25}, [28, 46], 2),
        {textureSize: [28, 46], contentOffset: [4, 4], extent: [21.2, 40.5]});
});

test('diagonal arrow bars rotate at the centre of their starting cap', () => {
    for (const width of [3, 6]) {
        const annotation = {x1: 13, y1: 27, x2: 53, y2: 57, width};
        const bars = arrowBars(annotation);
        assert.equal(bars.length, 3);
        for (const [index, bar] of bars.entries()) {
            const start = index ? {x: annotation.x2, y: annotation.y2} :
                {x: annotation.x1, y: annotation.y1};
            assert.equal(bar.x + bar.width * bar.pivotX, start.x);
            assert.equal(bar.y + bar.height * bar.pivotY, start.y);
            const length = index ? Math.max(12, width * 4) : 50;
            assert.ok(Math.abs(bar.width - width - length) < 1e-10);
        }
        assert.ok(Math.abs(bars[0].angle - Math.atan2(30, 40) * 180 / Math.PI) < 1e-10);
        for (const [index, sign] of [-1, 1].entries()) {
            const expected = Math.atan2(30, 40) + sign * Math.PI / 6;
            const actual = bars[index + 1].angle * Math.PI / 180;
            assert.ok(Math.abs(Math.cos(actual) + Math.cos(expected)) < 1e-10);
            assert.ok(Math.abs(Math.sin(actual) + Math.sin(expected)) < 1e-10);
        }
    }
});
