# Proposal

## Why

The magnifier's crosshair identifies the pixel under the cursor, but it does not help verify alignment with distant elements on the screen. Adding horizontal and vertical dotted guides will help users precisely choose the edges of a capture.

## What Changes

- Show two dotted guides intersecting at the cursor position and spanning the full width and height of the active monitor, as a visual alignment aid associated with the magnifier.
- Update them when the cursor moves before selection and when a selection is created or resized; hide them when the magnifier is hidden.
- Keep them legible over light and dark backgrounds, aligned with the position indicated by the magnifier, and clipped to the monitor under the cursor.
- Exclude them from copied or saved images and preserve interaction with controls.
- Initial scope: automatic activation with the magnifier, with no numeric scale, measurement marks, new settings, shortcuts, or magnetic snapping to elements.

## Capabilities

### New Capabilities

- `capture-alignment-guides`: Dotted cursor guides for aligning a capture selection, with visibility linked to the magnifier, scaling support, and exclusion from exports.

### Modified Capabilities

None. The project has no published capabilities in `openspec/specs/`; the existing functional specification is in `docs/mirx.feature` and is retained as a compatibility reference.

## Impact

- Presentation: `src/ui/overlay.js` and a guides component in `src/ui/`, reusing existing actor and GPU effect mechanisms. `src/ui/magnifier.js` retains its magnification and internal crosshair.
- Export: include the guides among the temporary decorations hidden by `Overlay.withExportContent()`.
- Verification: geometry, visibility, and export integration tests; update `tests/MANUAL.md`, `docs/mirx.feature`, and the usage explanation in `README.md` during implementation.
- No new dependencies or changes to the capture format, editing model, or preferences.
