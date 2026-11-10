import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {arrowBars, arrowBounds, contrastColor, effectTextureUniforms, ellipseUniforms, gradientAxis,
    gradientShades, gradientUniforms, markerDisc, markerLabel, pixelateGeometry, pixelateUniforms, rectangleGeometry} from '../src/rendering/actorGeometry.js';

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
        {radii: [15, 10], stroke: [6], antialias: [1], fill: [0]});
    const fractional = ellipseUniforms(ellipse, 4 / 3, 4 / 3);
    assert.ok(Math.abs(fractional.radii[1] - 40 / 3) < 1e-10);
    assert.equal(fractional.radii[0], 20);
    assert.deepEqual({stroke: fractional.stroke, antialias: fractional.antialias},
        {stroke: [8], antialias: [1]});
    assert.deepEqual(ellipseUniforms(ellipse, 2, 4 / 3),
        {radii: [30, 20], stroke: [12], antialias: [1.5], fill: [0]});
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

test('marker contrast is white except on White and near-white', () => {
    const expected = {'#ff0000': '#ffffff', '#ffcc00': '#ffffff', '#00cc66': '#ffffff', '#0088ff': '#ffffff',
        '#cc55ff': '#ffffff', '#ffffff': '#000000', '#000000': '#ffffff'};
    for (const [color, text] of Object.entries(expected))
        assert.equal(contrastColor(color), text, color);
    assert.equal(contrastColor('#fff'), '#000000');
    assert.equal(contrastColor('#e6e6e6'), '#000000'); // brightness exactly 230
    assert.equal(contrastColor('#e5e5e5'), '#ffffff'); // brightness 229
});

test('marker label size factors follow the digit count', () => {
    for (const [digits, factor] of [[1, 1.1], [2, 0.95], [3, 0.7], [4, 0.5], [6, 0.5]])
        assert.ok(Math.abs(markerLabel(10, digits).fontSize - 10 * factor) < 1e-10, `${digits} digits`);
});

test('marker disc pads its bounds by one logical pixel and reuses ellipse uniforms', () => {
    const marker = {type: 'marker', x1: 50, y1: 40, x2: 50, y2: 40, width: 3};
    assert.deepEqual(markerDisc(marker, 1, 1), {
        rect: {x: 37, y: 27, width: 26, height: 26},
        uniforms: {radii: [12, 12], stroke: [1], antialias: [1], fill: [1]}});
    assert.deepEqual(markerDisc(marker, 2, 2).uniforms,
        {radii: [24, 24], stroke: [2], antialias: [1], fill: [1]});
    assert.deepEqual(markerDisc(marker, 2, 4 / 3).uniforms,
        {radii: [24, 24], stroke: [2], antialias: [1.5], fill: [1]});
    const fractional = markerDisc(marker, 4 / 3, 4 / 3).uniforms;
    assert.ok(Math.abs(fractional.radii[0] - 16) < 1e-10);
    assert.deepEqual(fractional.antialias, [1]);
    assert.deepEqual(markerDisc({...marker, width: 30}, 1, 1).rect,
        {x: -71, y: -81, width: 242, height: 242});
});

const assertNear = (actual, expected) => {
    assert.equal(actual.length, expected.length);
    actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-10, `${actual} vs ${expected}`));
};

const hueOf = ([r, g, b]) => {
    const d = Math.max(r, g, b) - Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
};

const paletteOf = () => {
    const toolbar = readFileSync(new URL('../src/ui/toolbar.js', import.meta.url), 'utf8');
    return [...toolbar.matchAll(/\['(#[0-9a-f]{6})', '([^']+)'/g)].map(m => ({hex: m[1], name: m[2]}));
};
const lightnessOf = ([r, g, b]) => (Math.max(r, g, b) + Math.min(r, g, b)) / 2;

test('gradient shades sweep the hue towards pink or violet', () => {
    const red = gradientShades('#ff0000');
    assert.deepEqual(Object.keys(red), ['from', 'to']);
    assert.ok(Math.abs(hueOf(red.from)) < 1e-6);
    assert.ok(Math.abs(hueOf(red.to) - 315) < 1e-6);
    assert.ok(Math.abs(hueOf(gradientShades('#ffcc00').to) - 3) < 1e-6);
    const blue = paletteOf().find(c => c.name === 'Blue').hex;
    const blueHue = hueOf(gradientShades(blue).from);
    assert.ok(Math.abs(hueOf(gradientShades(blue).to) - (blueHue + 50)) < 1e-6);
    // Violet starts bluer and ends in magenta, clearly apart from red's pink end.
    const violet = gradientShades(paletteOf().find(c => c.name === 'Violet').hex);
    assert.ok(Math.abs(hueOf(violet.from) - 270) < 1, hueOf(violet.from));
    assert.ok(Math.abs(hueOf(violet.to) - 310) < 1, hueOf(violet.to));
    for (const hex of ['#ffffff', '#000000']) {
        const shades = gradientShades(hex);
        assertNear(shades.from, shades.to);
        assertNear(shades.from, parseInt(hex[1], 16) ? [1, 1, 1] : [0, 0, 0]);
    }
    assert.deepEqual(gradientShades('#f00'), gradientShades('#ff0000'));
});

test('gradient ends stay within 0..1 and never get darker at the start for every toolbar palette colour', () => {
    const palette = paletteOf();
    assert.equal(palette.length, 7);
    for (const {hex} of palette) {
        const {from, to} = gradientShades(hex);
        for (const v of [...from, ...to]) assert.ok(v >= 0 && v <= 1, `${hex} ${v}`);
        assert.ok(lightnessOf(from) >= lightnessOf(to) - 1e-9, hex);
        // Chromatic colours are lifted to a pastel so the sweep reads on dark content.
        if (Math.max(...from) !== Math.min(...from))
            assert.ok(lightnessOf(to) >= 0.62 - 1e-9, hex);
    }
});

test('arrow bars lie inside the arrow bounds for every angle and width', () => {
    const EPS = 1e-6;
    for (const degrees of [0, 45, 90, 180, 270]) {
        for (const width of [1, 3, 30]) {
            const radians = degrees * Math.PI / 180;
            const annotation = {type: 'arrow', x1: 200, y1: 200, width,
                x2: 200 + 60 * Math.cos(radians), y2: 200 + 60 * Math.sin(radians)};
            const bounds = arrowBounds(annotation);
            for (const bar of arrowBars(annotation)) {
                const px = bar.x + bar.width * bar.pivotX, py = bar.y + bar.height * bar.pivotY;
                const theta = bar.angle * Math.PI / 180;
                for (const u of [-bar.width * bar.pivotX, bar.width * (1 - bar.pivotX)]) {
                    for (const v of [-bar.height * bar.pivotY, bar.height * (1 - bar.pivotY)]) {
                        const x = px + u * Math.cos(theta) - v * Math.sin(theta);
                        const y = py + u * Math.sin(theta) + v * Math.cos(theta);
                        const label = `${degrees} deg, width ${width}`;
                        assert.ok(x >= bounds.x - EPS && x <= bounds.x + bounds.width + EPS, `x ${label}`);
                        assert.ok(y >= bounds.y - EPS && y <= bounds.y + bounds.height + EPS, `y ${label}`);
                    }
                }
            }
        }
    }
});

test('zero-length arrow has a non-negative box', () => {
    const bounds = arrowBounds({type: 'arrow', x1: 30, y1: 40, x2: 30, y2: 40, width: 3});
    assert.ok(bounds.width >= 0 && bounds.height >= 0);
});

test('arrow gradient axis runs from tail to tip in all four drag directions', () => {
    const drags = [[[10, 20], [60, 20]], [[60, 20], [10, 20]], [[30, 5], [30, 45]], [[30, 45], [30, 5]]];
    for (const [[x1, y1], [x2, y2]] of drags) {
        const annotation = {type: 'arrow', x1, y1, x2, y2, width: 3};
        const bounds = arrowBounds(annotation);
        const {start, end} = gradientAxis(annotation, {width: 999, height: 999});
        assert.deepEqual(start, [x1 - bounds.x, y1 - bounds.y]);
        assert.deepEqual(end, [x2 - bounds.x, y2 - bounds.y]);
        for (const [x, y] of [start, end])
            assert.ok(x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height);
    }
});

test('box gradient axis is the corner-to-corner diagonal, whatever the drag direction', () => {
    const rectangle = {type: 'rectangle', x1: 40, y1: 30, x2: 10, y2: 5, width: 3};
    const size = rectangleGeometry(rectangle);
    assert.ok(size.width > 0 && size.height > 0);
    assert.deepEqual(gradientAxis(rectangle, size), {start: [0, 0], end: [size.width, size.height]});
});

test('gradient uniforms are only the flag when flat and carry the scaled axis and shades when set', () => {
    const shades = gradientShades('#ff0000');
    const size = {width: 40, height: 30};
    const flat = {type: 'circle', x1: 0, y1: 0, x2: 40, y2: 30, width: 3};
    assert.deepEqual(gradientUniforms(flat, size, shades, 2), {gradient: [0]});
    assert.deepEqual(gradientUniforms({...flat, gradient: false}, size, shades, 1), {gradient: [0]});
    for (const scale of [1, 2, 4 / 3]) {
        const uniforms = gradientUniforms({...flat, gradient: true}, size, shades, scale);
        assert.deepEqual(Object.keys(uniforms), ['gradient', 'gradStart', 'gradEnd', 'gradFrom', 'gradTo']);
        assertNear(uniforms.gradient, [1]);
        assertNear(uniforms.gradStart, [0, 0]);
        assertNear(uniforms.gradEnd, [40 * scale, 30 * scale]);
        assertNear(uniforms.gradFrom, shades.from);
        assertNear(uniforms.gradTo, shades.to);
    }
});

test('marker disc keeps an odd radius centred on the marker at fractional scales', () => {
    // A width of 2.75 gives radius 11, which is odd.
    const marker = {type: 'marker', x1: 50, y1: 40, x2: 50, y2: 40, width: 2.75};
    const {rect, uniforms} = markerDisc(marker, 4 / 3, 4 / 3);
    assert.deepEqual(rect, {x: 38, y: 28, width: 24, height: 24});
    assert.equal(rect.x + rect.width / 2, marker.x1);
    assert.equal(rect.y + rect.height / 2, marker.y1);
    assert.ok(Math.abs(uniforms.radii[0] - 11 * 4 / 3) < 1e-10);
    assert.ok(Math.abs(uniforms.radii[1] - 11 * 4 / 3) < 1e-10);
    assert.deepEqual(uniforms.fill, [1]);
    assert.ok(Math.abs(markerDisc(marker, 1, 1).uniforms.radii[0] - 11) < 1e-10);
});
