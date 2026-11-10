import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as shaders from '../src/ui/shaders.js';

const SNIPPET = /add_glsl_snippet\(\s*Cogl\.SnippetHook\.(\w+),\s*(\w+)_DECLARATIONS,\s*(\w+)_CODE/g;

// Cogl splices a snippet into its own shader; these prologues mimic what each hook provides.
const WRAPPERS = {
    FRAGMENT: (declarations, code) => `#version 110
varying vec4 cogl_color_in;
varying vec4 cogl_tex_coord_in[1];
#define cogl_color_out gl_FragColor
${declarations}
void main() {
cogl_color_out = cogl_color_in;
${code}
}
`,
    TEXTURE_LOOKUP: (declarations, code) => `#version 110
uniform sampler2D cogl_sampler;
vec4 cogl_tex_coord;
${declarations}
void main() {
vec4 cogl_texel;
cogl_tex_coord = vec4(0.0);
${code}
gl_FragColor = cogl_texel;
}
`,
};

// Maps shader name (e.g. PIXELATE) to the Cogl hook it is registered on, read from the source files.
export function hookMap(sources) {
    const map = new Map();
    for (const source of sources) {
        for (const [, hook, declarations, code] of source.matchAll(SNIPPET)) {
            if (declarations !== code)
                throw new Error(`Mismatched snippet pair: ${declarations}_DECLARATIONS / ${code}_CODE`);
            map.set(declarations, hook);
        }
    }
    return map;
}

// Every exported *_CODE needs its *_DECLARATIONS and a known hook. A lone *_DECLARATIONS is a shared fragment.
export function shaderPairs(exported, hooks) {
    return Object.keys(exported)
        .filter((key) => key.endsWith('_CODE'))
        .map((key) => {
            const name = key.slice(0, -'_CODE'.length);
            const declarations = exported[`${name}_DECLARATIONS`];
            if (declarations === undefined) throw new Error(`${key} has no ${name}_DECLARATIONS`);
            const hook = hooks.get(name);
            if (!hook) throw new Error(`${name} is not registered with add_glsl_snippet in any source file`);
            if (!WRAPPERS[hook]) throw new Error(`${name} uses unsupported hook ${hook}`);
            return { name, hook, source: WRAPPERS[hook](declarations, exported[key]) };
        });
}

function sourceFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.js') ? [path] : [];
    });
}

function main() {
    const src = fileURLToPath(new URL('../src', import.meta.url));
    const hooks = hookMap(sourceFiles(src).map((file) => readFileSync(file, 'utf8')));
    const pairs = shaderPairs(shaders, hooks);
    const dir = mkdtempSync(join(tmpdir(), 'mirx-glsl-'));
    let failed = 0;
    try {
        for (const { name, hook, source } of pairs) {
            const file = join(dir, `${name}.frag`);
            writeFileSync(file, source);
            const result = spawnSync('glslangValidator', ['-S', 'frag', file], { encoding: 'utf8' });
            if (result.error?.code === 'ENOENT') {
                console.error('glslangValidator not found. Install it with: sudo apt-get install glslang-tools');
                process.exit(1);
            }
            if (result.error) throw result.error;
            if (result.status === 0) {
                console.log(`ok   ${name} (${hook})`);
            } else {
                failed++;
                console.error(`FAIL ${name} (${hook})\n${result.stdout}${result.stderr}`);
            }
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
    if (failed) {
        console.error(`${failed} of ${pairs.length} shaders failed validation.`);
        process.exit(1);
    }
    console.log(`${pairs.length} shaders valid.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
