# Design

## Context

See `proposal.md` for motivation. Requirements are in `specs/capture-magnifier/spec.md` and `specs/capture-alignment-guides/spec.md`.

- `src/ui/magnifier.js` builds a 144-unit viewport containing the frozen texture scaled by `zoom = 8 * snapshot.scale`, so one source pixel is always 8 logical units in the viewport, centred at `c = 72`. Crosshair marks are `St.Widget`s in `_marks`; `update()` snaps every mark to the monitor's physical grid when the grid phase changes. The outer actor clips to its rectangle and draws `.mirx-magnifier` (`border-radius: 4px`, 1 px white border); the viewport paints over that border on three sides.
- `src/ui/alignmentGuides.js` owns an inert `St.Widget` container positioned and sized to the monitor, with two strips using `Shell.GLSLEffect`. `Overlay._refresh()` passes the shared point, monitor and visibility; `withExportContent()` already hides and restores the container.
- `src/rendering/alignmentGuideGeometry.js` returns, per axis, the strip start and the core offset of the target pixel in physical pixels.
- Shader helpers `setUniforms` and `textureUniforms` are exported from `src/ui/annotationActors.js`.

## Goals / Non-Goals

**Goals:**
- Reuse the existing mark, snapping, effect and container mechanisms. Keep the actor count constant during pointer motion.
- Keep the ring under the existing guides lifecycle, so no change to `Overlay` coordination or export is needed.

**Non-Goals:**
- Change magnifier zoom, sampling, placement, size or the coordinates label content.
- Change the dotted guide strips.

## Decisions

### 1. Band crosshair as four fixed marks

Replace the ticks, extensions and centre box with four rectangles around the centre pixel `[c-4, c+4]`: left `[0, c-4]`, right `[c+4, SIZE]` on the centre row, and top and bottom on the centre column, each 8 units thick. They reuse `_marks`, so the existing physical-grid snapping applies unchanged. Style: dark grey fill around 0.35 alpha, with a 1-unit light border around 0.3 alpha as the halo. These values are tunable during visual review.

The geometry is fixed because a magnified pixel is always 8 units wide. Rejected alternative: a GLSL band over the whole viewport. It would add an effect for something that four static widgets already do.

### 2. Rounded frame with a viewport mask effect

Raise `.mirx-magnifier` `border-radius` to about 10 px. Add a small `Shell.GLSLEffect` to the viewport, as a post snippet so it scales the pixels already painted, that clears fragments outside the four rounded corners. It computes a rounded-rectangle distance in resource pixels from `textureUniforms`, with one antialiasing pixel.

After visual review the magnifier became a 144×144 square: the coordinates strip was removed and the coordinates moved next to the cursor (decision 4), and the frame became a 2 px grey border. Its vertical gap from the cursor grew from 24 to 52 units in both directions, so the coordinates label, at most 12 units plus two text lines away from the cursor, never overlaps it. Add a non-reactive frame overlay last in the magnifier actor. It carries the border and radius, so the border stays visible all around the magnified image.

Rejected alternatives:
- Corner cover widgets cannot draw an inverse curve without Cairo.
- Insetting the viewport by the radius loses magnified area.
- Clutter has no rounded clip.

Cost: one offscreen pass of 144×144 units at resource scale per magnifier repaint.

### 3. Cursor mark as a third child of the guides container

Add a fixed-size mark actor with its own `Shell.GLSLEffect` to `AlignmentGuides`. After visual review the effect follows the reference:
- a translucent grey disc of about 8 logical units radius, outlined by the same stroke,
- a cross through the centre reaching about 15 units,
- each stroke as one 1-physical-pixel mid-grey line (55% grey at 90% alpha), composited over the disc in premultiplied layers.

A first version used a dark core with a faint light halo on each side. On dark content the core vanished and the two halo lines read as an off-centre band, so after visual review the guides became a neutral grey line (62% grey at 95% alpha) whose side pixels carry the same grey at 30% alpha. Without a light/dark inversion it never reads as a double line, and the soft 3-pixel width keeps it visible over the dimmed area outside a window or selection. The offscreen texture GNOME allocates for an effect is padded unevenly around the strip, and the shader also runs on those padding pixels; the first halo build therefore came out wider on one side. The guide shader multiplies its colour by the alpha of its own texture (`texture2D(tex, …)`, the same sampling pattern as the recolour and mask effects), so only the strip's three pixels are drawn and the halo is symmetric.

The full-screen guides use the same stroke as solid lines; the dash pattern and its uniforms were removed.

Extend `alignmentGuideGeometry()` with a ring square of odd physical size, centred on the target pixel's physical centre (the strips' core). The ring therefore matches the guides' alignment at every scale. Set `clip_to_allocation` on the container, which is already sized to the monitor, so the ring is clipped at edges and corners without shifting its centre. The ring inherits the container's visibility, inertness, z-order (below controls and magnifier) and export exclusion and restoration.

Rejected alternatives:
- An `St.Widget` with `border-radius`: St rasterises the rounded border and cannot carry the two-tone halo cleanly.
- Reusing the annotation ellipse effect: its iterative ellipse solver is unnecessary for a circle.

### 4. Coordinates label in the guides container

Add an `St.Label` as the last child of the guides container. It shows `x: <x>` above `y: <y>`, sits 14 units right of and 12 units below the cursor, moves to the other side near the monitor's right or bottom edge, and is snapped to physical pixels. Being in the guides container, it shares their visibility, monitor clipping and export exclusion with no change to `Overlay`. White text on a small dark translucent rounded background keeps it legible on light, dark and dimmed content; a first version with dark text and a light `text-shadow` turned into a blur on dark content in a real session.

Rejected alternative: keeping the label as a separate magnifier actor. It would need its own overlay wiring and export entry, and the magnifier's scale-down on small monitors would shrink it.

## Risks / Trade-offs

- [The magnified image is not snapped, so band edges can sit up to half a physical pixel off a magnified pixel edge at fractional scales] → Same rounding policy as today's marks; check at about 133% in a real session.
- [The offscreen pass on the viewport could blur nearest-filtered pixels at fractional scale] → Compare sharpness with and without the mask in a real session. If it blurs, limit the mask to the corner areas or drop the rounding of the image and keep only the frame overlay.
- [The ring near the magnifier could look cluttered] → The magnifier is offset 24 units from the cursor; review spacing visually.
- [Node tests cannot prove shader output] → Test geometry, actor wiring and visibility with mocks. Record graphical checks separately.

## Migration Plan

No data or preference migration. Rolling back restores the previous marks and removes the ring and mask. Validate with `npm test`, `npm run check`, `npm run pack`, then a GNOME Shell 50/Wayland session.
