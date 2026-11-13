# Proposal

## Why

The capture cursor currently uses a filled grey disc and an extended cross. The user reports that the mark obscures the content they are trying to capture and wants a lighter cross inspired by the reference image; they explicitly confirmed that the current coordinates presentation should stay unchanged.

## What Changes

- Replace the disc and circular outline with a smaller, thin cross, leaving the surrounding content visible. Suppress the platform crosshair while this mark is visible so only one crosshair is drawn; preserve normal control, move, resize and text cursors.
- Preserve the current coordinates exactly: `x:` above `y:`, white text, dark translucent rounded background, font size, padding, placement and edge-flipping behavior.
- Keep the existing continuous monitor-wide guides and rounded magnifier, including their shared visibility and physical-pixel alignment.
- Preserve interaction, monitor boundaries, cleanup, and exclusion of all capture aids from exported images.
- Explicitly reconcile the affected scenarios in `docs/mirx.feature`: it still describes dotted guides, a ring and coordinates in the magnifier, whereas the current implementation and capability specifications already use solid guides and coordinates beside the pointer.
- Out of scope: changing coordinate formatting, styling or placement; changing magnifier size, zoom or bands; changing system cursor themes, selection handles, tools, shortcuts or preferences; adding alternative cursor styles.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `capture-alignment-guides`: replace the filled cursor mark with a compact unfilled cross; retain the existing coordinate requirement unchanged.

## Impact

Changes are limited to mark geometry in `src/rendering/alignmentGuideGeometry.js`, mark actors in `src/ui/alignmentGuides.js`, and mark shaders in `src/ui/shaders.js`, and platform-crosshair suppression in `src/ui/overlay.js`. Coordinate formatting, positioning and `.mirx-cursor-coordinates` in `stylesheet.css` remain unchanged. Existing geometry, actor, overlay and export tests provide the verification boundaries. Update `README.md`, the affected feature scenarios and `tests/MANUAL.md` during implementation. No new dependencies, editor state, capture services or export formats are required. Use the existing actor cursor API with the target-version `Clutter.CursorType.NONE` value. Real GNOME Shell 50 / Wayland checks must establish visual correctness separately from automated tests.
