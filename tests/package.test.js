import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { schemaCompiler } from '../scripts/tools.js';

test('metadata identifies a GNOME 50 extension and its schema', () => {
    const metadata = JSON.parse(readFileSync('metadata.json', 'utf8'));
    assert.equal(metadata.uuid, 'mirx@mirx.local');
    assert.equal(metadata['settings-schema'], 'org.gnome.shell.extensions.mirx');
    assert.ok(metadata['shell-version'].includes('50'));
});

test('schema compiles strictly when GLib is available', (t) => {
    const result = spawnSync(schemaCompiler(), ['--strict', '--dry-run', 'schemas'], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') return t.skip('glib-compile-schemas unavailable');
    assert.equal(result.status, 0, result.stderr);
});
