# Design

## Context

See `proposal.md` for motivation and `specs/numbered-markers/spec.md` for behaviour. Facts that shape the approach, all read from the current code:

- `Editor` (`src/core/editor.js`) holds `annotations` as an array whose order is both stacking order and creation order. `CommandHistory` stores whole-array JSON snapshots, so undo, redo and delete restore exact arrays. `_nextId` only makes unique ids; it is never shown.
- Annotation geometry is `x1,y1,x2,y2` plus `color` and `width`. `setStyle` copies a style change onto the selected annotation. `annotationRect` and `annotationHit` give every shape its box and hit test; `pointerDown` skips resize handles for text.
- `AnnotationActors` (`src/ui/annotationActors.js`) keeps one actor per annotation, rebuilt only when `JSON.stringify` of the annotation changes. Arrows are three rotated `St.Widget` bars and rectangles are one `St.Widget` with a CSS border. **Ellipses are GLSL**: a white `Clutter.Actor` with `EllipseEffect` (`Shell.GLSLEffect`, `src/ui/shaders.js`) that draws an antialiased ring from uniforms. Pixelate is GLSL too. Text is `Clutter.Text`.
- Export (`GpuImageOutput.render`) calls `global.stage.paint_to_content` through `Overlay.withExportContent`, which hides decorations and the draft layer. The committed annotation layer is painted as is, so anything drawn there is exported with no extra code.
- The toolbar (`src/ui/toolbar.js`) is a list of `[tool, glyph, name]` entries. It has no tool keyboard shortcuts.

## Goals / Non-Goals

**Goals:**
- Markers behave like existing annotations everywhere the editor already treats annotations generically: history, selection, move, restyle, delete, export.
- Numbering correct by construction, with no renumbering code path to keep in sync with undo, redo or delete.
- No new GNOME API and no new rendering mechanism.

**Non-Goals:**
- A marker draft or hover preview, drag-to-place, number editing, or a numbering preference.
- Gradient fills (`add-annotation-gradients`).

## Decisions

### D1. The number is derived, never stored

The label of a marker is `1 + the count of markers before it in annotations`. A pure helper `markerNumbers(annotations)` returns `Map<id, number>` and lives next to `annotationRect` in `src/core/editor.js`. The next number needs no counter: it is the marker count plus one.

Why: history already snapshots the array, so delete, undo and redo restore a consistent array and the numbers follow. A stored number would need a renumber step in `deleteSelected`, `undo` and `redo`, and would break the "redo restores consistently" rule whenever one path forgot it.

Alternative rejected: a stored `number` field renumbered on each mutation. More code, more failure paths, and the snapshot would carry redundant data.

Consequence: the actor cache key must include the number (D5), because deleting marker 1 changes the label of marker 2 without changing marker 2's own JSON.

### D2. Marker shape: centre in `x1,y1`, radius from width

A marker is `{type: 'marker', x1, y1, x2: x1, y2: y1, color, width}`. `x2,y2` equal `x1,y1` so the generic move code, which shifts both points, needs no change. A pure `markerRadius(width) = max(10, 4 * width)` in `src/core/geometry.js` is the size factor (default width 3 gives a 24 px circle, width 30 gives 240 px). Changing the width of a selected marker therefore resizes it around its centre through the existing `setStyle` path.

`annotationRect` returns the square `centre ± radius` for markers, so decorations draw the selection box with no marker-specific box code. `annotationHit` for `marker` is `distance(point, centre) <= radius`. `pointerDown` and `DecorationActors` skip handles for `marker` exactly as they do for text.

Alternative rejected: store the bounding box in `x1..y2` like rectangles. It would allow resize handles that the spec excludes, and width changes would need a recentring step.

### D3. Placement is a click, handled in `pointerDown`

When `tool === 'marker'` and the point is inside the selection, `pointerDown` pushes the marker and commits one history entry (the same `_snapshot`/`_commit` pair `addText` uses), and returns without starting a gesture. This keeps the selection-handle check that already runs first, so a press on an outer handle still resizes. No draft is created, so the draft layer and its export hiding are untouched. The tool stays active, like the other draw tools.

Alternative rejected: reuse the `draw` gesture and commit on release. It would need a zero-length exception (`pointerUp` drops zero-length drags) and would add a draft that shows a wrong number while other markers change.

### D4. Rendering reuses the ellipse shader with a `fill` uniform

The marker actor is a `Clutter.Actor` container with two children: a disc and a `Clutter.Text` label. Only the disc carries an effect, so the number is not affected by it (this matters for the gradient change).

The disc is a white `Clutter.Actor` with `EllipseEffect`, positioned on a square of the marker's bounds padded by 1 logical px for the antialiasing fringe. `ELLIPSE_CODE` gets one new uniform, `fill`: when it is set and the fragment is inside the ellipse, the coverage is a smooth step on the signed edge distance instead of the ring test. `ellipseUniforms` keeps its signature for ellipses and sets `fill` to 0; markers call it with a synthesized ellipse spanning `centre ± radius` and `fill` to 1.

A ring of thickness equal to the radius was considered first, because it needs no shader change. It is rejected because the coverage at the exact centre is 0.5 (the edge of the ring), leaving a faint hole in the disc.

Alternative rejected: `St.Widget` with `border-radius` and a CSS background. It would be the simplest solid disc, but the circle edge would then rely on St's own rasterization at fractional scales while ellipses use the shader, and gradients (next change) would need a second mechanism on top. One mechanism for round shapes keeps physical-pixel behaviour identical between circles, ellipses and markers.

The label is a `Clutter.Text` using the same `textFont` helper with a size derived from the radius and digit count: roughly `1.1 r` for one digit, `0.95 r` for two, `0.7 r` for three and `0.5 r` for more. The exact factors are tunable constants in one pure function, `markerLabel(radius, digits)`, which also returns the label colour. The label is centred using its preferred size and its top-left is rounded to the physical pixel grid (`round(v * scale) / scale`).

### D5. Number colour is a pure helper

`contrastColor(hex)` returns black only when the perceived brightness `(299 R + 587 G + 114 B) / 1000` of the colour is at least 230 (White and near-white), and white otherwise. After visual review the original threshold of 128 was dropped: black numbers on Yellow, Green and Violet looked out of place, and gradients move those markers towards darker hues anyway. A second `Clutter.Text` under the label draws the same number in 35% black, one physical pixel lower, as a soft shadow that keeps white legible on light colours; it is hidden when the number is black. Neither text carries an effect. The helper lives in `src/rendering/actorGeometry.js` and is unit-tested.

Alternative rejected: the WCAG contrast-ratio comparison. It is stricter, but it picks black text on pure Red and Blue, which looks wrong next to common annotation tools. The brightness rule is a deliberate, documented trade-off.

The actor cache key for markers becomes `[annotation, number, physicalScale]`, mirroring the existing `circle` special case, so the label and disc update when an earlier marker is deleted or the display scale changes.


### D5b. Selected marker ring

After visual review the selection box, drawn exactly on the disc's bounding square with the 1 px light border used for other annotations, was invisible over light content. For a selected marker the decoration box is padded 4 px and styled as a 2 px blue ring (the handle blue) with `border-radius` of half its size and a faint white `box-shadow`, so it reads on light and dark content. Other annotations keep the stylesheet box. Handles stay hidden for markers.
### D6. Toolbar entry and shortcut

One new `TOOLS` entry `['marker', '①', 'Numbered marker']` after Ellipse. The toolbar has no per-tool shortcuts, so none is added. The glyph is a plain Unicode character like the existing ones; if it does not render in the real session, `#` is the fallback (checked in the manual task).

### D7. Export

No export code changes. The marker lives in the committed annotation layer, which `withExportContent` leaves visible, and `prepareExport` already forces allocation for shader-driven actors; markers are added to that list.

## Risks / Trade-offs

- [The `fill` uniform edits a shader that ellipses also use] -> The existing ellipse uniform tests are extended to assert `fill` is 0 for ellipses, and the real-session task re-checks ellipse rendering.
- [Offscreen texture padding differs between ellipse and a padded square box] -> `effectTextureUniforms` already recovers the content offset from the real texture, and the manual task checks a marker at 100%, 200% and about 133%.
- [Label font metrics differ from the node tests' mocks] -> Label size factors are constants in one pure function; the manual task checks 1, 2 and 3 digit numbers fit.
- [Derived numbers recompute on each refresh] -> It is one pass over a short array and runs only in `AnnotationActors.update`, which already stringifies every annotation per refresh.
- [A marker placed under the cursor on a handle region] -> The existing handle check runs before placement, as for other tools.

## Migration Plan

No data or preference migration. Rollback is reverting the change; markers exist only inside a capture session.

## Open Questions

None that change the specs. See the report for scope questions outside the decisions already made.
