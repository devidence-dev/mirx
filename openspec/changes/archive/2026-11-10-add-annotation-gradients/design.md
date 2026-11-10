# Design

## Context

See `proposal.md` for motivation and `specs/annotation-gradients/spec.md` for behaviour. This change depends on `add-numbered-markers`: it assumes the `marker` annotation, its disc drawn by `EllipseEffect` with the `fill` uniform, and its separate `Clutter.Text` label. Facts from the current code that decide the approach:

- Rendering is mixed. **Ellipses are GLSL**: `EllipseEffect` (`Shell.GLSLEffect`) replaces the fragment of a white `Clutter.Actor` and writes `ringColor` with an antialiased coverage (`src/ui/shaders.js`, `src/ui/annotationActors.js`). **Rectangles are one `St.Widget`** with `border: Npx solid <color>`, and **arrows are three rotated `St.Widget` bars** with `background-color`, inside a `Clutter.Actor` container that has no position or size of its own, so its children sit in stage coordinates. Highlighter is a translucent `St.Widget`, text is `Clutter.Text`, pixelate is GLSL.
- St CSS can shade a *background* (`background-gradient-*`) but cannot shade a *border*, so a CSS gradient cannot colour a rectangle outline, and the arrow's three separately rotated bars would each restart their own gradient.
- `setStyle` copies a style change onto the selected annotation. Gradient uses the same path for supported types (spec: same rules as colour and width).
- Effects already follow one convention: uniforms are set in `vfunc_paint_target` from `get_resource_scale()` and `effectTextureUniforms`, which recovers the content origin from the real offscreen texture. This keeps physical-pixel alignment and gives the same result in the overlay and in `paint_to_content` during export.
- Export paints the committed layer as is (`Overlay.withExportContent` hides only decorations and the draft), so anything rendered by an actor effect is exported without export changes. Ellipses and pixelate already prove that effects survive `paint_to_content`.

## Goals / Non-Goals

**Goals:**
- One gradient mechanism for all four shapes, GPU only, sharing GLSL with the ellipse.
- Flat annotations keep their exact current actors, cost and look.
- The gradient follows the shape under move, resize and recolour with no extra editor logic.

**Non-Goals:**
- Replacing the St rendering of flat rectangles and arrows.
- A configurable gradient (second colour, angle, stops) or a stored default.

## Decisions

### D1. Editor state: a `gradient` style flag stored only where it applies

`Editor.style` becomes `{color, width, gradient}`; the constructor takes `gradient = false`. A pure `supportsGradient(type)` in `src/core/editor.js` is true for `arrow`, `rectangle`, `circle` and `marker`. When an annotation is created (`pointerDown` draw gesture, marker placement) the stored value is `style.gradient && supportsGradient(type)`; text and the other types store `false`. The renderer therefore reads one boolean and needs no type list.

`setStyle` updates `this.style.gradient` and, like colour and width, copies it onto the selected annotation, but only when `supportsGradient(selected.type)`; for other types it copies colour and width only. This reuses the existing commit, so toggling a selected arrow, rectangle, ellipse or marker is one undo entry. With nothing selected, or an unsupported type selected, the snapshot is unchanged and `CommandHistory.commit` records nothing.

Alternative rejected: new annotations only. The user chose consistency with colour and width.

### D2. Not persisted

The existing `default-color` and `default-width` are preferences, but a `default-gradient` key would add a schema key, a `prefs.js` row, `extension.js` wiring and tests for a setting nobody asked for. The toggle starts off in every session. It can be added later without changing this design.

### D3. Shades are computed in JavaScript and passed as uniforms

A pure `gradientShades(hex)` in `src/rendering/actorGeometry.js` returns `{from, to}` as 0 to 1 RGB triples. The style changed after three visual reviews: light-to-deep looked too dark, then too faint, and a white "shine" middle suited warm colours but washed out cool ones. It now follows the reference examples the user chose, a two-colour hue sweep. Both ends are lifted to at least 62% lightness, a vivid pastel like the reference, so the sweep stays visible on dark content; `from` adds 0.04 more lightness, and `to` rotates the hue towards pink or violet: −45° for warm hues (below 90° or from 300°) and +50° for the rest, so red goes to pink, yellow to orange-red, green to teal, blue to violet and violet to pink. Purples (hue 250° to 300°) would otherwise end in the same hot pink as red, so they start 12° bluer without the extra lift and stop 28° further on, in magenta (the palette violet runs `#aa55ff` to `#ff55e3`). Achromatic colours keep `from` equal to `to` and stay flat. The numbers are named constants; interpolation is linear in stored sRGB values.

Alternative rejected: derive the shades in GLSL. It would hide a testable rule inside a shader that Node cannot run.

### D4. Gradient axis is a pure helper in actor-local pixels

A pure `gradientAxis(annotation, size)` returns `{start, end}` in logical pixels relative to the actor's top-left:

- arrow: tail to head, relative to the arrow container's origin (D6);
- rectangle, ellipse and marker: `(0, 0)` to `(width, height)` of the actor box, which is the corner-to-corner diagonal. The box is always normalized (top-left origin), so the direction does not depend on the drag direction.

The shader projects each fragment on the axis, clamps to 0 to 1 and mixes `light` to `deep`. The stroke padding of rectangles and ellipses (half the width) is part of the box and is ignored, since it is a rounding-level difference of the axis end points.

### D5. One shared GLSL function, two ways to apply it

`src/ui/shaders.js` gets `GRADIENT_DECLARATIONS`: uniforms `gradient` (0 or 1), `gradStart`, `gradEnd`, `gradFrom`, `gradTo`, and `vec3 gradientColor(vec2 p, vec3 base)` which returns `base` when `gradient` is 0.

1. **Ellipse and marker disc**: `ELLIPSE_DECLARATIONS` includes it and `ELLIPSE_CODE` writes `gradientColor(p + extent * 0.5, ringColor)` in place of `ringColor` (the ellipse `p` is centre-relative; the axis is top-left relative). The effect is always attached, as now, and `gradient` is 0 or 1 per annotation.
2. **Rectangle and arrow**: a new `GradientEffect` (`Shell.GLSLEffect`, replace snippet) samples its offscreen texture explicitly through `uniform sampler2D tex` and `texture2D(tex, cogl_tex_coord_in[0].xy)`, the pattern GNOME Shell 50's own JS effects use, and recolours the St pixels keeping their alpha: `cogl_color_out = vec4(gradientColor(p, vec3(0.0)) * texel.a, texel.a)`. A post snippet reading `cogl_color_out` was tried first and left the arrows flat in GNOME Shell 50.1 (premultiplied, `p` from `cogl_tex_coord_in[0]`, `textureSize` and `contentOffset` as in the ellipse). The border or bar pixels, including their rounded corners and antialiasing, come from St unchanged.

Alternatives rejected:
- **Per-shape St CSS gradient**: impossible for borders (see Context) and wrong for arrow bars.
- **Rewrite rectangles and arrows as SDF shaders**: gives full control, but replaces working, tested flat rendering and risks regressions in every existing rectangle and arrow.
- **Stacked actors with clipping masks**: more actors and clip state per annotation, and seams at fractional scales.

Scope of ellipse risk: sharing `ELLIPSE_CODE` changes a shader that existing ellipses use. With `gradient` 0, `gradientColor` returns `ringColor`, so the output is identical.

### D6. The recolour effect exists only while an annotation has a gradient

`_updateEntry` adds a `GradientEffect` to a rectangle or arrow actor when `annotation.gradient` is true and removes it when false (history can swap in an annotation of the same id with another state). Flat rectangles and arrows never have an effect, so they keep their exact current path and pay no offscreen render. The effect is created once per entry and reused while the gradient stays set; its uniforms are written in `vfunc_paint_target` like the other effects.

The arrow container must have a real box, otherwise the effect's offscreen texture would cover the whole stage. A pure `arrowBounds(annotation)` returns the box around the tail, tip, both head-bar ends and `width / √2` of padding (half the width would leave rotated bar corners outside the box); the container is placed and sized to it and the three bars are positioned relative to its origin (`arrowBars` itself is unchanged). This applies to every arrow, flat or gradient, so there is one code path; existing arrow position tests are updated for the relative offsets.

### D7. Marker label stays outside the effect

The marker's disc and label are siblings (see `add-numbered-markers` D4), and only the disc has an effect, so the number is never shaded. The label colour is still chosen from the marker's own colour, not from the shades; at the light end of a dark colour the contrast is lower than at the middle. This is accepted and checked in the real-session task.

### D8. Toolbar toggle

One `St.Button` with glyph `◐` and the accessible name `Gradient` at the end of the style row, using the existing `.mirx-button` and `checked` pseudo-class. It shows `editor.style.gradient`. Selecting an annotation does not change the toggle state, matching how the colour and width buttons behave today. The toolbar has no tool shortcuts, so none is added. The glyph is checked in the real session; `G` is the fallback.

### D9. Cache keys and export

`entry.key` already contains the full annotation JSON, so a changed `gradient` or `color` re-runs `_updateEntry`. Ellipses and markers already add the physical scale to the key; rectangles and arrows need none because their effect reads the scale at paint time. No export code changes: effects run in `paint_to_content`, and uniforms come from the resource scale at paint time, as for ellipses.

## Risks / Trade-offs

- [Effects that read their own texture depend on how `Shell.GLSLEffect` builds the snippet] -> confirmed in a real session: a post snippet left arrows flat, so the recolour (and the magnifier mask) use GNOME Shell's own explicit-sampler pattern; checked again in task 6.2.
- [The offscreen texture for a selection-sized gradient rectangle is large] -> only gradient rectangles pay it, and ellipses already do; checked with `perf-log` in the real session.
- [Giving every arrow a bounded container changes flat arrow placement code] -> the bars' stage positions are unchanged (container origin plus relative offset), covered by updated arrow tests and the manual check of flat arrows.
- [Banding on very short gradients] -> the hue sweep runs over at least the arrow or box length; checked visually at 1x, 2x and about 1.33x.
- [Shader uniform name clashes with the ellipse declarations] -> new names are prefixed `grad`, and the existing `extent`, `textureSize`, `contentOffset` are reused, not redeclared.

## Migration Plan

No data or preference migration. Existing annotations have no `gradient` field and read as flat. Rollback is reverting the change.

## Open Questions

None that change the specs or tasks. Scope questions were resolved with the user: highlighter stays flat, no line or pen tool, the toggle is not persisted, and it applies to the selected annotation like colour and width.
