# Tasks

## 1. Hit target and shared handle size (src/core)

- [x] 1.1 Add `HANDLE_HIT = 8` to `src/core/geometry.js`, make it the default tolerance of `handleAt` and the radius in `Editor._selectedHandleAt`. Verify with a `tests/core.test.js` case: a point 8 px from a handle centre grabs it, 9 px does not, and the existing `handleAt` cases still pass.
- [x] 1.2 Add `Editor.interactionHandle` (the handle of the running gesture, or null) and a pure `Editor.hitTarget(point)` returning `none`, `selection-handle`, `annotation-handle`, `annotation`, `selection`, `canvas` or `outside`, in the priority order of `pointerDown`. Verify with `tests/core.test.js` cases for each kind, with and without an active tool, plus a consistency test that `pointerDown` starts the matching gesture for sampled points.
- [x] 1.3 Add the pure `cursorFor` mapping in `src/ui/cursorModel.js` (gesture first, then control, then hit target, then no selection) and the handle-to-cursor table. Verify with a new `tests/cursor-model.test.js` covering every region of the cursor spec: the eight handles, move inside and over annotations, crosshair, text, default outside with a tool, a gesture overriding the region, and an arrow endpoint.

## 2. Toolbar model and tooltip text

- [x] 2.1 Add `src/ui/toolbarModel.js` (no `gi://` imports) with the tools (id, name, key, icon file, hint), the group order of both rows, `toolForKey(char)` and `tooltipText(name, shortcut, hint)`. Verify with a new `tests/toolbar-model.test.js`: keys are unique and match V/A/R/E/N/H/P/T, `toolForKey` is case-insensitive and rejects other characters, tool shortcuts without modifiers remain distinct from reserved Ctrl combinations (including A and Ctrl+A), and the texts are `Rectangle (R)`, `Undo (Ctrl+Z)`, a name-only text such as `Red`, `Ellipse (E) · Shift for a circle` and `Copy (Ctrl+C, Enter)`.

## 3. Icon set and packaging

- [x] 3.1 Draw the 14 symbolic icons under `icons/tools/` (`select-move`, `arrow`, `rectangle`, `ellipse`, `marker`, `highlighter`, `pixelate`, `text`, `gradient`, `undo`, `redo`, `minus`, `plus`, `close`), 16 × 16, filled paths only, 2 px outlines. Verify by opening each in an image viewer at 16 px and 72 px for shape and weight.
- [x] 3.2 Extend `tests/icons.test.js`: every file in `icons/tools/` ends in `-symbolic.svg`, has no `stroke`, `fill="none"`, gradient, `<text` or `style=`, and the file set equals the icons named in `toolbarModel` (no missing or orphan file). Verify with `npm test`.
- [x] 3.3 Update `scripts/pack.js` to copy `icons/tools` and to fail, naming the file, when a model icon is missing. Update the expected list in `tests/package.test.js` and add a test that a missing tool icon fails the pack with no zip written. Verify with `npm test` and `npm run pack`, then list the zip.

## 4. Stylesheet and tokens

- [x] 4.1 Rewrite the toolbar section of `stylesheet.css` with the tokens of design decision 9 (card, row, group, divider, icon button, label button, swatch, checked, suggested, disabled, focus, tooltip, `mirx-toolbar-solid`). Verify with a new `tests/stylesheet.test.js` that parses the file: every named class exists, no `backdrop-filter` and no comma-separated `box-shadow`, and the worst-case contrast of the icon colour on the lightest tint over a white backdrop (with the 0.75 blur brightness) is at least 3:1, and at least 3:1 for the solid class without blur.
- [x] 4.2 Update the frame and handle rules (2 px blue frame with the outer ring, 10 px round handles). Verify with the same stylesheet test (frame border 2px, handle width and radius) and the decoration task in group 8.

## 5. Toolbar rebuild (src/ui/toolbar.js)

- [x] 5.1 Build the two rows from `toolbarModel` with groups, dividers and the 16 px card. Load icons with `St.Icon` from an `iconDir` option, drop `_toolLabel` and the glyph labels, keep `COLORS` in its literal form. Pass `iconDir` from `extension.js` through `Overlay`. Verify with a vm-stub test, `tests/toolbar-layout.test.js`, that checks the row order, the dividers between groups, the group spacing classes and that every button has an accessible name; `tests/actor-geometry.test.js` still passes.
- [x] 5.2 Add the suggested-action logic: Copy and Save (icon buttons after task 9b.2), a ✕ icon Cancel, and a `primaryAction` callback applied in `update()`. Verify in the same test: `copy` marks Copy, `save` marks Save, never both, and a changed setting is applied on the next `update()`.
- [x] 5.3 Set the blur explicitly to BACKGROUND with `radius = 30 * scale_factor`, add the `GLASS_BLUR` constant that switches to the solid class, and add `Toolbar.destroy()`. Verify with a vm-stub test that the radius doubles when the stubbed scale factor is 2, that `GLASS_BLUR = false` adds no effect, and that `destroy()` is safe twice.

## 6. Tooltip component

- [x] 6.1 Add `src/ui/tooltip.js` as described in design decision 4 (300 ms delay, 150/100 ms fades, side and flip, clamping, `hideNow`, `destroy`) and attach it to every toolbar control with `tooltipText`. Verify with a vm-stub test, `tests/tooltip.test.js`: no show before 300 ms, leave within 300 ms cancels, a press hides it, the position stays inside the monitor and flips when the preferred side does not fit, and `destroy()` removes the pending source and every signal.
- [x] 6.2 Wire the tooltip into the overlay: child of the overlay actor above the toolbar and below the magnifier, hidden in `withExportContent`, hidden when the toolbar hides, on a key press and on `setBusy(true)`, destroyed in `Overlay.destroy()`. Verify by updating `tests/overlay-guides.test.js` (z-order) and `tests/overlay-export.test.js` (the tooltip is hidden during export and restored afterwards, also when the export throws).

## 7. Hotkeys and cursor resolver in the overlay

- [x] 7.1 Add the tool-key branch to `Overlay._runShortcut` with the gating of the spec (selection, no text edit, no drag, not busy, no Ctrl/Alt/Super). Verify by extending `tests/overlay-key.test.js`: each of V/A/R/E/N/H/P/T selects its tool in both cases, and nothing changes while editing text, without a selection, during a drag, with Ctrl, Alt or Super, and Ctrl+A/C/S/Z, Delete, Enter, Escape and the arrows behave as before.
- [x] 7.2 Replace the cursor block in `Overlay._refresh()` with the resolver: record `_control` from the event actor in `_motion`, call `editor.hitTarget` and `cursorFor`, and map the abstract name to `Clutter.CursorType` (bidirectional resize names). Verify with `tests/overlay-motion.test.js` extended with stubs: the cursor passed to `set_cursor_type` for a button, each handle, inside the selection, a drawing tool, the text tool, outside with a tool, mid-gesture over the toolbar, and after a hotkey with no motion.
- [x] 7.3 Document the keys: add the eight tool keys to the README shortcuts table, fix the README line that calls the select tool "(↖)", and add a "Toolbar, tooltips and hotkeys" item to `tests/MANUAL.md`. Verify by reading both files and checking that every key matches `toolbarModel`.

## 8. Frame and handles

- [x] 8.1 Resize the handles to 10 px and the offset to 5 in `Overlay._updateDecorations` and `DecorationActors`. Verify with `tests/decorations.test.js` updated for size 10 and the `x-5, y-5` position, and a check that the frame size and position are unchanged.
- [x] 8.2 Add a "Frame, handles and cursors" item to `tests/MANUAL.md` (light and dark content, 100/133/200%, each cursor, handle grab area). Verify by reading it against the specs.

## 9. Integration validation

- [x] 9.1 Run `npm test`, `npm run lint`, `npm run check`, `npm run glsl` and `npm run pack`. Verify that all exit 0 and that the zip listing shows `icons/tools/*-symbolic.svg` and no other new entries. Verified 2026-11-10: npm test 193/193, Biome clean, check OK, glsl 6 shaders valid (Docker), pack OK with icons/tools/*.svg in the zip; icons rendered with librsvg and St recolouring on the test machine.

  The host lacks `/usr/bin/glslangValidator`; the shader validation was completed in a temporary Docker container. The later annotation-shadow validation is tracked in 9d.3.

- [x] 9.2 Run `openspec validate refine-capture-toolbar --strict`. Verify that it passes.

## 9b. Review fixes after the first device check

- [x] 9b.1 Make swatches exact 28 px circles: actor `width`/`height` set in code (scaled), centred alignment, no label or padding, CSS `border-radius: 14px`, own class instead of `mirx-icon-button`. Verify with a `tests/toolbar-layout.test.js` case (width equals height) and a `tests/stylesheet.test.js` case (radius is half of `SWATCH_SIZE`).
- [x] 9b.2 Make Copy and Save icon-only buttons with `edit-copy-symbolic` and `document-save-symbolic` (18 px, 36 px square), keeping accessible names, tooltips (`Copy (Ctrl+C, Enter)`, `Save (Ctrl+S)`) and the suggested style; remove `mirx-label-button` and its CSS. Verify with a toolbar-layout case and the updated `tests/stylesheet.test.js`.
- [x] 9b.3 Show no tool as checked at start. Superseded by 9c.2: the toolbar highlights `editor.tool === tool.id` and the editor starts idle.

## 9c. Idle vs Select and move

- [x] 9c.1 Add the explicit `'select'` tool in `src/core/editor.js`: `tool === null` is idle (only the eight selection handles act), `'select'` keeps the former null behaviour, drawing tools are unchanged; `hitTarget` returns `inert` for idle interior and `pointerDown` dispatches on the three states. Verify with `tests/core.test.js`: idle drag inside and click on an annotation do nothing, a handle drag resizes, nudge works, select moves, selects and resizes as before; existing tests that relied on null now set `'select'`.
- [x] 9c.2 Remove `_selectChosen` and `Toolbar.chooseTool`; the select button and V (`TOOLS[0].id === 'select'`) call `setTool('select')` and the highlight is `editor.tool === tool.id`. Verify with `tests/toolbar-layout.test.js` (none at start, select after click, Arrow unchecks it) and `tests/overlay-key.test.js` (V sets the `'select'` tool only); the magnifier and guides condition keeps its behaviour (`tests/overlay-guides.test.js`).
- [x] 9c.3 Cursor model: idle shows the default arrow inside the selection and over annotations (`inert`), resize cursors on handles, crosshair before a selection; select shows the move cross. Verify with `tests/cursor-model.test.js` and the idle/select cursor test in `tests/core.test.js`.
- [x] 9c.4 Update the specs (`capture-toolbar`, `capture-pointer-feedback`), add MODIFIED blocks for `numbered-markers` "Markers are edited like other annotations", `annotation-gradients` "Gradient sweeps the chosen colour into a neighbouring hue" and `capture-alignment-guides` "Visibility linked to capture selection", design decision 12, README and `tests/MANUAL.md`. Verify with `openspec validate refine-capture-toolbar --strict` and `openspec validate --specs --strict`.

## 9d. Subtle annotation shadows

- [x] 9d.1 Add a focused GPU shadow component and integrate it with `AnnotationActors`: padded blackened clones, 25% opacity, 1/2 logical px offset and 2 logical px blur, including text and marker-disc handling. Verify target GIR APIs and focused tests for geometry, physical-pixel snapping, silhouette source, padding and scale.
- [x] 9d.2 Cover shadow stacking, reuse, edits, movement, deletion, text editing, draft/export retention and cleanup in actor tests; document the new appearance in README, `docs/mirx.feature` and pending `tests/MANUAL.md` checks. Verify focused tests and read the documentation against `annotation-shadows`.
- [x] 9d.3 Run `npm test`, `npm run lint`, `npm run check`, `npm run glsl`, `npm run pack` and strict OpenSpec validation after the shadow change. Verify exit status and that the zip contains the new runtime component; report unavailable validators explicitly.

## 10. Real GNOME Shell 50 session (requires the user; leave pending until done)

- [x] 10.1 **Requires the user's GNOME Shell 50 session.** Check the toolbar look and layout (two rows, groups, dividers, 36 px buttons, suggested Copy or Save icon button, ✕ Cancel; swatches are true circles; Copy and Save icons render in the theme; no tool highlighted on open, V or a click checks select/move, choosing Arrow unchecks it and dragging in the selection still moves it) and the blur: does it blur the frozen screenshot, and are the rounded corners clean? Apply the mitigation order of design decision 9 or switch `GLASS_BLUR` off, and record the outcome in `tests/MANUAL.md`. Validated by the user on 2026-11-10 (GNOME Shell 50.1, Ubuntu 26.04, 100%): two-row toolbar and groups look better, circular swatches, icon-only Copy/Save with the accent on the Enter action, no tool highlighted at start; the darkened-selection bug from the frame box-shadow was found here and fixed with the ring widget; outside dimming raised to 60%.
- [x] 10.2 **Requires the user's session.** Check the scales 100%, 200% and about 133%, and a larger text scale: sizes, crisp dividers and borders, no clipped labels, toolbar fits small monitors. Validated by the user on 2026-11-10 at 100%, 200% and about 133%.
- [x] 10.3 **Requires the user's session.** Check every cursor: hand over buttons, the eight resize cursors, move inside the selection and over annotations, crosshair, text, default outside, and the cursor fixed during drags; idle (nothing chosen): arrow cursor inside the selection and over annotations, a drag inside does nothing, the eight handles still resize with their resize cursors, and V or the select button enables moving the selection and selecting, moving and resizing annotations (move cursor); confirm the bidirectional names exist in the user's cursor theme and that the root cursor shows over toolbar children. Validated by the user on 2026-11-10: hand over controls, resize cursors on handles, idle arrow, move cross with Select and move, crosshair and text cursors.
- [x] 10.4 **Requires the user's session.** Check tooltips (text, 300 ms delay, fade, flip at edges, gone on click and on export), the eight tool hotkeys, typing text with tool letters, and that Ctrl+A/C/S/Z, Enter and Delete are unchanged. Check the frame and handles over light and dark content, and an exported image with no toolbar, tooltip, frame or handles. Validated by the user on 2026-11-10: tooltips with name and shortcut, tool hotkeys.
- [x] 10.5 **Requires the user's GNOME Shell 50 session.** Inspect soft annotation shadows over light and dark content at 100%, about 133% and 200%: all tools, hollow outlines, translucent highlights, marker discs and text; move, resize, undo, delete, edit text and reopen. Confirm shadows do not clip at their own bounds or leave stale pixels, respect stacking and selection clipping, and match PNG/JPG/clipboard exports without UI decorations. Validated by the user on 2026-11-10 at 100% after raising the shadow to ~45% and a 3 px blur; the 25% version measured only 2-6 luminance levels on a dark exported PNG. Other scales not reported.
