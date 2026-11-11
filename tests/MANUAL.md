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
5. **Adjustments.** Check the dimensions and toolbar beside the selection. Try all eight handles, drag a handle across its opposite edge, drag the empty interior (with nothing chosen it must do nothing; press V first to move the selection), and press the arrow keys and Shift+arrow keys. The selection must not leave the monitor or collapse to zero size. Selecting the full monitor keeps the toolbar inside it. Annotations retain their positions when adjusting the crop.
6. **Tools.** Draw arrows in both directions, an unfilled rectangle, an ellipse, a circle with Shift, a translucent highlighter, and a pixelated area. Choosing blue and 6 px affects new annotations while preserving the style of existing ones. Also check the initial preference values in a new session.
7. **Text.** Enter text with accented characters and multiple lines. Enter confirms without exporting; Shift+Enter adds a line; Esc discards the new text without closing the capture. With the select/move tool (V), double-click an existing text annotation to edit it; canceling preserves its previous content. Copying and pasting inside the editor affects the text.
8. **Editing.** With the select/move tool (V), clicking overlapping annotations selects the topmost one. Move each type, resize rectangles, ellipses, highlighters, and pixelated areas, and move each endpoint of an arrow. Change the selected object's color and stroke width, delete it with Delete, and deselect with Esc. Moving a pixelated area reveals the original content at its previous position and pixelates the new area.
9. **History.** For creation, movement, resizing, styling, deletion, and text editing, Ctrl+Z reverts a complete gesture and Ctrl+Shift+Z restores it. After undoing, a new action clears the redo history.
10. **Export.** Ctrl+C copies a PNG image that can be pasted into another application and displays a notification. Ctrl+S saves a PNG and then a JPG, using the preferences. Test Enter with each configured action; with no selection, it does nothing. Confirm that the capture closes only after a successful export.
11. **Content and scaling.** Save a 400 × 300 unit selection on a monitor at 200% scaling and check for an 800 × 600 pixel image. Test a 100% monitor beside a 200% monitor. The result contains only the selection and its annotations, clipped at the edges; it excludes the pointer, toolbar, magnifier, alignment guides, dimensions, handles, and dimming overlay.

    **Guides in exported images** (pending): with the guides visible, start a selection drag, then finish it so the guides hide and the selection is complete. Position the pointer over the future selection area, so a guide would cross it if it were exported. Copy (Ctrl+C) and paste into an image editor, and save a PNG and a JPG. Open each result and zoom to the pixel level along the row and column that crossed the pointer: no guide line, circle, cross, coordinates, or halo may appear anywhere in the image, only the selection and its annotations. Repeat with a selection that spans the full monitor and with annotations underneath the pointer's row and column. Checking that the guides disappear during the operation is not enough: inspect the image content.
12. **Files and errors.** Choose a nonexistent folder and save; it is created. Saving two captures quickly does not overwrite either one. Change the folder to `/proc/mirx-not-writable`: the error appears in the view and as a notification, while the selection and annotations are preserved. Correct the preferences and retry. After the error, while the editor is still open, check that the editor is usable (selection, handles and annotations intact, toolbar responsive), that the guides show the state of check 4 (hidden while a selection is complete, shown again by a new selection drag or handle drag, never stuck on screen), and that a successful retry still produces an image without guides. The filename reflects the capture time.
13. **Preferences and lifecycle.** Change the shortcut to Super+Shift+S: it works and the previous shortcut no longer opens the capture. Change the color to yellow and the stroke width to 5 px, then draw in a new session. Change the folder to `~/Documents/Screenshots`. Disable and re-enable the extension, lock and unlock the session, and disconnect a monitor while the editor is open: no actors, late captures, trapped focus, or lingering shortcuts remain. Test opening it again after each case.
14. **Numbered markers** (pending, graphical checks). Select the "Numbered marker" tool and check that:

- the toolbar shows the numbered marker icon;
- each click inside the selection places one circle centred on the click point, numbered 1, 2, 3 in click order, and the tool stays active; a click outside the selection places nothing, and pressing a selection handle still resizes the selection without placing a marker;
- deleting marker 2 of markers 1, 2 and 3 with Delete leaves 1 and 2, with the former 3 now showing 2, and the next click takes 3; Ctrl+Z after a placement removes only that marker; Ctrl+Z after the deletion restores 1, 2 and 3, and Ctrl+Shift+Z gives 1 and 2 again;
- over busy content, the number is white with a soft shadow on every colour and black on White, and it is legible;
- a selected marker shows a blue ring, legible on light and dark content (pending);
- one, two and three digit numbers (for example 1, 12 and 123, after placing at least 100 markers) fit inside their circles at width 3 px and at width 30 px;
- with select/move (V) chosen, a click on a marker selects it; with nothing chosen it does nothing; a drag moves it and keeps its number, a selected marker shows no resize handles, a width change resizes it around its centre, a colour change recomputes the number contrast, and Ctrl+Z reverts each of these;
- at 100%, 200% and approximately 133% scaling, the circle edges are smooth, the number is centred and not blurred, and the exported marker matches the marker on screen;
- on two monitors with different scaling, a marker placed on the second monitor stays within the selection and is exported at that monitor's resolution;
- the PNG (Ctrl+S with format PNG), JPG (Ctrl+S with format JPG) and clipboard (Ctrl+C) images contain the markers with their current numbers, and a marker crossing the selection edge is cropped; compare the images with the screen.

15. **Gradient annotations** (pending, graphical checks). The gradient toggle (accessible name "Gradient") is at the end of the style row. Check that:

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

## Annotation shadows (pending; requires GNOME Shell 50 / Wayland)

- Draw arrows, rectangles, ellipses, numbered markers, text, highlighters and pixelated regions over light, dark and busy content. Check each has a subtle 25% black shadow, offset 1 logical px right and 2 down with a 2 logical px blur. The shadow follows the visible alpha, including glyphs and strokes, rather than the bounding box; large hollow outlines stay hollow and highlighter transparency remains unchanged. Check the marker disc casts the new shadow while its number retains its existing appearance.
- Move, resize, recolour, undo, redo and delete annotations; shadows follow their content and stacking order without stale pixels, changed hit areas or separate history entries. Edit committed text and confirm its shadow hides with it and returns on commit. Close and reopen the capture and check no old shadow remains.
- At 100%, approximately 133% and 200%, check shadows remain aligned and have the same logical size. Compare preview with PNG, JPG and clipboard exports, including shadows crossing the selection edge: the shadow is clipped to the selection, while toolbar, tooltip, frame and handles remain absent.

## Top bar icon (pending; not run)

Requires a real GNOME Shell 50 / Wayland session and the user. Install the packed zip, log out and in, and record each result:

- Check the icon is visible and matches neighbouring icons, including hover and open-menu states.
- Check legibility on the default dark top bar and a light top bar (light shell theme or high contrast), and when switching between light and dark colour schemes.
- Check sharpness at 100%, 200% and approximately 133% scaling.
- Check the menu contains only “Take screenshot” and “Preferences”, and that “Preferences” opens the window.
- Open the menu with left and with right click and check both show the same menu. Check “Take screenshot” shows `Alt+Shift+X` right-aligned and dimmed. Change the shortcut in the preferences window (and with `gsettings set org.gnome.shell.extensions.mirx capture-shortcut "['<Control><Super>s']"`) and check the hint updates at once without a second icon; set it to `[]` and check the hint disappears.
- Choose “Take screenshot” and check the overlay opens without the menu or highlighted item in the frozen screen or exported PNG. Repeat several times, including with a window under the menu.
- Click “Take screenshot” twice quickly and check that only one capture opens.
- Turn the preference off and on in the preferences window and with `gsettings set org.gnome.shell.extensions.mirx show-panel-icon false`; check the icon disappears and reappears immediately with the menu open and closed, and the shortcut works throughout.
- Disable and enable the extension (`gnome-extensions disable/enable mirx@devidence.dev`) many times; check there is one icon, no error in `journalctl --user -g mirx`, and no leftover menu or actor. In Looking Glass, verify `Main.panel.statusArea` has no `mirx@devidence.dev` entry while disabled.
- Disable the extension between choosing “Take screenshot” and the capture starting; check no capture opens.

Also monitor the GNOME Shell log during testing:

```sh
journalctl --user -b -f -o cat /usr/bin/gnome-shell
```

For each check, record the result, exact version, monitor configuration, and any error or screenshot evidence if it fails. Do not mark the suite as passed based only on the Node results.

## Toolbar, tooltips and hotkeys (pending; requires GNOME Shell 50 / Wayland)

- Check both rows, group spacing and dividers, 36 px buttons, 28 px swatches, accessible names, focus, hover, pressed, checked and disabled states. Check the four-way select/move icon and all other icons for clarity and consistent weight.
- Check the glass blur over the frozen screenshot, rounded corners, border and shadow over light and dark content. If the blur or corners fail, apply the mitigation order in the design and record the outcome. Check solid fallback legibility if selected.
- Verify Copy or Save is suggested according to the Enter setting, updates after changing it, and Cancel closes without export. At 100%, 200%, approximately 133%, large text and on a small monitor check crispness, unclipped labels and fit.
- Hover and focus controls: tooltips show the correct name and shortcut after 300 ms, fade, flip and stay on the monitor. A quick pass, click, key press, hiding, export and closing cancel them; reopening leaves no old tooltip or timer.
- With a selection, test V, A, R, E, N, H, P and T in both cases, including Shift and Caps Lock. Confirm no tool change without a selection, during a drag or export, while editing text, or with Ctrl, Alt or Super. Verify Ctrl+A/C/S/Z, Ctrl+Shift+Z, Enter, Escape, Delete and arrows retain their actions.
- Check the toolbar after review: swatches are perfect circles, Copy and Save are icon buttons (theme icons, accent fill on the Enter action, tooltips `Copy (Ctrl+C, Enter)` and `Save (Ctrl+S)`), no tool is highlighted when the capture opens, V or a click highlights select/move, choosing Arrow unchecks it, and with no tool highlighted the editor is idle: dragging inside the selection does nothing and annotations cannot be selected.
- Export with a tooltip visible and inspect the image for absence of the toolbar and tooltip; also check recovery after an export failure.

## Frame, handles and cursors (pending; requires GNOME Shell 50 / Wayland)

- On light and dark content at 100%, approximately 133% and 200%, inspect the 2 px blue frame and dark ring, and the centred 10 px round white handles with blue borders and shadows. Check a full-monitor selection and selected annotation handles.
- Grab each handle near the edge of its 16 px hit area, including overlapping handles on a tiny selection; confirm the nearest handle and cursor agree.
- Check pointer over controls, default over toolbar background and outside a selection, crosshair before selection and while drawing, text cursor for text and editing, default arrow inside the selection and over annotations while idle (nothing chosen) with a drag there doing nothing and the eight handles still resizing, move cursor inside the selection and over annotations once select/move (V or click) is chosen, all eight directional resize cursors and move on arrow endpoints. Confirm root cursor appears over toolbar children and cursor theme supports bidirectional names.
- Drag selection, annotations, drawing and each resize handle across toolbar and other regions; the gesture cursor remains fixed until release, then follows the pointer. Inspect exports for absence of frame, ring and handles.

## Capture toolbar implementation checks (2026-11-10)

Automated validation passed: `npm test` (193 tests, no skips), `npm run lint`, `npm run check` (including strict schema validation), `npm run pack`, and `openspec validate refine-capture-toolbar --strict`. The generated archive contains the 14 expected toolbar icons, runtime sources and no compiled schema, tests or tooling.

The toolbar icons were rendered from their SVG files and visually inspected at 16 px and 72 px. This checks their shapes and weight, independently of the pending GNOME presentation checks above.

New presentation APIs were checked against the supplied GNOME Shell 50 GIR files:

| API                                           | Declaration                         |
| --------------------------------------------- | ----------------------------------- |
| Actor cursor and bidirectional resize values  | `.gir/Clutter-18.gir:1652`, `:6369` |
| Transformed extents returning `Graphene.Rect` | `.gir/Clutter-18.gir:994`           |
| Picking the actor under a stationary pointer  | `.gir/Clutter-18.gir:20555`         |
| Event actor lookup                            | `.gir/Clutter-18.gir:20590`         |
| Keysym conversion                             | `.gir/Clutter-18.gir:24035`         |
| Hover tracking and insensitive state          | `.gir/St-18.gir:4101`, `:3934`      |
| Theme context and scale factor                | `.gir/St-18.gir:3069`, `:3157`      |
| Blur radius and background mode               | `.gir/Shell-18.gir:529`, `:542`     |

The supplied GIR set has no GLib declarations. The tooltip uses the [binding version of `timeout_add`](https://docs.gtk.org/glib/func.timeout_add.html), returning `SOURCE_REMOVE` after its first callback. [`timeout_add_once`](https://docs.gtk.org/glib/func.timeout_add_once.html) is not available to language bindings.

The host lacks `/usr/bin/glslangValidator`; all six shaders passed `npm run glsl` in a temporary Docker container with the repository mounted read-only. No shader code changed for annotation shadows.

Annotation-shadow validation on 2026-11-10: `npm test` passes 205 tests without skips; lint, check (including strict schema validation), pack and strict OpenSpec validation pass. Both shadow runtime modules are included in the zip. Tests cover padding, physical alignment at 100/133/200%, fractional-scale blur, silhouette sources, stacking, unchanged refreshes, movement, visibility while editing, removal and export retention. New APIs were checked in `.gir/Clutter-18.gir:5140` (Clone/source), `:5772` (ColorizeEffect/tint) and `.gir/Shell-18.gir:472` (BlurEffect/ACTOR). These checks do not establish graphical fidelity; the annotation-shadow GNOME and export checks above remain pending.

## Annotation appearance memory (pending graphical checks)

Pending: a GNOME Shell 50 / Wayland session and user interaction are unavailable in this environment; no results below have been observed.

- [ ] Set Blue and gradient on, then cancel, copy and save in separate captures; reopen each time and confirm both values. Disable/enable the extension and log out/in and check again. Turn gradient off and confirm that is remembered too.
- [ ] Using buttons and A/N shortcuts, set arrow to 3 px and marker to 5 px; assign sizes to rectangle, ellipse, highlighter, pixelate and text and verify each restores independently. Check idle and empty Select and move disable size buttons and show the fallback.
- [ ] Select and move an old marker with a different style; confirm selection alone does not change memory. Restyle it, undo and redo, and confirm new markers retain the edited size and shared colour. Check fresh captures have no selection, annotations or history and marker numbering starts at 1.
- [ ] At 100%, 200% and approximately 133% scaling, compare restored styles in preview and PNG, JPG and clipboard exports, including markers, text, pixelation and annotations crossing selection edges. Verify clipping, GPU rendering and exclusion of toolbar and editing decorations.
- [ ] Change default width and colour in preferences; verify the next capture uses the colour and only tools without saved size overrides use the new fallback. Simulate a rejected settings write and confirm one preference error, continued editing/export and last saved values after reopen.

API verification: [Gio.Settings get_value](https://docs.gtk.org/gio/method.Settings.get_value.html) and [set_value](https://docs.gtk.org/gio/method.Settings.set_value.html) document the methods and setter result. The [GJS 1.88 GLib override](https://raw.githubusercontent.com/GNOME/gjs/1.88.0/modules/core/overrides/GLib.js) shows dictionary packing and deep unpacking. Target Gio/GLib GIR files and typelibs were unavailable locally, so direct target typelib verification remains pending.

## Export performance diagnostics

GNOME Shell 50.1 / Wayland, 2026-11-10: two full-monitor captures at 2560 × 1600 physical pixels and about 133% scale took 1137.697 ms (copy) and 1075.630 ms (PNG save). Respectively, paint took 6.594 / 5.502 ms, the synchronous composite call took 42.851 / 38.408 ms, and the wait for PNG completion and callback scheduling took 1083.175 / 1028.722 ms. Clipboard submission took 2.940 ms; file preparation and PNG write took 0.173 and 1.309 ms. These results identify the PNG completion wait as the dominant measured phase; they do not separately time encoding and callback scheduling.

On the same machine, a 2560 × 1600 synthetic RGBA image containing flat regions and seeded pseudorandom detail was encoded entirely in memory three times per setting. GdkPixbuf's default PNG encoding took 380–411 ms and produced 6,212,348 bytes; `compression=1` took 29–33 ms and produced 7,862,629 bytes. A separate synthetic round trip with compression 1 yielded identical SHA-256 hashes for the original and decoded pixel buffers. These measurements show the speed/size trade-off for synthetic input, not the expected duration or size of a real screenshot.

The existing GNOME Shell 50 [`composite_to_stream`](https://github.com/GNOME/gnome-shell/blob/50.0/src/shell-screenshot.c#L1053-L1141) performs a PNG encode before it returns a pixbuf and does not expose a compression option. GdkPixbuf's [`save_to_streamv_async`](https://docs.gtk.org/gdk-pixbuf/method.Pixbuf.save_to_streamv_async.html) accepts encoder options, but using it earlier requires obtaining the rendered pixels without the existing helper. The target's `Cogl.Texture.get_data` GIR marks its byte-array argument as input, while [GJS 1.88 array marshalling](https://github.com/GNOME/gjs/blob/1.88.0/gi/arg.cpp#L960-L992) may copy that data.

On 2026-11-10, the [isolated texture readback probe](probes/README.md) ran on GNOME Shell 50.1 / GJS 1.88.0. It created a known 2 × 2 RGBA texture in a separate headless Shell. `Cogl.Texture.get_data()` returned 16 but left all 16 caller bytes at their sentinel value; the existing native PNG/pixbuf helper recovered all 16 expected bytes. A separate `Clutter.Stage.paint_to_buffer()` call returned success but also left the caller bytes unchanged, while a native reference capture of the same synthetic stage contained different pixels. These two direct GJS approaches therefore did not provide usable output in this test. The probe did not modify the installed extension or capture the user's screen. Do not replace the working export path until another approach verifies correct bytes, clipping, colour, scaling, failure recovery and actual end-to-end speed. Node tests validate the timing boundaries, not graphical correctness or speed.

Existing implementations: [GNOME Shell 50's screenshot UI](https://github.com/GNOME/gnome-shell/blob/50.0/js/ui/screenshot.js#L1758-L1783) and [Screenshot Tool](https://extensions.gnome.org/review/49843) use `composite_to_stream`. [QuickSnap](https://github.com/SnowTimSwiss/QuickSnap#how-it-works) instead hides its selection overlay and calls `screenshot_area`, which also returns PNG; it has no annotation editor. These examples do not establish a faster way to encode Mirx's already-composited texture. GNOME's [extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#scripts-and-binaries) prohibit bundling native executables or libraries, so a bundled native readback bridge would not fit the project's extension distribution target.

On 2026-11-10 an isolated headless GNOME Shell 50.1 (Ubuntu 26.04, gdk-pixbuf 2.44.5, glycin 2.1.1, 24 cores, 2560 × 1600 textures) tested splitting the capture into horizontal strips with one `composite_to_stream` call each, merging them and encoding once with `compression=1`. Merged and decoded pixels matched the single-call pixbuf by SHA-256 in every run, but the strips did not encode in parallel: for a photographic wallpaper the PNG wait was 641 ms with 1 strip and 599 ms with 8; for a detailed screenshot 263 ms and 232 ms. The small difference equals the encode time that overlaps the synchronous readbacks. The approach was discarded. The same runs show the wait depends on content: 38–72 ms for mostly flat screens, 640–790 ms for photographs. Encoding the merged image with `compression=1` took 14–54 ms and produced files 1.3–2.6 times larger.

Since no JavaScript path yields the pixels before the helper's PNG finishes, the export now closes the overlay as soon as the helper returns from its synchronous readback (`export-composite-sync`), and encodes and delivers in the background. Pending in a real session: the overlay disappears without the previous delay; the clipboard or file is complete when the notification appears; a paste before the notification yields the previous clipboard content; a failed save after the overlay closed is reported by notification.

For an extension installed in the user's extension directory, enable timing and watch the log:

```sh
gsettings --schemadir "$HOME/.local/share/gnome-shell/extensions/mirx@devidence.dev/schemas" set org.gnome.shell.extensions.mirx perf-log true
journalctl --user -b -f -o cat | rg 'mirx-perf'
```

Copy the same content first as a small selection and then as a full monitor, without annotations. Repeat with annotations, and save both sizes as PNG and JPG. Record physical dimensions, display scale, GNOME version and three runs per case. Keep image content comparable because PNG encoding cost also depends on its content.

- `export-paint`: export preparation, temporary decoration hiding and the synchronous GPU stage paint. The line includes physical output dimensions and monitor scale.
- `export-composite-sync`: time spent inside the native composite call before it returns. In [GNOME Shell 50](https://github.com/GNOME/gnome-shell/blob/50.0/src/shell-screenshot.c#L1053-L1141), this includes texture readback, pixbuf conversion and scheduling PNG encoding.
- `export-png-wait`: time from the native call returning until its completion callback, including PNG encoding and callback scheduling. The Shell helper always encodes PNG, including before our JPG save path.
- `export-clipboard`: submitting the PNG bytes to the clipboard; excludes a receiving application's later paste or decode.
- `export-file-prepare`: resolving/creating the output directory and opening a unique file.
- `export-png-write` / `export-jpeg-and-write`: writing/closing PNG output, or removing alpha, encoding JPG and writing/closing it.
- `export`: existing total time from the export input event through delivery. Phase times do not include all setup, so they need not sum exactly to this total.

No image pixels, file paths or screenshot contents are logged. Turn timing off after collecting the comparison:

```sh
gsettings --schemadir "$HOME/.local/share/gnome-shell/extensions/mirx@devidence.dev/schemas" set org.gnome.shell.extensions.mirx perf-log false
```
