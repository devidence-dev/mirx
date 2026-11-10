# Acceptance testing on GNOME Shell 50 / Wayland

Initial status: **pending execution in a real graphical session**. The Node tests cover the model and coordination through simulated adapters; they do not replace these checks.

Install the package by following the README. Record `gnome-shell --version`, the Ubuntu version, display scaling, and monitor layout. Use the default settings (see Preferences in the README), a window with animated content, and two overlapping windows.

1. **Opening and canceling.** Press Alt+Shift+X: all monitors freeze without a dialog. Pressing the shortcut again does not change the session. Esc closes the capture without changing the clipboard or files. Opening it again works. Change the display scale (for example 100% to 200% and back) and press the shortcut again without logging out: it still opens the capture.
2. **Windows.** Move the pointer: only the frame of the topmost window is highlighted, without a shadow. Click to select that frame. Selecting the exposed part of a partially covered window includes the visible portion of the window covering it. A window partly outside the monitor is clipped. Over the empty desktop or the top bar the whole monitor under the pointer is highlighted (pending check in a real session), and clicking there selects that monitor. With two monitors, the highlight and the selection follow the monitor under the pointer; check differing scales. Once a selection exists no hover highlight appears.
3. **Area and monitor.** Drag in every direction. A movement of less than five units counts as a click; at five units, area selection begins. Ctrl+A selects the monitor under the pointer. A drag that starts on the empty desktop is a free selection, not the full monitor. With two monitors, a drag stays within the starting monitor, including when the monitors have different scaling or heights.
4. **Magnifier.** Before selecting and while creating or resizing a selection, check the magnified pixels and the band crosshair. Check also that:
   - the translucent bands stay legible over light, dark and mixed content, and each band reaches the magnified area's edges;
   - the target pixel stays uncovered and shows its own colour;
   - the magnifier is a square, all four corners are rounded, and no magnified pixel is drawn outside them;
   - the magnified image stays sharp at 100%, 200% and approximately 133% scaling.

   Visit all four corners; the magnifier remains visible. Selecting an annotation tool hides it.

   **Alignment guides** (pending, graphical checks): the horizontal and vertical thin solid guides show and hide together with the magnifier, with no measurement marks. Check that they:
   - cross at the pixel framed by the magnifier bands and follow the pointer smoothly, at 100%, 200% and approximately 133% scaling, moving in sub-pixel steps;
   - show a translucent circle with a thin grey cross, extending beyond the circle, centred on the intersection, sharp at 100%, 200% and approximately 133% scaling;
   - keep the circle and cross legible over light, dark and busy content;
   - clip the mark at the monitor corners and edges without shifting its centre;
   - show the pointer coordinates (`x:` above `y:`) next to the cursor, as white text on a small dark rounded background, legible on light, dark and dimmed backgrounds;
   - flip the coordinates to the left of the cursor near the right edge and above it near the bottom edge;
   - never overlap the coordinates with the magnifier;
   - are absent from PNG, JPG and clipboard exports, including while the mark is at a corner;
   - stay visible as a single soft grey line, never a double line, over white, black and busy backgrounds and over the dimmed area outside a window or selection;
   - reach all four monitor edges and corners, are not drawn outside the monitor, and keep a sharp 1 physical pixel core;
   - stay visible while creating a selection and while dragging each handle, and hide when the gesture ends, after Ctrl+A or a window click, when choosing a tool, editing text, or moving the selection from its interior;
   - with two monitors of different scale or offset, span only the monitor under the pointer, follow a drag onto the other monitor, and leave the selection limited to the starting monitor;
   - do not intercept clicks or drags on the toolbar, handles or the pointer position they cross.
5. **Adjustments.** Check the dimensions and toolbar beside the selection. Try all eight handles, drag a handle across its opposite edge, drag the empty interior, and press the arrow keys and Shift+arrow keys. The selection must not leave the monitor or collapse to zero size. Selecting the full monitor keeps the toolbar inside it. Annotations retain their positions when adjusting the crop.
6. **Tools.** Draw arrows in both directions, an unfilled rectangle, an ellipse, a circle with Shift, a translucent highlighter, and a pixelated area. Choosing blue and 6 px affects new annotations while preserving the style of existing ones. Also check the initial preference values in a new session.
7. **Text.** Enter text with accented characters and multiple lines. Enter confirms without exporting; Shift+Enter adds a line; Esc discards the new text without closing the capture. In selection mode, double-click an existing text annotation to edit it; canceling preserves its previous content. Copying and pasting inside the editor affects the text.
8. **Editing.** In selection mode, clicking overlapping annotations selects the topmost one. Move each type, resize rectangles, ellipses, highlighters, and pixelated areas, and move each endpoint of an arrow. Change the selected object's color and stroke width, delete it with Delete, and deselect with Esc. Moving a pixelated area reveals the original content at its previous position and pixelates the new area.
9. **History.** For creation, movement, resizing, styling, deletion, and text editing, Ctrl+Z reverts a complete gesture and Ctrl+Shift+Z restores it. After undoing, a new action clears the redo history.
10. **Export.** Ctrl+C copies a PNG image that can be pasted into another application and displays a notification. Ctrl+S saves a PNG and then a JPG, using the preferences. Test Enter with each configured action; with no selection, it does nothing. Confirm that the capture closes only after a successful export.
11. **Content and scaling.** Save a 400 × 300 unit selection on a monitor at 200% scaling and check for an 800 × 600 pixel image. Test a 100% monitor beside a 200% monitor. The result contains only the selection and its annotations, clipped at the edges; it excludes the pointer, toolbar, magnifier, alignment guides, dimensions, handles, and dimming overlay.

    **Guides in exported images** (pending): with the guides visible, start a selection drag, then finish it so the guides hide and the selection is complete. Position the pointer over the future selection area, so a guide would cross it if it were exported. Copy (Ctrl+C) and paste into an image editor, and save a PNG and a JPG. Open each result and zoom to the pixel level along the row and column that crossed the pointer: no guide line, circle, cross, coordinates, or halo may appear anywhere in the image, only the selection and its annotations. Repeat with a selection that spans the full monitor and with annotations underneath the pointer's row and column. Checking that the guides disappear during the operation is not enough: inspect the image content.
12. **Files and errors.** Choose a nonexistent folder and save; it is created. Saving two captures quickly does not overwrite either one. Change the folder to `/proc/mirx-not-writable`: the error appears in the view and as a notification, while the selection and annotations are preserved. Correct the preferences and retry. After the error, while the editor is still open, check that the editor is usable (selection, handles and annotations intact, toolbar responsive), that the guides show the state of check 4 (hidden while a selection is complete, shown again by a new selection drag or handle drag, never stuck on screen), and that a successful retry still produces an image without guides. The filename reflects the capture time.
13. **Preferences and lifecycle.** Change the shortcut to Super+Shift+S: it works and the previous shortcut no longer opens the capture. Change the color to yellow and the stroke width to 5 px, then draw in a new session. Change the folder to `~/Documents/Screenshots`. Disable and re-enable the extension, lock and unlock the session, and disconnect a monitor while the editor is open: no actors, late captures, trapped focus, or lingering shortcuts remain. Test opening it again after each case.
14. **Numbered markers** (pending, graphical checks). Select the "Numbered marker" tool and check that:

- the toolbar shows the ① button; if the glyph does not render, record it, since the fallback is `#`;
- each click inside the selection places one circle centred on the click point, numbered 1, 2, 3 in click order, and the tool stays active; a click outside the selection places nothing, and pressing a selection handle still resizes the selection without placing a marker;
- deleting marker 2 of markers 1, 2 and 3 with Delete leaves 1 and 2, with the former 3 now showing 2, and the next click takes 3; Ctrl+Z after a placement removes only that marker; Ctrl+Z after the deletion restores 1, 2 and 3, and Ctrl+Shift+Z gives 1 and 2 again;
- over busy content, the number is white with a soft shadow on every colour and black on White, and it is legible;
- a selected marker shows a blue ring, legible on light and dark content (pending);
- one, two and three digit numbers (for example 1, 12 and 123, after placing at least 100 markers) fit inside their circles at width 3 px and at width 30 px;
- a click on a marker selects it, a drag moves it and keeps its number, a selected marker shows no resize handles, a width change resizes it around its centre, a colour change recomputes the number contrast, and Ctrl+Z reverts each of these;
- at 100%, 200% and approximately 133% scaling, the circle edges are smooth, the number is centred and not blurred, and the exported marker matches the marker on screen;
- on two monitors with different scaling, a marker placed on the second monitor stays within the selection and is exported at that monitor's resolution;
- the PNG (Ctrl+S with format PNG), JPG (Ctrl+S with format JPG) and clipboard (Ctrl+C) images contain the markers with their current numbers, and a marker crossing the selection edge is cropped; compare the images with the screen.

15. **Gradient annotations** (pending, graphical checks). The gradient toggle (◐, accessible name "Gradient") is at the end of the style row. Check that:

- it is off when the overlay opens, shows whether it is on or off, and is off again in a new session after it was left on;
- highlighter, text and pixelated areas look exactly as they do with the toggle off, whatever its state;
- switching it with a selected arrow, rectangle, ellipse or numbered marker applies or removes that annotation's gradient as one step, Ctrl+Z restores the previous look in a single step, and other annotations are unchanged;
- switching it with a selected highlighter, text or pixelated area leaves that annotation unchanged and creates no undo entry: a following Ctrl+Z undoes the previous action, not the toggle, and the toggle still applies to new annotations;
- recolouring a selected gradient arrow, rectangle, ellipse or marker gives a sweep of the new colour: the colour slides into a neighbouring hue (for example blue to violet, red to pink, yellow to orange), with no white highlight;
- rectangle and arrow gradients are visible on screen and in the PNG, JPG and clipboard exports (this used to fail: they rendered flat);
- flat arrows look and sit exactly as before the container change, compared with the previous build: tail, tip and both head bars, at angles of 0, 45, 90, 180 and 270 degrees and widths of 1, 3 and 30 px;
- gradient arrows show no visible seam between the shaft and the head bars, and gradient rectangles show none on their rounded corners;
- gradients are smooth and edges sharp at 100%, 200% and approximately 133% scaling;
- the PNG (Ctrl+S with format PNG), JPG (Ctrl+S with format JPG) and clipboard (Ctrl+C) exports match the screen pixel for pixel, including a gradient arrow cropped by the selection edge; zoom to the pixel level on both to compare;
- for each palette colour (Red, Yellow, Green, Blue, Violet, White and Black), the number of a numbered marker contrasts with both its lightest (top-left) and deepest (bottom-right) circle shade, and the number stays one solid colour;
- with `perf-log` enabled, record the `mirx-perf motion ms=` values in the GNOME Shell log while moving the pointer over several gradient rectangles, and compare them with the same rectangles drawn flat.

Also monitor the GNOME Shell log during testing:

```sh
journalctl --user -b -f -o cat /usr/bin/gnome-shell
```

For each check, record the result, exact version, monitor configuration, and any error or screenshot evidence if it fails. Do not mark the suite as passed based only on the Node results.
