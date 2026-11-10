import test from 'node:test';
import assert from 'node:assert/strict';
import {arrowBars, rectangleGeometry} from '../src/rendering/actorGeometry.js';

test('rectangle stroke extends half its width on every side', () => {
    assert.deepEqual(rectangleGeometry({type: 'rectangle', x1: 40, y1: 20, x2: 10, y2: 5, width: 3}),
        {x: 8.5, y: 3.5, width: 33, height: 18});
    assert.deepEqual(rectangleGeometry({type: 'highlighter', x1: 40, y1: 20, x2: 10, y2: 5, width: 3}),
        {x: 10, y: 5, width: 30, height: 15});
    assert.deepEqual(rectangleGeometry({type: 'rectangle', x1: 10, y1: 5, x2: 40, y2: 20, width: 6}),
        {x: 7, y: 2, width: 36, height: 21});
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
