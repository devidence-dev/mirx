import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const symbolicPath = 'icons/mirx-symbolic.svg';

test('symbolic icon is suitable for recolouring', () => {
    assert.ok(symbolicPath.endsWith('-symbolic.svg'));
    const svg = readFileSync(symbolicPath, 'utf8');
    assert.doesNotMatch(svg, /\bstroke(?:\s*=|\s*:)/i);
    assert.doesNotMatch(svg, /\bfill\s*=\s*['"]none['"]/i);
    assert.doesNotMatch(svg, /gradient/i);
});

test('repository keeps the colour logo and no designer notes', () => {
    assert.ok(existsSync('icons/mirx.svg'));
    assert.ok(!existsSync('icons/README.txt'));
});

test('README starts with the colour logo', () => {
    const readme = readFileSync('README.md', 'utf8');
    assert.ok(readme.startsWith('<p align="center"><img src="icons/mirx.svg" width="128" alt="mirx logo"></p>'));
    assert.ok(existsSync('icons/mirx.svg'));
});
