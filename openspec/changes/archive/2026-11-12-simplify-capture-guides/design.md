# Design

## Context

See `proposal.md` for motivation. Inspection found these existing boundaries:

- `alignmentGuideGeometry()` snaps two three-physical-pixel guide strips (one core plus narrow halo) and a mark to the magnifier's sampled source pixel. Its mark has an 8-unit disc radius and cross arms reaching roughly 15 logical units from the centre.
- `AlignmentGuides` owns two strip actors, a `RingEffect` actor and one `St.Label` inside an inert monitor-clipped container. It reuses those actors and caches geometry updates.
- `RING_CODE` blends a grey disc at 0.28 opacity beneath the circle and cross. The coordinates are currently `x: N` and `y: N`, with a 12px font and a padded dark background.
- `Overlay._refresh()` supplies one point, monitor and visibility condition to guides and magnifier. Export temporarily hides their actors; overlay destruction owns cleanup.
- `Magnifier` remains 144 logical units square, with 8x source-pixel zoom and placement offsets of +24/+52. Its existing capability requires a square image, bands, and space for coordinates beside the pointer.

There is no existing `graphify-out/graph.json`; findings above come from direct read-only inspection. Creating a graph is outside this planning-only change.

## Goals / Non-Goals

**Goals:** Reduce the footprint at the actual capture point through the existing presentation components; retain GPU rendering, physical-pixel alignment and input/export boundaries.

**Non-Goals:** Change coordinate formatting, styling or placement; introduce a cursor settings model; modify core editor geometry; change platform cursor themes or non-crosshair cursor behavior; or restructure the magnifier. The user's reference is a visual direction for the mark, not a pixel-measured template or a request to restyle coordinates.

## Decisions

### 1. Use a smaller cross with no circular geometry

Replace the disc/circle shader with a mark containing only horizontal and vertical thin strokes. Use approximately 10 logical units per arm and a one-physical-pixel light core with at most a one-physical-pixel dark contrast edge per side. Snap arm endpoints so the visible core spans at most 21 logical units at each supported scale. The bounding allocation can include the contrast edge. The centre is the existing shared pixel centre; no extra square, dot or backing is painted there.

Retain the guide strips' current extent and rendering. The short light cross provides local emphasis against the quieter long grey guides. Rename ring-specific geometry, shader exports and actor terminology to reflect the cross, removing obsolete radius/disc uniforms. Keep a single small shader actor and reuse it across updates.

Alternatives considered: only shrinking the disc still veils nearby content; keeping an empty ring adds another contour; relying exclusively on a themed system cursor makes the visible aid theme-dependent. The chosen cross is consistent with the reference while having a smaller painted footprint than the current mark.

### 2. Preserve the current coordinate presentation

The user explicitly confirmed that the coordinates are already correct. Keep the existing `x: N` above `y: N`, floored stage-coordinate values, 12px white font, dark translucent rounded background and padding. Leave `.mirx-cursor-coordinates` in `stylesheet.css` and the label formatting and placement code unchanged.

Keep the existing +14/+12 logical offsets and preferred-size measurement, flipping left/up at right/bottom edges and snapping placement to the active physical grid. Fit the new cross and its contrast edge within the existing gap. Verify that the smaller mark does not collide with the current label or magnifier at normal and flipped placements; adjust only mark geometry if necessary. Preserve the existing coordinate requirement in the main specification by excluding it from this change's delta.

Removing the badge or axis prefixes was considered in the initial draft and rejected by the user. The reference guides the cursor mark only; coordinate redesign is outside the authorized scope.

### 3. Preserve the existing interaction and lifecycle contract

Keep all mark and label actors non-reactive under the existing container. Retain `cursorModel.js` as the gesture/target cursor model, guide visibility, monitor switching, selection constraints and parent-owned destruction. At the presentation boundary in `Overlay._refresh()`, replace a requested platform crosshair with `Clutter.CursorType.NONE` only when the custom mark is actually visible (capture aids enabled and a monitor under the pointer). Keep normal pointer, text, move and directional resize cursors. Restore the normal requested cursor immediately when the mark hides, including busy/text-edit/no-monitor transitions, without requiring motion. Actor destruction releases cursor suppression with the overlay. Reuse the export hide/restore path, including capture failure. No new event handlers, timers or GNOME methods are needed. The existing `set_cursor_type` API and `CursorType.NONE` enum are declared in the supplied GNOME Shell 50 `.gir/Clutter-18.gir` at lines 1652 and 6373. Keep suppression local to the overlay actor rather than hiding the global cursor tracker.

The mark continues to use `Shell.GLSLEffect` and existing resource-scale correction. The label continues to use `St.Label` with its existing update behavior. Do not add Cairo, snapshot resampling, framebuffer readbacks, or per-motion actor allocation. Retain the existing update cache while changing its mark geometry fields.

### 4. Reconcile only the affected documentation and verify at both boundaries

During implementation, update the magnifier and alignment-guide section of `docs/mirx.feature` to describe solid guides, the compact cross and coordinates beside the pointer. These are explicit corrections of the documented discrepancies, not a return to dotted lines or coordinates inside the magnifier. Keep unrelated feature rules intact. The existing capability purpose also still says “dotted”; record this as existing metadata debt, since a requirement delta does not update a capability's purpose. Do not change the main spec as part of proposal creation.

Revise existing geometry and actor tests for the new mark contract, including scales 1, 2 and 4/3, fractional sampling, negative monitor offsets, clipping and actor reuse. Retain existing coordinate-format and placement expectations as regression checks, and use existing overlay/export suites for visibility, inertness, destruction, and success/failure restoration. Documentation corrections must describe the unchanged coordinate badge beside the pointer. Use the existing shader validation command to validate renamed snippets. Automated results do not establish graphical correctness.

## Risks / Trade-offs

- A smaller mark may feel harder to locate → Keep the long guides and a bright local core; compare the old and new mark over the same content before accepting the visual result.
- Fractional scale can soften thin strokes → Preserve source-pixel centring and resource-scale correction; test geometry and inspect 100%, 200% and approximately 133% displays.
- The new cross could interfere with the existing coordinate badge → Keep the current label offsets and style, fit the mark inside its available space, and inspect corners and mixed monitor offsets with the magnifier visible.
- Cursor suppression could leave the pointer invisible outside the custom-mark state → Gate suppression on both mark visibility and a requested crosshair, test transitions without motion, and retain all normal control and gesture cursors. Verify cursor restoration after close in GNOME Shell 50 / Wayland.
- Existing unrelated working-tree edits affect output and preferences → Keep implementation scoped to the planned presentation files and preserve those edits when validating export regressions.

## Migration Plan

No stored settings or data need migration. Apply mark geometry/shader changes while retaining the coordinates, update the affected tests and documentation, then run automated and explicitly recorded graphical checks. Build the installable package without installing it automatically. Rollback consists of reverting these mark presentation changes together; capture/editor state and coordinate presentation are unchanged.
