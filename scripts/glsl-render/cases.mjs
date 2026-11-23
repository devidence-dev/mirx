// Prints the arrow shader render cases as JSON for render.py: shader sources plus the uniforms the actor sends.
import { ARROW_DECLARATIONS, ARROW_CODE } from '../../src/ui/shaders.js';
import { arrowBounds, arrowUniforms, gradientShades, gradientUniforms } from '../../src/rendering/actorGeometry.js';

const FRAGMENT = `#version 330
in vec4 cogl_tex_coord_in[1];
out vec4 fragColor;
#define cogl_color_out fragColor
const vec4 cogl_color_in = vec4(1.0);
${ARROW_DECLARATIONS}
void main() {
${ARROW_CODE}
}
`;

const VERTEX = `#version 330
in vec2 pos;
out vec4 cogl_tex_coord_in[1];
void main() {
    cogl_tex_coord_in[0] = vec4(pos * 0.5 + 0.5, 0.0, 1.0);
    gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const SCALES = [
    [1, 1],
    [2, 1.25],
];

const SHAPES = [
    { name: 'diagonal-flat', a: { type: 'arrow', x1: 20, y1: 30, x2: 120, y2: 90, width: 6 } },
    {
        name: 'diagonal-gradient',
        a: { type: 'arrow', x1: 20, y1: 30, x2: 120, y2: 90, width: 6, gradient: true },
        shades: gradientShades('#ff0000'),
    },
    { name: 'vertical-flat', a: { type: 'arrow', x1: 50, y1: 20, x2: 50, y2: 120, width: 6 } },
    { name: 'very-short-flat', a: { type: 'arrow', x1: 40, y1: 40, x2: 43, y2: 41, width: 6 } },
    { name: 'hairline-flat', a: { type: 'arrow', x1: 20, y1: 30, x2: 120, y2: 90, width: 1 } },
];

const cases = [];
for (const { name, a, shades = null } of SHAPES) {
    const bounds = arrowBounds(a);
    for (const [rs, ps] of SCALES) {
        const W = Math.ceil(bounds.width * rs);
        const H = Math.ceil(bounds.height * rs);
        cases.push({
            name: `${name}-rs${rs}-ps${ps}`,
            rs,
            ps,
            W,
            H,
            fragment: FRAGMENT,
            vertex: VERTEX,
            gradient: shades,
            uniforms: {
                ...gradientUniforms(a, bounds, shades, rs),
                ...arrowUniforms(a, rs, ps),
                textureSize: [W, H],
                contentOffset: [0, 0],
                arrowColor: [1, 0, 0],
            },
        });
    }
}

process.stdout.write(`${JSON.stringify(cases)}\n`);
