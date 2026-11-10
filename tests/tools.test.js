import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

function untrustedPath(t) {
    const dir = mkdtempSync(join(tmpdir(), 'mirx-untrusted-path-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const marker = join(dir, 'executed');
    for (const tool of ['glib-compile-schemas', 'glslangValidator']) {
        writeFileSync(
            join(dir, tool),
            `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.MIRX_TEST_MARKER, 'executed'); process.exit(42);\n`,
            { mode: 0o755 },
        );
    }
    const env = { ...process.env, PATH: dir, MIRX_TEST_MARKER: marker };
    delete env.GLIB_COMPILE_SCHEMAS;
    return { env, marker };
}

const compilerScript = `import { schemaCompiler } from ${JSON.stringify(new URL('../scripts/tools.js', import.meta.url).href)};
console.log(schemaCompiler());`;

test('schema compiler ignores executables in the inherited PATH', (t) => {
    const { env, marker } = untrustedPath(t);
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', compilerScript], {
        env,
        encoding: 'utf8',
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(isAbsolute(result.stdout.trim()));
    assert.ok(result.stdout.trim().startsWith('/usr/'));
    assert.equal(existsSync(marker), false);
});

test('schema compiler requires an absolute override and preserves explicit paths', (t) => {
    const { env, marker } = untrustedPath(t);
    for (const override of ['glib-compile-schemas', './glib-compile-schemas', '/custom/glib-compile-schemas']) {
        const result = spawnSync(process.execPath, ['--input-type=module', '-e', compilerScript], {
            env: { ...env, GLIB_COMPILE_SCHEMAS: override },
            encoding: 'utf8',
        });
        assert.ifError(result.error);
        if (isAbsolute(override)) {
            assert.equal(result.status, 0, result.stderr);
            assert.equal(result.stdout.trim(), override);
        } else {
            assert.equal(result.status, 1);
            assert.match(result.stderr, /GLIB_COMPILE_SCHEMAS must be an absolute path/);
        }
    }
    assert.equal(existsSync(marker), false);
});

test('GLSL validation ignores executables in the inherited PATH', (t) => {
    const { env, marker } = untrustedPath(t);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/glsl-check.js', import.meta.url))], {
        env,
        encoding: 'utf8',
    });
    assert.ifError(result.error);
    assert.equal(existsSync(marker), false);
    if (result.status === 0) assert.match(result.stdout, /\d+ shaders valid\./);
    else {
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /glslangValidator not found/);
    }
});
