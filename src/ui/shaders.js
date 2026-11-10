export const ELLIPSE_DECLARATIONS = `
uniform vec2 textureSize;
uniform vec2 contentOffset;
uniform vec2 extent;
uniform vec2 radii;
uniform float stroke;
uniform float antialias;
uniform vec3 ringColor;

// Find the closest ellipse point with a monotone Lagrange-multiplier root.
// Sorting the radii and handling the major axis also covers the ellipse centre.
float ellipseDistance(vec2 p, vec2 r) {
    p = abs(p);
    if (r.x < r.y) { r = r.yx; p = p.yx; }
    vec2 r2 = r * r;
    vec2 closest;
    if (p.y == 0.0) {
        float gap = r2.x - r2.y;
        if (r.x * p.x < gap) {
            float x = r2.x * p.x / gap;
            closest = vec2(x, r.y * sqrt(max(0.0, 1.0 - x * x / r2.x)));
        } else {
            closest = vec2(r.x, 0.0);
        }
    } else {
        float lo = r.y * p.y - r2.y;
        float hi = length(r * p);
        for (int i = 0; i < 24; i++) {
            float t = (lo + hi) * 0.5;
            vec2 q = r * p / (vec2(t) + r2);
            if (dot(q, q) > 1.0) lo = t; else hi = t;
        }
        closest = r2 * p / (vec2((lo + hi) * 0.5) + r2);
    }
    return length(p - closest);
}`;

export const ELLIPSE_CODE = `
vec2 p = cogl_tex_coord_in[0].xy * textureSize - contentOffset - extent * 0.5;
float distance = ellipseDistance(p, radii);
// One physical pixel of coverage around both edges of a constant-width ring.
float alpha = 1.0 - smoothstep(stroke * 0.5 - antialias * 0.5,
                              stroke * 0.5 + antialias * 0.5, distance);
// Cogl blends premultiplied colour, so the RGB must be scaled by the alpha too.
cogl_color_out = vec4(ringColor, 1.0) * (alpha * cogl_color_in.a);
`;

export const PIXELATE_DECLARATIONS = `
uniform vec2 textureSize;
uniform vec2 contentOffset;
uniform vec2 extent;
uniform vec2 anchor;
uniform float block;
`;

export const PIXELATE_CODE = `
vec2 p = cogl_tex_coord.xy * textureSize - contentOffset;
cogl_texel = vec4(0.0);
if (all(greaterThanEqual(p, vec2(0.0))) && all(lessThan(p, extent))) {
    // The grid stays anchored to the original bounds even after clipping.
    vec2 start = floor((p + anchor) / block) * block - anchor;
    vec2 lo = max(start, vec2(0.0));
    vec2 hi = min(start + vec2(block), extent);
    vec3 sum = vec3(0.0);
    for (int y = 0; y < 4; y++) {
        for (int x = 0; x < 4; x++) {
            vec2 samplePoint = mix(lo, hi, (vec2(float(x), float(y)) + 0.5) / 4.0);
            // Avoid transparent offscreen padding, including partial edge blocks.
            vec2 inset = min(vec2(0.5), extent * 0.5);
            samplePoint = clamp(samplePoint, inset, extent - inset);
            vec4 sampleColor = texture2D(cogl_sampler, (contentOffset + samplePoint) / textureSize);
            sum += sampleColor.rgb / max(sampleColor.a, 0.00001);
        }
    }
    // Replace every covered fragment with the average; never mix in the source.
    cogl_texel = vec4(sum / 16.0, 1.0);
}
`;
