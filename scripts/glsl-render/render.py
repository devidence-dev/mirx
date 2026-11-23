#!/usr/bin/env python3
"""Headless GL render of the arrow fragment shader, checked against a numpy distance field.

Reads the case list printed by scripts/glsl-render/cases.mjs on stdin, renders each case with moderngl
(EGL, Mesa llvmpipe) and checks the alpha coverage, premultiplied output and gradient colours.
Prints PASS/FAIL/SKIP per check and exits 1 on any FAIL. Set MIRX_RENDER_PNG_DIR to also write PNGs.

Local run in an ephemeral container (no host GL or Python packages needed):
  node scripts/glsl-render/cases.mjs | docker run --rm -i -v "$PWD":/app -w /app python:3.12-slim sh -c "apt-get update -qq && apt-get install -y -qq libegl1 libgl1 libglx-mesa0 libgl1-mesa-dri >/dev/null && pip install -q moderngl numpy pillow && python3 -I scripts/glsl-render/render.py"
"""

import json
import os
import sys

import moderngl
import numpy as np
from PIL import Image

QUAD = np.array([-1, -1, 1, -1, -1, 1, 1, 1], dtype='f4')
TOL = 0.01  # slack for the 0/1 coverage and premultiplication inequalities
COLOUR_TOL = 0.03  # gradient end colours, un-premultiplied


def unpack(value):
    return float(value[0]) if len(value) == 1 else tuple(float(v) for v in value)


def render(ctx, case):
    W, H = case['W'], case['H']
    prog = ctx.program(vertex_shader=case['vertex'], fragment_shader=case['fragment'])
    for name, value in case['uniforms'].items():
        if name in prog:
            prog[name].value = unpack(value)
        else:
            print(f"NOTE {case['name']}: uniform '{name}' is not in the program")
    vbo = ctx.buffer(QUAD)
    vao = ctx.vertex_array(prog, [(vbo, '2f', 'pos')])
    tex = ctx.texture((W, H), 4, dtype='f4')
    fbo = ctx.framebuffer(color_attachments=[tex])
    fbo.use()
    ctx.viewport = (0, 0, W, H)
    ctx.disable(moderngl.BLEND)
    fbo.clear(0.0, 0.0, 0.0, 0.0)
    vao.render(moderngl.TRIANGLE_STRIP)
    ctx.finish()
    # Row 0 is texcoord y = 0, the same space as the shader's p.
    img = np.frombuffer(fbo.read(components=4, dtype='f4'), dtype='f4').reshape(H, W, 4)
    for obj in (fbo, tex, vao, vbo, prog):
        obj.release()
    return img


def segment(X, Y, a, b):
    ab = b - a
    px, py = X - a[0], Y - a[1]
    t = np.clip((px * ab[0] + py * ab[1]) / max(ab @ ab, 1e-6), 0, 1)
    return np.hypot(px - ab[0] * t, py - ab[1] * t), t


def verify(case, img):
    name, W, H, u = case['name'], case['W'], case['H'], case['uniforms']
    R, G, B, A = img[..., 0], img[..., 1], img[..., 2], img[..., 3]
    X, Y = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
    tail, tip, wing_a, wing_b = (np.array(u[k], dtype=float) for k in ('tail', 'tip', 'wingA', 'wingB'))
    stroke, aa = u['stroke'][0], u['antialias'][0]
    half = stroke / 2
    shaft, shaft_t = segment(X, Y, tail, tip)
    d = np.minimum(shaft, np.minimum(segment(X, Y, tip, wing_a)[0], segment(X, Y, tip, wing_b)[0]))

    out = []

    def check(label, ok, detail):
        out.append(('PASS' if ok else 'FAIL', f'{name}: {label} -- {detail}'))

    inner = d < half - aa
    if inner.any():
        lo = float(A[inner].min())
        check('coverage ~1 where d < stroke/2 - aa', lo >= 1 - TOL, f'{int(inner.sum())} px, min alpha={lo:.4f}')
    else:
        out.append(('SKIP', f'{name}: coverage ~1 inside -- no pixel has d < stroke/2 - aa (stroke {stroke}, aa {aa:.2f})'))

    outer = d > half + aa
    hi = float(A[outer].max()) if outer.any() else 1.0
    check('coverage ~0 where d > stroke/2 + aa', outer.any() and hi < TOL, f'{int(outer.sum())} px, max alpha={hi:.2e}')

    band = (A > 0.05) & (A < 0.95)
    err = float(np.abs(d[band] - half).max()) if band.any() else float('inf')
    check('AA band exists at stroke/2 +- aa', band.any() and err <= aa + TOL,
          f'{int(band.sum())} px, max |d - stroke/2| = {err:.3f} (limit {aa + TOL:.3f})')

    ring = np.zeros((H, W), bool)
    ring[0, :] = ring[-1, :] = ring[:, 0] = ring[:, -1] = True
    rmax = float(A[ring].max())
    check('1-px border ring alpha < 0.01', rmax < TOL, f'max alpha={rmax:.2e}')

    shaft_mask = (shaft <= max(half, 0.5)) & (shaft_t >= 0.25) & (shaft_t <= 0.75)
    smax = float(A[shaft_mask].max()) if shaft_mask.any() else 0.0
    check('shaft mid-section alpha >= 0.5', smax >= 0.5, f'{int(shaft_mask.sum())} px, max alpha={smax:.4f}')

    over = float(np.maximum.reduce([R - A, G - A, B - A]).max())
    check('premultiplied: every channel <= alpha', over <= TOL, f'max(channel - alpha)={over:.2e}')

    if case['gradient'] is None:
        dr = float(np.abs(R - A).max())
        dg = float(np.abs(G).max())
        db = float(np.abs(B).max())
        check('flat: R = alpha, G = B = 0', dr < TOL and dg < TOL and db < TOL,
              f'max|R-A|={dr:.2e} max|G|={dg:.2e} max|B|={db:.2e}')
    else:
        full = A > 0.99
        if not full.any():
            check('gradient: fully covered pixels exist', False, 'no pixel with alpha > 0.99')
        else:
            want = case['gradient']
            for label, point, colour in (('tail', tail, want['from']), ('tip', tip, want['to'])):
                dist2 = np.where(full, (X - point[0]) ** 2 + (Y - point[1]) ** 2, np.inf)
                j, i = np.unravel_index(int(np.argmin(dist2)), dist2.shape)
                got = img[j, i, :3] / img[j, i, 3]
                diff = float(np.abs(got - np.array(colour)).max())
                check(f'gradient colour at {label} == shades.{"from" if label == "tail" else "to"}',
                      diff <= COLOUR_TOL,
                      f'pixel ({X[j, i]:.1f}, {Y[j, i]:.1f}) rgb={np.round(got, 3).tolist()} '
                      f'want={np.round(colour, 3).tolist()} max diff={diff:.4f}')
    return out, (R, G, B, A)


def save_png(path, rgba):
    R, G, B, A = rgba
    rgb = np.stack([R * A + (1 - A), G * A + (1 - A), B * A + (1 - A)], -1)
    rgb = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)[::-1]  # flip so the top of the image is y = 0
    h, w = rgb.shape[:2]
    Image.fromarray(rgb, 'RGB').resize((w * 4, h * 4), Image.NEAREST).save(path)


def main():
    cases = json.load(sys.stdin)
    png_dir = os.environ.get('MIRX_RENDER_PNG_DIR')
    if png_dir:
        os.makedirs(png_dir, exist_ok=True)
    ctx = moderngl.create_standalone_context(backend='egl', require=330)
    print('GL renderer:', ctx.info['GL_RENDERER'], '|', ctx.info['GL_VERSION'], flush=True)

    failed = 0
    for case in cases:
        img = render(ctx, case)
        lines, rgba = verify(case, img)
        for status, text in lines:
            print(status, text, flush=True)
            failed += status == 'FAIL'
        if png_dir:
            save_png(os.path.join(png_dir, f"{case['name']}.png"), rgba)

    print('OVERALL', 'FAIL' if failed else 'PASS', f'({failed} failed, {len(cases)} cases)', flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
