import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelBlocks} from '../src/rendering/pixels.js';

const bounds = (x, y, width, height) => ({x, y, width, height});

test('averages RGB pixels with padded rowstride', () => {
    const pixels = Uint8Array.from([255, 0, 0, 0, 255, 0, 99, 99,
        0, 0, 255, 255, 255, 255, 99, 99]);
    const blocks = pixelBlocks({pixels, stride: 8, channels: 3, width: 2, height: 2}, bounds(0, 0, 2, 2), 2);
    assert.deepEqual(blocks, [[0, 0, 2, 2, 0.5, 0.5, 0.5]]);
});

test('ignores alpha when indexing RGBA pixels', () => {
    const pixels = Uint8Array.from([255, 0, 0, 12, 0, 0, 255, 240]);
    assert.deepEqual(pixelBlocks({pixels, stride: 8, channels: 4, width: 2, height: 1}, bounds(0, 0, 2, 1), 2),
        [[0, 0, 2, 1, 0.5, 0, 0.5]]);
});

test('clips negative bounds and samples scale-two screenshot coordinates', () => {
    const pixels = new Uint8Array(4 * 4 * 3);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const i = (y * 4 + x) * 3;
        pixels[i] = x < 2 ? 255 : 0;
        pixels[i + 1] = y >= 2 ? 255 : 0;
    }
    const image = {pixels, stride: 12, channels: 3, width: 4, height: 4, scale: 2};
    assert.deepEqual(pixelBlocks(image, bounds(-1, 1, 2, 2), 8), [[0, 1, 1, 1, 1, 1, 0]]);
    assert.deepEqual(pixelBlocks(image, bounds(1, 0, 3, 1), 8), [[1, 0, 1, 1, 0, 0, 0]]);
    assert.deepEqual(pixelBlocks(image, bounds(-4, -4, 1, 1), 8), []);
});

test('moving an area samples its new original position and leaves source unchanged', () => {
    const pixels = Uint8Array.from([255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255]);
    const before = pixels.slice();
    const image = {pixels, stride: 12, channels: 3, width: 4, height: 1};
    assert.deepEqual(pixelBlocks(image, bounds(0, 0, 2, 1), 2), [[0, 0, 2, 1, 1, 0, 0]]);
    assert.deepEqual(pixelBlocks(image, bounds(2, 0, 2, 1), 2), [[2, 0, 2, 1, 0, 0, 1]]);
    assert.deepEqual(pixels, before);
});
