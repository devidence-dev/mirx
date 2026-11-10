# Proposal

## Why

The selection border is hard to see, the cursor lacks feedback, and the toolbar's small glyphs and crowded controls are unclear. Annotations need subtle depth.

## What Changes

- Rebuild the toolbar as two rows of grouped controls (12 px gaps, 1 px dividers, 36 px buttons, 18 px icons). Logical sizes scale with the display.
- Replace text glyphs with a custom symbolic icon set shipped in `icons/tools/`. The select/move tool uses a four-way move-arrows icon.
- Add tooltips such as `Rectangle (R)`, replacing the hover label under the tools.
- Add single-key tool hotkeys V, A, R, E, N, H, P, T. They work only while a selection exists and no text is being edited.
- Give the configured Enter action the accent "suggested" style. Other actions stay neutral; Cancel becomes an ✕ icon button.
- Style the toolbar as glass: translucent tint, scaled background blur, 16 px card, and a solid-tint fallback if the blur fails over the frozen screenshot.
- Show contextual cursors for controls, handles, movable content, drawing and text; idle areas keep the default arrow.
- Thicken the selection frame to 2 px with a thin dark outer ring. Use 10 px round handles with a 16 px hit area.
- Ship `icons/tools/*.svg` in the zip.
- Give annotations a small, soft drop shadow for subtle depth, matching the preview and exported image.

## Capabilities

### New Capabilities

- `capture-toolbar`: layout, icons, tooltips, tool hotkeys, primary action, scaling, glass styling and export exclusion of the editing toolbar.
- `capture-pointer-feedback`: cursor per region, plus the look and hit areas of the selection frame and handles.
- `annotation-shadows`: soft shadows following annotation silhouettes, scaling, clipping and export consistency.

### Modified Capabilities

- `extension-packaging`: the zip contents requirement admits `icons/tools/*.svg`. The README-logo requirement's icons-folder scenario is updated for the new subfolder.

## Impact

- `src/ui/` (toolbar, new tooltip, overlay hotkeys and cursor resolver, decorations), `stylesheet.css`, `extension.js`.
- `src/core/editor.js`, `src/core/geometry.js`: a pure hit-target query, one shared handle hit size.
- `src/ui/annotationActors.js` and a focused GPU shadow component: annotation depth without changing editor geometry.
- `icons/tools/*.svg`, `scripts/pack.js`, tests, README shortcuts table, `tests/MANUAL.md`, `docs/mirx.feature`.

## Out of Scope

- Resizing by dragging the whole selection edge (only the eight handles resize).
- A true backdrop filter, toolbar preferences, new tools, width hotkeys, configurable shadows, and export adapter changes.
