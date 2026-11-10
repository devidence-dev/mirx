# Proposal

## Why

Annotating a capture often means pointing at several things in order ("click here, then here, then here"). Arrows and text can do it, but the user must type and renumber every label by hand. A numbered marker tool places consecutive step numbers with one click each and keeps them consecutive when markers are removed.

## What Changes

- Add a numbered marker tool to the toolbar. Each click inside the selection places a filled circle with a number inside it: 1, 2, 3 and so on, in creation order.
- The marker uses the current colour. Its size derives from the current width. The number is drawn in black or white, whichever contrasts with the marker colour.
- Numbers are derived from the markers that exist, not stored. Deleting or undoing a marker renumbers the remaining markers so they stay consecutive; the next click takes the next free number. Redo restores the numbering consistently.
- Markers can be selected, moved, restyled (colour, width) and deleted like other annotations. They have no resize handles.
- Markers are part of the exported PNG, JPG and clipboard image exactly as displayed, and are cropped by the selection like other annotations.
- `docs/mirx.feature` lists the step counter as out of scope in v1. This change revises that line.

Out of scope: editing a number by hand, choosing a start number, reordering markers, per-marker labels or text, dragging while placing, a marker preview under the cursor, keyboard shortcuts for tools (the toolbar has none), a new preference, and any gradient fill (see the separate `add-annotation-gradients` change, which depends on this one).

## Capabilities

### New Capabilities

- `numbered-markers`: Placement, numbering, contrast, selection, editing, undo/redo renumbering and export of numbered marker annotations.

### Modified Capabilities

None. Annotation behaviour is not yet an OpenSpec capability; `docs/mirx.feature` stays the reference for the existing annotation rules, which this change leaves unchanged.

## Impact

- Editor state: `src/core/editor.js` (marker tool, placement, hit test, move, no handles, derived numbers) and a small pure size helper in `src/core/geometry.js`.
- Rendering: `src/rendering/actorGeometry.js` (marker geometry and label size, contrast colour) and `src/ui/annotationActors.js` (marker actor reusing the existing ellipse shader in `src/ui/shaders.js`).
- Toolbar: `src/ui/toolbar.js` (one new tool button). `src/ui/overlay.js` and `src/platform/gpuExport.js` need no change, because export paints the same scene.
- Tests: `tests/core.test.js`, `tests/actor-geometry.test.js`, `tests/annotation-actors.test.js`, `tests/overlay-export.test.js`.
- Docs: `docs/mirx.feature`, `README.md`, `tests/MANUAL.md`.
- No new dependencies, preferences, GNOME APIs or data changes.
