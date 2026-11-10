# Proposal

## Why

The magnifier marks the pixel under the cursor with short ticks, faint extensions and a small box, and the full-screen guides cross without any mark at the cursor point. After visual review, the user prefers a calmer reference style: a translucent band across the whole magnifier that leaves the target pixel uncovered, and a small ring where the guides cross.

## What Changes

- Replace the magnifier's crosshair (short ticks, faint extensions and centre box) with a translucent band exactly one magnified source pixel wide, along the centre row and the centre column, spanning the whole magnified area and leaving the centre pixel uncovered.
- Draw the band as dark translucent grey with a faint light halo, so it reads over light and dark content.
- Make the magnifier a square with four rounded corners, clip the magnified image to them, and draw a grey frame. Move the coordinates out of the magnifier to a stacked label next to the cursor.
- After visual review, switch the full-screen guides from dotted to a single thin solid mid-grey line, which reads on light and dark content without a halo.
- Add a cursor mark at the guides' intersection: a translucent grey disc with a thin grey cross through its centre, extending beyond the disc. It follows the same point, monitor and visibility as the magnifier and guides, receives no input, and is never exported.

Existing behaviour kept: magnifier sampling and zoom, visibility rules, and export exclusion and restoration.

Out of scope: hiding the system cursor, new preferences or shortcuts, and any change to selection, annotation or export paths.

## Capabilities

### New Capabilities

- `capture-magnifier`: The magnifier's pixel-target presentation: the band crosshair that keeps the centre pixel visible, legibility over any content, and the square rounded frame.

### Modified Capabilities

- `capture-alignment-guides`: Guides become thin solid lines; adds a cursor mark and a coordinates label at the guides' intersection, sharing the guides' visibility, scaling, input and export rules.

## Impact

- Presentation: `src/ui/magnifier.js`, `stylesheet.css`, `src/ui/alignmentGuides.js` and `src/ui/shaders.js`. `src/ui/overlay.js` needs no change if the ring lives in the guides container.
- Tests: `tests/magnifier.test.js`, `tests/alignment-guides.test.js`, `tests/overlay-export.test.js`, and the geometry tests for any new pure helper.
- Docs: `docs/mirx.feature` (magnifier and guides rules), `README.md`, and `tests/MANUAL.md`.
- No new dependencies, preferences, or data changes.
