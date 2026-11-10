import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { ICON_FILES } from '../src/ui/toolbarModel.js';

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

test('toolbar icons match the model and are filled symbolic SVGs', () => {
    const files = readdirSync('icons/tools').sort();
    assert.deepEqual(files, [...ICON_FILES].sort());
    for (const file of files) {
        assert.match(file, /-symbolic\.svg$/);
        const svg = readFileSync(`icons/tools/${file}`, 'utf8');
        assert.match(svg, /viewBox="0 0 16 16"/);
        assert.doesNotMatch(
            svg,
            /\bstroke(?:\s*=|\s*:)|\bfill\s*=\s*['"]none['"]|<(?:linear|radial)gradient\b|<text\b|\bstyle\s*=/i,
            file,
        );
    }
});
