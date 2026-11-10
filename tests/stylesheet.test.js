import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync('stylesheet.css', 'utf8');
function rule(name) {
    const match = css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `missing ${name}`);
    return match[1];
}
function contrast(rgb) {
    const luminance = rgb
        .map((v) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    return 1.05 / (luminance + 0.05);
}
function color(ruleText, property) {
    const match = ruleText.match(
        new RegExp(`${property}:\\s*rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)`),
    );
    assert.ok(match, `missing ${property}`);
    return [...match.slice(1, 4).map(Number), match[4] === undefined ? 1 : Number(match[4])];
}
function compose([red, green, blue, alpha], backdrop) {
    return [red, green, blue].map((v, i) => v * alpha + backdrop[i] * (1 - alpha));
}

test('toolbar tokens and legible tints', () => {
    for (const name of [
        'mirx-toolbar',
        'mirx-toolbar-solid',
        'mirx-row',
        'mirx-group',
        'mirx-divider',
        'mirx-button',
        'mirx-icon-button',
        'mirx-swatch',
        'mirx-primary',
        'mirx-tooltip',
    ])
        rule(name);
    assert.doesNotMatch(css, /backdrop-filter/);
    for (const match of css.matchAll(/box-shadow:\s*([^;]+);/g)) {
        assert.doesNotMatch(match[1].replace(/rgba?\([^)]*\)/g, ''), /,/);
    }
    assert.match(rule('mirx-toolbar'), /color:\s*#ffffff/);
    for (const state of ['hover', 'active', 'checked', 'focus', 'disabled']) rule(`mirx-button:${state}`);
    for (const [card, backdrop] of [
        ['mirx-toolbar', 255 * 0.75],
        ['mirx-toolbar-solid', 255],
    ]) {
        for (const stop of ['start', 'end']) {
            const surface = compose(color(rule(card), `background-gradient-${stop}`), [backdrop, backdrop, backdrop]);
            for (const button of [
                'mirx-button',
                'mirx-button:hover',
                'mirx-button:active',
                'mirx-button:checked',
                'mirx-primary',
                'mirx-primary:hover',
                'mirx-primary:active',
            ]) {
                const ratio = contrast(compose(color(rule(button), 'background-color'), surface));
                assert.ok(ratio >= 3, `${card} ${stop} ${button}: ${ratio}`);
            }
        }
    }
});

test('swatch is a circle and the label button is gone', () => {
    // Size comes from toolbar.js (actor width/height); the radius must be exactly half of it.
    const size = Number(/const SWATCH_SIZE = (\d+);/.exec(readFileSync('src/ui/toolbar.js', 'utf8'))[1]);
    assert.equal(size, 28);
    assert.match(rule('mirx-swatch'), new RegExp(`border-radius:\\s*${size / 2}px`));
    assert.doesNotMatch(rule('mirx-swatch'), /(?:^|[\s;])(?:width|height)\s*:/);
    assert.match(rule('mirx-swatch'), /padding:\s*0;/);
    assert.match(rule('mirx-swatch'), /border:\s*2px solid/);
    assert.doesNotMatch(css, /mirx-label-button/);
});

test('frame and handle dimensions', () => {
    assert.match(rule('mirx-frame'), /border:\s*2px solid rgb\(51, 166, 255\)/);
    // St renders box-shadow as a filled box: on the frame it darkened the whole selection.
    assert.doesNotMatch(rule('mirx-frame'), /box-shadow:/);
    assert.match(rule('mirx-frame-ring'), /border:\s*1px solid rgba\(0, 0, 0, 0\.45\)/);
    assert.doesNotMatch(rule('mirx-frame-ring'), /background|box-shadow/);
    assert.match(rule('mirx-handle'), /width:\s*10px/);
    assert.match(rule('mirx-handle'), /height:\s*10px/);
    assert.match(rule('mirx-handle'), /border-radius:\s*5px/);
});
