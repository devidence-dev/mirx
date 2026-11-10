import assert from 'node:assert/strict';
import test from 'node:test';
import { hookMap, shaderPairs } from '../scripts/glsl-check.js';

const registered = `
this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, A_DECLARATIONS, A_CODE, true);
this.add_glsl_snippet(
    Cogl.SnippetHook.TEXTURE_LOOKUP,
    B_DECLARATIONS,
    B_CODE,
    true,
);`;

test('hookMap reads single-line and wrapped add_glsl_snippet calls', () => {
    assert.deepEqual(
        [...hookMap([registered])],
        [
            ['A', 'FRAGMENT'],
            ['B', 'TEXTURE_LOOKUP'],
        ],
    );
});

test('shaderPairs wraps each pair for its hook and ignores lone declarations', () => {
    const hooks = hookMap([registered]);
    const pairs = shaderPairs(
        { A_DECLARATIONS: 'uniform float a;', A_CODE: 'a;', B_DECLARATIONS: '', B_CODE: '', SHARED_DECLARATIONS: '' },
        hooks,
    );
    assert.deepEqual(
        pairs.map((p) => [p.name, p.hook]),
        [
            ['A', 'FRAGMENT'],
            ['B', 'TEXTURE_LOOKUP'],
        ],
    );
    assert.match(pairs[0].source, /#define cogl_color_out gl_FragColor\nuniform float a;/);
    assert.match(pairs[1].source, /uniform sampler2D cogl_sampler;[\s\S]*vec4 cogl_texel;/);
});

test('shaderPairs fails on an unmapped pair, a missing declaration or an unsupported hook', () => {
    const hooks = hookMap([registered]);
    assert.throws(() => shaderPairs({ C_DECLARATIONS: '', C_CODE: '' }, hooks), /C is not registered/);
    assert.throws(() => shaderPairs({ A_CODE: '' }, hooks), /no A_DECLARATIONS/);
    assert.throws(
        () => shaderPairs({ D_DECLARATIONS: '', D_CODE: '' }, new Map([['D', 'VERTEX']])),
        /unsupported hook VERTEX/,
    );
});
