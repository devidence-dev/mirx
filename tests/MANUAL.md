# Acceptance testing on GNOME Shell 50 / Wayland

Initial status: **pending execution in a real graphical session**. The Node tests cover the model and coordination through simulated adapters; they do not replace these checks.

Install the package by following the README. Record `gnome-shell --version`, the Ubuntu version, display scaling, and monitor layout. Use the default settings in `docs/mirx.feature`, a window with animated content, and two overlapping windows.

1. **Opening and canceling.** Press Alt+Shift+X: all monitors freeze without a dialog. Pressing the shortcut again does not change the session. Esc closes the capture without changing the clipboard or files. Opening it again works.
2. **Windows.** Move the pointer: only the frame of the topmost window is highlighted, without a shadow. Click to select that frame. Selecting the exposed part of a partially covered window includes the visible portion of the window covering it. A window partly outside the monitor is clipped. The empty desktop is not highlighted and clicking it does not create a selection.
3. **Area and monitor.** Drag in every direction. A movement of less than five units counts as a click; at five units, area selection begins. Ctrl+A selects the monitor under the pointer. With two monitors, a drag stays within the starting monitor, including when the monitors have different scaling or heights.
4. **Magnifier.** Before selecting and while creating or resizing a selection, check the magnified pixels, crosshair, and coordinates. Visit all four corners; the magnifier remains visible. Selecting an annotation tool hides it.
5. **Adjustments.** Check the dimensions and toolbar beside the selection. Try all eight handles, drag a handle across its opposite edge, drag the empty interior, and press the arrow keys and Shift+arrow keys. The selection must not leave the monitor or collapse to zero size. Selecting the full monitor keeps the toolbar inside it. Annotations retain their positions when adjusting the crop.
6. **Tools.** Draw arrows in both directions, an unfilled rectangle, an ellipse, a circle with Shift, a translucent highlighter, and a pixelated area. Choosing blue and 6 px affects new annotations while preserving the style of existing ones. Also check the initial preference values in a new session.
7. **Text.** Enter text with accented characters and multiple lines. Enter confirms without exporting; Shift+Enter adds a line; Esc discards the new text without closing the capture. In selection mode, double-click an existing text annotation to edit it; canceling preserves its previous content. Copying and pasting inside the editor affects the text.
8. **Editing.** In selection mode, clicking overlapping annotations selects the topmost one. Move each type, resize rectangles, ellipses, highlighters, and pixelated areas, and move each endpoint of an arrow. Change the selected object's color and stroke width, delete it with Delete, and deselect with Esc. Moving a pixelated area reveals the original content at its previous position and pixelates the new area.
9. **History.** For creation, movement, resizing, styling, deletion, and text editing, Ctrl+Z reverts a complete gesture and Ctrl+Shift+Z restores it. After undoing, a new action clears the redo history.
10. **Export.** Ctrl+C copies a PNG image that can be pasted into another application and displays a notification. Ctrl+S saves a PNG and then a JPG, using the preferences. Test Enter with each configured action; with no selection, it does nothing. Confirm that the capture closes only after a successful export.
11. **Content and scaling.** Save a 400 × 300 unit selection on a monitor at 200% scaling and check for an 800 × 600 pixel image. Test a 100% monitor beside a 200% monitor. The result contains only the selection and its annotations, clipped at the edges; it excludes the pointer, toolbar, magnifier, dimensions, handles, and dimming overlay.
12. **Files and errors.** Choose a nonexistent folder and save; it is created. Saving two captures quickly does not overwrite either one. Change the folder to `/proc/mirx-not-writable`: the error appears in the view and as a notification, while the selection and annotations are preserved. Correct the preferences and retry. The filename reflects the capture time.
13. **Preferences and lifecycle.** Change the shortcut to Super+Shift+S: it works and the previous shortcut no longer opens the capture. Change the color to yellow and the stroke width to 5 px, then draw in a new session. Change the folder to `~/Documents/Screenshots`. Disable and re-enable the extension, lock and unlock the session, and disconnect a monitor while the editor is open: no actors, late captures, trapped focus, or lingering shortcuts remain. Test opening it again after each case.

Also monitor the GNOME Shell log during testing:

```sh
journalctl --user -b -f -o cat /usr/bin/gnome-shell
```

For each check, record the result, exact version, monitor configuration, and any error or screenshot evidence if it fails. Do not mark the suite as passed based only on the Node results.
