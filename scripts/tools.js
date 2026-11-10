import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export function schemaCompiler() {
    if (process.env.GLIB_COMPILE_SCHEMAS) return process.env.GLIB_COMPILE_SCHEMAS;
    if (!spawnSync('glib-compile-schemas', ['--version']).error) return 'glib-compile-schemas';
    for (const dir of existsSync('/usr/lib') ? readdirSync('/usr/lib') : []) {
        const candidate = join('/usr/lib', dir, 'glib-2.0', 'glib-compile-schemas');
        if (existsSync(candidate)) return candidate;
    }
    return 'glib-compile-schemas';
}
