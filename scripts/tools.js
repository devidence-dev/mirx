import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export function schemaCompiler() {
    const override = process.env.GLIB_COMPILE_SCHEMAS;
    if (override) {
        if (!isAbsolute(override)) throw new Error('GLIB_COMPILE_SCHEMAS must be an absolute path');
        return override;
    }
    if (existsSync('/usr/bin/glib-compile-schemas')) return '/usr/bin/glib-compile-schemas';
    for (const dir of existsSync('/usr/lib') ? readdirSync('/usr/lib') : []) {
        const candidate = join('/usr/lib', dir, 'glib-2.0', 'glib-compile-schemas');
        if (existsSync(candidate)) return candidate;
    }
    return '/usr/bin/glib-compile-schemas';
}
