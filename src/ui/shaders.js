export const GRADIENT_DECLARATIONS = `
uniform float gradient;
uniform vec2 gradStart;
uniform vec2 gradEnd;
uniform vec3 gradFrom;
uniform vec3 gradTo;

// Two-colour hue sweep along gradStart -> gradEnd; base is returned unchanged when the gradient is off.
vec3 gradientColor(vec2 p, vec3 base) {
    if (gradient < 0.5) return base;
    vec2 axis = gradEnd - gradStart;
    float length2 = dot(axis, axis);
    float t = length2 > 0.0 ? clamp(dot(p - gradStart, axis) / length2, 0.0, 1.0) : 0.5;
    return mix(gradFrom, gradTo, t);
}
`;

export const ELLIPSE_DECLARATIONS = `
${GRADIENT_DECLARATIONS}
uniform vec2 textureSize;
uniform vec2 contentOffset;
uniform vec2 extent;
uniform vec2 radii;
uniform float stroke;
uniform float antialias;
uniform vec3 ringColor;
uniform float fill;

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
if (fill > 0.5) {
    // Negative inside the ellipse, so the disc covers one physical pixel across its edge.
    float signedDistance = dot(p / radii, p / radii) < 1.0 ? -distance : distance;
    alpha = 1.0 - smoothstep(-antialias * 0.5, antialias * 0.5, signedDistance);
}
// Cogl blends premultiplied colour, so the RGB must be scaled by the alpha too.
cogl_color_out = vec4(gradientColor(p + extent * 0.5, ringColor), 1.0) * (alpha * cogl_color_in.a);
`;

export const GRADIENT_RECOLOR_DECLARATIONS = `
uniform vec2 textureSize;
uniform vec2 contentOffset;
uniform sampler2D tex;
${GRADIENT_DECLARATIONS}
`;

export const GRADIENT_RECOLOR_CODE = `
vec4 texel = cogl_color_in * texture2D(tex, vec2(cogl_tex_coord_in[0].xy));
vec2 p = cogl_tex_coord_in[0].xy * textureSize - contentOffset;
// Cogl blends premultiplied colour, so the RGB must be scaled by the alpha too.
cogl_color_out = vec4(gradientColor(p, vec3(0.0)) * texel.a, texel.a);
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

export const GUIDE_DECLARATIONS = `
uniform vec2 textureSize;
uniform vec2 contentOffset;
uniform float guidePixel;
uniform float guideVertical;
uniform float guideCore;
uniform sampler2D tex;
`;

export const GUIDE_CODE = `
// Strip-local physical pixels.
vec2 q = (cogl_tex_coord_in[0].xy * textureSize - contentOffset) / guidePixel;
float across = guideVertical > 0.5 ? q.x : q.y;
bool core = across >= guideCore && across < guideCore + 1.0;
// One mid-grey line with a softer halo of the same grey: no light/dark inversion, so it never reads as a
// double line, and the extra width keeps it visible over the dimmed area outside the selection.
vec4 color = vec4(vec3(0.62), 1.0) * (core ? 0.95 : 0.3);
// The offscreen texture is padded unevenly around the strip; its alpha masks the padding so the halo stays symmetric.
float coverage = texture2D(tex, vec2(cogl_tex_coord_in[0].xy)).a;
cogl_color_out = color * coverage * cogl_color_in.a;
`;

export const MASK_DECLARATIONS = `
uniform vec2 textureSize;
uniform vec2 contentOffset;
uniform vec2 extent;
uniform float radius;
uniform sampler2D tex;
`;

export const MASK_CODE = `
vec4 texel = cogl_color_in * texture2D(tex, vec2(cogl_tex_coord_in[0].xy));
vec2 p = cogl_tex_coord_in[0].xy * textureSize - contentOffset;
vec2 q = abs(p - extent * 0.5) - (extent * 0.5 - vec2(radius));
float d = length(max(q, vec2(0.0)));
// One resource pixel of antialiasing along the arc.
float a = clamp(radius - d + 0.5, 0.0, 1.0);
// Cogl blends premultiplied colour, so every channel is scaled.
cogl_color_out = texel * a;
`;

export const RING_DECLARATIONS = `
uniform vec2 textureSize;
uniform vec2 contentOffset;
uniform float ringPixel;
uniform float ringHalf;
uniform float ringRadius;
uniform float ringInner;
uniform float ringOuter;
`;

export const RING_CODE = `
// Ring-local physical pixels, centred on the target pixel centre.
vec2 p = (cogl_tex_coord_in[0].xy * textureSize - contentOffset) / ringPixel - vec2(ringHalf + 0.5);
vec2 a = abs(p);
float circle = abs(length(p) - ringRadius);
float tickH = max(a.y, max(ringInner - a.x, a.x - ringOuter));
float tickV = max(a.x, max(ringInner - a.y, a.y - ringOuter));
float d = min(circle, min(max(tickH, 0.0), max(tickV, 0.0)));
float core = clamp(1.0 - d, 0.0, 1.0);
float disc = clamp(ringRadius - length(p) + 0.5, 0.0, 1.0);
// Premultiplied layers: translucent grey disc under a 1 px mid-grey line, as in the guides.
vec4 under = vec4(vec3(0.5), 1.0) * 0.28 * disc;
cogl_color_out = (vec4(vec3(0.55), 1.0) * 0.9 * core + under * (1.0 - 0.9 * core)) * cogl_color_in.a;
`;
