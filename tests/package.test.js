import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { schemaCompiler } from '../scripts/tools.js';

test('metadata identifies a GNOME 50 extension and its schema', () => {
    const metadata = JSON.parse(readFileSync('metadata.json', 'utf8'));
    assert.equal(metadata.uuid, 'mirx@devidence.dev');
    assert.equal(metadata.url, 'https://github.com/devidence-dev/mirx');
    assert.equal(metadata['settings-schema'], 'org.gnome.shell.extensions.mirx');
    assert.ok(metadata['shell-version'].includes('50'));
});

test('schema compiles strictly when GLib is available', (t) => {
    const result = spawnSync(schemaCompiler(), ['--strict', '--dry-run', 'schemas'], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') return t.skip('glib-compile-schemas unavailable');
    assert.equal(result.status, 0, result.stderr);
});

test('license is declared and the full text is in the repository', () => {
    assert.equal(JSON.parse(readFileSync('package.json', 'utf8')).license, 'GPL-2.0-or-later');
    assert.match(readFileSync('LICENSE', 'utf8'), /GNU GENERAL PUBLIC LICENSE\s+Version 2, June 1991/);
});

function sourceFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? sourceFiles(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
    );
}

test('zip holds only runtime files and no compiled schema', (t) => {
    const archive = 'dist/mirx@devidence.dev.shell-extension.zip';
    const pack = spawnSync(process.execPath, ['scripts/pack.js'], { encoding: 'utf8' });
    if (/glib-compile-schemas|zip is required/.test(pack.stderr) && pack.status !== 0)
        return t.skip('packaging tools unavailable');
    assert.equal(pack.status, 0, pack.stderr);
    const list = spawnSync(
        'python3',
        ['-c', 'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', archive],
        {
            encoding: 'utf8',
        },
    );
    assert.equal(list.status, 0, list.stderr);
    const entries = list.stdout.split('\n').filter(Boolean);
    const expected = [
        'extension.js',
        'prefs.js',
        'metadata.json',
        'stylesheet.css',
        'schemas/org.gnome.shell.extensions.mirx.gschema.xml',
        ...sourceFiles('src'),
    ];
    assert.deepEqual([...entries].sort(), expected.sort());
    assert.ok(!entries.includes('schemas/gschemas.compiled'));
});

// check.js reads metadata.json and package.json from the working directory, so run it in a scratch copy.
function checkWithVersions(versionName, packageVersion) {
    const dir = mkdtempSync(join(tmpdir(), 'mirx-check-'));
    const metadata = { ...JSON.parse(readFileSync('metadata.json', 'utf8')), 'version-name': versionName };
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: packageVersion }));
    return spawnSync(process.execPath, [resolve('scripts/check.js')], { cwd: dir, encoding: 'utf8' });
}

test('versions: version-name matches package.json and is X.Y.Z', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    assert.equal(JSON.parse(readFileSync('metadata.json', 'utf8'))['version-name'], version);
    assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('check fails when version-name is not X.Y.Z', () => {
    const result = checkWithVersions('1.0', '1.0');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /version-name '1\.0' is not X\.Y\.Z/);
});

test('check fails when version-name differs from package.json version', () => {
    const result = checkWithVersions('0.1.0', '0.2.0');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /version-name '0\.1\.0' differs from package\.json version '0\.2\.0'/);
});
