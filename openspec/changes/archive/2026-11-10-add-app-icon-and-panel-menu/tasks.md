# Tasks

## 1. Icon assets

- [x] 1.1 Redraw `icons/mirx-symbolic.svg` as filled outlines on the same 16×16 grid (no `stroke`, no `fill="none"`, no gradient, one neutral fill, `path` elements only, keep `<title>`). Verify: rasterise old and new at 16 px and 64 px with the same fill (container with `rsvg-convert`, or a renderer already installed; ask before installing anything) and confirm the same shape by eye and by alpha mask.
- [x] 1.2 Emulate the St recolouring on the new file by injecting `rect,path,ellipse,circle,polygon { fill: #ff00ff !important; }` and rendering it. Verify: a clean magenta mark with no filled wedges and no white edge.
- [x] 1.3 Add `tests/icons.test.js`: the symbolic SVG exists, has no `stroke`, no `fill="none"` and no gradient, and its file name ends in `-symbolic.svg`; `icons/mirx.svg` exists; `icons/README.txt` does not. Verify: `npm test` passes, and the test fails when a `stroke` attribute is added to the SVG.
- [x] 1.4 Delete `icons/README.txt` (its notes are recorded in `design.md` D6). Verify: `ls icons` shows only `mirx.svg` and `mirx-symbolic.svg`, and `tests/icons.test.js` passes.

## 2. Preference "Show icon in top bar"

- [x] 2.1 Add the boolean key `show-panel-icon` (default `true`, summary "Show icon in top bar") to `schemas/org.gnome.shell.extensions.mirx.gschema.xml`. Verify: `npm run check` compiles the schema strictly, and a Node test reads the XML and asserts the key is type `b` with default `true`.
- [x] 2.2 Add an `Adw.SwitchRow` "Show icon in top bar" to `prefs.js`, in the Capture group below the capture folder: initial value from the key, writes on `notify::active`, updated through the existing `watch('changed::show-panel-icon', ...)`. Verify: a source-text test (same style as `tests/keybinding.test.js`) asserts `prefs.js` reads, writes and watches `show-panel-icon`, and `npm run lint` passes.

## 3. Controller (Node-testable)

- [x] 3.1 Add `src/application/panelIndicator.js` with `PanelIndicatorController` (`sync`, `screenshot`, `destroy`) and injected `isVisible`, `create`, `defer`, `openCapture`, `openPreferences`, as in `design.md` D1 and D2. No GNOME imports. Verify: the module loads in Node and `npm run check` passes.
- [x] 3.2 Add `tests/panel-indicator.test.js` with mocks. Verify with `npm test` that:
  - `sync()` creates once when visible, is idempotent, destroys when the value turns false, and recreates when it turns true again;
  - `screenshot()` calls `openCapture` only after the deferred callback runs, and never synchronously;
  - a second `screenshot()` cancels the first pending request;
  - `destroy()` cancels a pending request (it never fires), destroys the indicator once, and is safe to call twice;
  - `sync()` after `destroy()` creates nothing, and `openCapture` and `openPreferences` are called through the callbacks given to `create`.

## 4. Indicator and extension wiring

- [x] 4.1 Add `src/ui/panelIndicator.js`: a `PanelMenu.Button` subclass with a `St.Icon` (`Gio.icon_new_for_string(<ext path>/icons/mirx-symbolic.svg)`, `style_class: 'system-status-icon'`), accessible name "mirx", and two `addAction` items, "Take screenshot" and "Preferences". The screenshot item calls `menu.close(PopupAnimation.NONE)` and then `onScreenshot()`. Verify: `npm run check` (syntax) and `npm run lint` pass; behaviour is covered by task 9.1.
- [x] 4.2 Wire `extension.js`: in `enable()` build the controller (`defer` uses `GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, ...)` and returns a function that removes the source, `create` calls `Main.panel.addToStatusArea(this.uuid, indicator)`, `openPreferences` is `this.openPreferences()`), call `sync()`, and connect `changed::show-panel-icon`. In `disable()` disconnect that id, destroy the controller, then run the existing teardown. Verify: `npm test`, `npm run check` pass.
- [x] 4.3 Add a source-text test (like `tests/keybinding.test.js`) asserting that `extension.js` uses `this.uuid` as the status-area role, connects and disconnects `changed::show-panel-icon`, destroys the controller in `disable()` before the session, and that the keybinding registration does not depend on the preference. Verify: `npm test` passes, and the test fails if the `disconnect` line is removed.

## 5. Packaging

- [x] 5.1 Update `scripts/pack.js` to create `icons/` in the stage and copy only `icons/mirx-symbolic.svg`, failing with "Required package file missing: icons/mirx-symbolic.svg" when absent. Verify: `npm run pack` succeeds, and renaming the file temporarily makes it fail without writing a zip.
- [x] 5.2 Add `'icons/mirx-symbolic.svg'` to the exact expected list in `tests/package.test.js`. Verify: `npm test` passes, and the zip listing (`unzip -l dist/mirx@devidence.dev.shell-extension.zip` or Python) shows no `icons/mirx.svg` and no `icons/README.txt`.

## 6. Documentation

- [x] 6.1 In `README.md`, add the centred logo `<p align="center"><img src="icons/mirx.svg" width="128" alt="mirx logo"></p>` at the top. Add a Node test (in `tests/icons.test.js`) that the README starts with that image and that the referenced file exists. Verify: `npm test` passes.
- [x] 6.2 Update the README Usage (capture can also start from the top bar icon menu; the icon can be hidden) and the Preferences section (new "Show icon in top bar" row, default on; the icon menu "Preferences" opens the window). Verify: the table matches the schema default, and `npm run lint` passes (Biome formats Markdown only if configured; otherwise read the diff).
- [x] 6.3 Add a pending section for the top bar icon to `tests/MANUAL.md` mirroring task 9.1, marked pending. Verify: the section exists and states it has not been run.

## 6b. Shortcut hint in the menu

- [x] 6b.1 Add `src/core/accelerator.js` with `formatAccelerator` and `tests/accelerator.test.js` (`<Alt><Shift>x`, `<Control><Super>s`, `<Primary>`, `Print`, `space`, F-keys, empty and invalid values). Verify: `npm test` passes.
- [x] 6b.2 Show the hint in `src/ui/panelIndicator.js`: `PopupMenuItem` plus a right-aligned `St.Label` (`popup-inactive-menu-item`), hidden when empty, and a `setShortcut(text)` setter. Verify: `npm run check` and `npm run lint` pass; rendering is covered by task 9.1.
- [x] 6b.3 Extend `PanelIndicatorController` with a `shortcutLabel` port, the `shortcut` option of `create()` and `syncShortcut()`; wire `extension.js` (`changed::capture-shortcut` connected next to `show-panel-icon`, disconnected in `disable()`). Verify: `tests/panel-indicator.test.js` (hint on creation, update on change, none after destroy) and `tests/panel-indicator-wiring.test.js` pass.
- [x] 6b.4 Document the hint: `README.md` (Usage and Preferences), `tests/MANUAL.md`, `design.md` D9 and the revision note in D3. Verify: `openspec validate add-app-icon-and-panel-menu --strict` passes.

## 7. Integration validation (automated)

- [x] 7.1 Run `npm test`, `npm run lint`, `npm run check` and `npm run pack` on the final code. Verify: all pass; report any skipped check (for example schema validation when `glib-compile-schemas` is unavailable) explicitly. Confirm `git status` shows no changes outside the files listed in the proposal Impact section.

## 8. Final checks without a graphical session

- [x] 8.1 Re-read `design.md` D3 and the specs against the final code. Verify: no requirement is claimed as passed that only task 9.1 can prove, and `openspec validate add-app-icon-and-panel-menu --strict` passes.

## 9. Real GNOME Shell 50 session (requires the user)

- [x] 9.1 **Requires a real GNOME Shell 50 / Wayland session and the user.** Install the packed zip, log out and in, then check and record each result in `tests/MANUAL.md`: Validated by the user on 2026-11-10 in GNOME Shell 50.1 (Ubuntu 26.04, dark top bar): icon visible and recoloured, 2 px redraw confirmed thicker in panel captures, menu opens, Take screenshot opens the capture without the menu in the image, Preferences opens, the show-panel-icon switch hides and restores the icon live while Alt+Shift+X keeps working. Not reported: a light theme and the live shortcut-hint update (covered by Node tests).
  - the mirx icon is visible in the top bar and has the same colour as neighbouring icons, including the hover and open-menu states;
  - the icon is legible on the default dark top bar and on a light top bar (light shell theme or high contrast), and when switching the colour scheme between light and dark;
  - the icon is sharp at 100%, 200% and about 133% scaling;
  - the menu shows "Take screenshot" and "Preferences" only; "Preferences" opens the window;
  - the "Take screenshot" item shows `Alt+Shift+X` right-aligned and dimmed, and the hint updates at once after changing the shortcut in preferences (and is hidden if the shortcut is cleared); left and right click open the same menu;
  - "Take screenshot" opens the capture overlay, and neither the menu nor its highlighted item appears in the frozen screen or in an exported PNG; repeat several times, also with a window open under the menu;
  - clicking "Take screenshot" twice quickly opens one capture;
  - turning the preference off and on in the preferences window, and with `gsettings set org.gnome.shell.extensions.mirx show-panel-icon false`, removes and adds the icon at once, with the menu open and closed, and the shortcut works throughout;
  - disabling and enabling the extension (`gnome-extensions disable/enable mirx@devidence.dev`) many times leaves one icon, no error in `journalctl --user -g mirx`, and no leftover menu or actor (Looking Glass, `Main.panel.statusArea` has no `mirx@devidence.dev` entry while disabled);
  - disabling between choosing "Take screenshot" and the capture starting does not open a capture.
  Until the user reports each item, leave it pending; do not mark it passed.
