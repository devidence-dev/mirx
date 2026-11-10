# Design

## Context

See `proposal.md` for motivation. Current state, from the code:

- `extension.js` `enable()` builds a `CaptureSession` with injected ports, registers the `capture-shortcut` keybinding calling `this._session.open()`, and connects `monitors-changed` and `sessionMode` `updated` to `this._session.close()`. `disable()` removes the keybinding, disconnects both ids, destroys the session and nulls fields.
- `CaptureSession.open()` returns at once if a session is active or the session is disposed. Otherwise it `await`s `capture.capture()` (a `Shell.Screenshot.screenshot_stage_to_content`, i.e. the whole stage including panel, popup menus and any other `uiGroup` actor), then opens the overlay, which takes a modal grab (`Main.pushModal`, throws if revoked).
- `prefs.js` builds Adw rows by hand and uses a `watch()` helper to keep rows in sync with GSettings changes, disconnecting on `close-request`.
- `scripts/pack.js` copies a fixed list (`extension.js`, `prefs.js`, `metadata.json`, `stylesheet.css`, `src`, `schemas`) to a stage dir; `tests/package.test.js` asserts the exact zip listing.
- Node tests cannot import `gi://` or `resource://` modules. Existing tests use injected ports (`tests/session.test.js`) and source-text assertions (`tests/keybinding.test.js`) for Shell-bound files.
- `metadata.json` has no `session-modes`, so the extension is enabled only in the `user` session mode; it is disabled on the lock screen. Nothing extra is needed there.

### Findings on GNOME Shell 50.1 (read-only, on the test machine)

Read from `libshell-18.so` gresource and `libst-18.so` strings. Node tests do not prove them; task 9.1 lists what still needs the real session.

- `Main.panel.addToStatusArea(role, indicator, position, box)` throws if `statusArea[role]` is already set ("Extension point conflict") and throws a `TypeError` unless the indicator is a `PanelMenu.Button`. It removes `statusArea[role]` itself when the indicator emits `destroy`. Default box is the right box, default position 0.
- `PanelMenu.Button` (`_init(menuAlignment, nameText, dontCreateMenu)`) creates a `PopupMenu.PopupMenu`, adds its actor to `Main.uiGroup`, toggles it on click and closes it in `vfunc_hide`. `destroy()` runs `ButtonBox._onDestroy`, which destroys the container. The menu actor lives in `uiGroup`, not under the button, so it must be destroyed through the button (`indicator.destroy()` handles it via `menu.destroy()`).
- `PopupMenuBase.addAction(title, callback)` creates a `PopupMenuItem` and connects `activate`. The menu connects its own `activate` handler with `ConnectFlags.AFTER`, which calls `itemActivated(PopupAnimation.FULL)` and so closes the menu with a 150 ms animation (`POPUP_ANIMATION_TIME`). Our callback therefore runs first, while the menu is still fully visible and holds its grab.
- `PopupMenu.close(animate)` sets `isOpen = false`, emits `open-state-changed` (the button loses its `active` style at once) and eases the box pointer out. With `PopupAnimation.NONE` the duration is 0, but the actor is hidden in the ease `onComplete`, not necessarily before the call returns.
- `Extension.openPreferences()` exists in `resource:///org/gnome/shell/extensions/extension.js` and calls `extensionManager.openExtensionPrefs(this.uuid, '', {})`.
- St loads symbolic icons through `st_icon_info_load_symbolic` (GTK-derived). It detects symbolic files by the `-symbolic.svg` suffix, and `st_icon_theme_lookup_by_gicon` accepts a `Gio.FileIcon` (`g_file_icon_get_file`). To recolour it wraps the SVG with an injected stylesheet. The strings in `libst` show the rule `rect,path,ellipse,circle,polygon { fill: <foreground> !important; }` plus `.success`, `.error` and `.warning` classes. Only `fill` is rewritten. `stroke` is never touched.

## Goals / Non-Goals

**Goals:**
- A top bar indicator with a two-item menu, added and removed at runtime by one boolean preference.
- A clean disable: no actor, signal, idle source or pending capture survives.
- A symbolic icon that GNOME recolours correctly.
- Logic that can be tested in Node lives in a small module with injected ports.

**Non-Goals:**
- Extra menu items, a quick-settings tile, translations.
- Changing `CaptureSession`, the overlay or the capture adapter.
- Supporting the indicator on shell versions other than 50.

## Decisions

### D1. Lifecycle: a small controller, a Shell-bound factory

Two new files:

- `src/application/panelIndicator.js` (no GNOME imports): `PanelIndicatorController({ isVisible, create, defer, openCapture, openPreferences })`.
  - `sync()` creates the indicator when `isVisible()` is true and none exists, and destroys it when `isVisible()` is false. It is idempotent.
  - `create({ onScreenshot, onPreferences })` returns an object with `destroy()`.
  - `screenshot()` cancels any pending request and schedules `openCapture` through `defer`; `defer(fn)` returns a cancel function.
  - `destroy()` cancels the pending request and destroys the indicator. It is safe to call twice.
- `src/ui/panelIndicator.js` (GNOME-bound): `createPanelIndicator({ icon, role, onScreenshot, onPreferences })` returns a `PanelMenu.Button` subclass instance, registered by the caller with `Main.panel.addToStatusArea(role, indicator)`.

`extension.js` wiring:

- `enable()`: after the session exists, build the controller, call `controller.sync()`, then `this._settings.connect('changed::show-panel-icon', () => controller.sync())`, keeping the id.
- `disable()`: disconnect that id first, then `controller.destroy()`, then the existing teardown (keybinding, signals, session).
- `role` is `this.uuid` (`mirx@devidence.dev`). It is unique to the extension and is what EGO reviewers expect; a generic name could collide with another extension and make `addToStatusArea` throw. The controller's `create` wrapper calls `addToStatusArea` in the extension; if it throws, `sync()` lets the error propagate to the Shell log without leaving a half-registered indicator.
- The indicator is created after the session so a click can never reach a missing session, and it is destroyed before the session so a pending request is cancelled before the session is disposed.

Alternative: put everything inline in `extension.js`. Rejected: the sync, cancel and double-destroy logic is the part that can regress, and it would be untestable in Node. The controller is about 30 lines and adds no abstraction beyond one injected factory.

### D2. Menu actions and closing the menu before the capture

"Preferences": `onPreferences` calls `this.openPreferences()` (the `Extension` method). The menu closes through the menu's own `activate` handler.

"Take screenshot": the item callback runs before the menu's own close, with the menu fully visible. If it called `session.open()` directly, `screenshot_stage_to_content` would paint the open menu into the snapshot and the overlay's modal grab would compete with the menu grab. So the callback does:

1. `menu.close(BoxPointer.PopupAnimation.NONE)`: no 150 ms fade, the grab is released, the button loses its `active` style.
2. `controller.screenshot()`, which defers `openCapture` with `GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, ...)`.

The idle priority matters: Clutter's redraw runs at a higher priority than `PRIORITY_DEFAULT_IDLE`, so the frame that hides the menu is painted before the idle callback runs and the capture sees a menu-free stage. The callback returns `GLib.SOURCE_REMOVE` and clears the stored id.

Cleanup: the controller stores the cancel function; `destroy()` and a second `screenshot()` call cancel it (`GLib.Source.remove(id)`), so no source fires after disable and a double click does not queue two captures. `CaptureSession.open()` is already guarded against reentry, so a stray second call is harmless.

Alternatives:
- Fixed `GLib.timeout_add(..., 50)`: works but guesses a delay and adds latency; idle is deterministic with the redraw order.
- Wait for the menu's `menu-closed` signal: correct when the menu animates, but with `NONE` and an already hidden box pointer it may not fire, which would lose the capture. Rejected for the risk of a silent no-op.
- Call `open()` synchronously: shows the menu in captures. Rejected.

Fallback if the real-session check (task 9.1) shows the menu in the capture: replace the idle by `GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, ...)` in the same `defer` port. Nothing else changes.

### D3. Icon loading, recolouring and the white stroke

Loading: `new St.Icon({ gicon: Gio.icon_new_for_string(`${this.path}/icons/mirx-symbolic.svg`), style_class: 'system-status-icon' })` added to the button. `this.path` is the extension directory; the file is in the zip (D5). `St.Icon` uses the `system-status-icon` size (16 px in the default theme) and, because the file name ends in `-symbolic.svg`, takes the symbolic path in St.

Alternative: ship a theme-style `icons/` directory and use `icon_name`. Rejected: needs `Gtk.IconTheme.add_search_path` or an extra directory layout for one icon.

**The designer's caveat is real.** `icons/mirx-symbolic.svg` draws everything as strokes: `<g fill="none" stroke="#ffffff" stroke-width="1.5" ...>`. St recolours by forcing `fill` on `rect,path,ellipse,circle,polygon` and never touches `stroke`. For this file that gives the worst of both outcomes:

- the stroke stays white, so on a light top bar the icon is invisible and on a dark one it ignores the theme colour (no hover or active tint);
- the `!important` CSS fill overrides `fill="none"` on the paths, so the open corner brackets and the X would be filled with the foreground colour as solid wedges.

**Decision:** change the SVG, not the loader. Redraw `icons/mirx-symbolic.svg` as filled outlines: the same 16×16 grid, the same visual shape, no `stroke` attribute, no `fill="none"`, a single neutral fill (`#bebebe`, GNOME's symbolic convention; the value is overridden anyway). Each of the four corner brackets and the two X strokes becomes one closed `<path>` (outer edge at offset 0.75 from the old centreline, round caps as arcs). Elements use only `path`, so the St rule matches them all, and there are no `<g>` styles, gradients, masks or `<title>` dependencies. Keep `<title>`.

Alternatives rejected:
- Keep strokes and add a `Clutter.ColorizeEffect` or shader to the `St.Icon`: extra GPU effect on a panel actor, and it would still need the colour from the theme node.
- Keep the white icon: fails the light-theme requirement and ignores hover and active colours.
- Load a `Gio.BytesIcon` with a colour substituted at runtime: more code, and it would recolour once instead of following the theme.

How it is verified:
1. The new geometry is rasterised next to the old one at 16 px and 64 px, with the same fill colour, and compared by eye and by alpha mask (a container with `rsvg-convert`, or any renderer already on the machine; per the user's rules, no tool is installed without approval).
2. The recolouring rule is emulated by injecting `rect,path,ellipse,circle,polygon { fill: #ff00ff !important; }` into the SVG and rendering it. The result must be a clean magenta mark, with no filled wedges.
3. A Node test asserts the packaged SVG has no `stroke` attribute, no `fill="none"` and no gradient, so a future edit cannot reintroduce the problem.
4. Real session (user): the icon shows in the top bar colour, changes with hover and open-menu states, and stays legible with a light top bar (for example a light shell theme or high contrast) and with the default dark one. The default GNOME 50 top bar is dark in both light and dark colour schemes, so "light" here means a theme that changes the panel colour.

**Revision after review.** The first redraw used 1.5 px lines (the logo's exact proportion at 16 px) and looked too thin in the real top bar. `icons/mirx-symbolic.svg` was regenerated with the logo's geometry (corner arms to 5.5, radius 1.75, X from 6,6 to 10,10) at 2 px line width, the usual weight for GNOME symbolic icons. It is still all filled paths, with no strokes. Rendered with librsvg on the test machine with St's recolouring CSS, it reads clearly bolder at 16 px.

### D4. Preference and prefs UI

- Schema: `<key name="show-panel-icon" type="b"><default>true</default><summary>Show icon in top bar</summary></key>`. The schema id and path do not change (existing requirement stays valid).
- `prefs.js`: in the "Capture" group (or a new "Interface" group, assumption below), an `Adw.SwitchRow` titled "Show icon in top bar", `active` set from `settings.get_boolean('show-panel-icon')`, `notify::active` writes the setting, and `watch('changed::show-panel-icon', ...)` updates `active` only when it differs, mirroring the other rows. `Gio.Settings.bind` was considered but the file's convention is manual `watch`, which also disconnects on `close-request`; stay with it.
- Hiding the icon leaves the `capture-shortcut` keybinding untouched: the keybinding is registered in `enable()` independent of the preference.

### D5. Packaging

- `scripts/pack.js`: after the existing loop, create `stage/icons` and copy only `icons/mirx-symbolic.svg`, failing with "Required package file missing" if it is absent. Do not copy the `icons` directory, so `mirx.svg` and any future file are excluded by construction.
- `tests/package.test.js`: add `'icons/mirx-symbolic.svg'` to the exact expected list. The `deepEqual` then also guards against `mirx.svg` or `README.txt` slipping in.
- `scripts/check.js` needs no change: it checks only JavaScript syntax, metadata and schema.
- Verify `cpSync` of a single file into a not-yet-existing directory; use an explicit `mkdirSync(join(stage, 'icons'))` to avoid depending on it.

### D6. Repository layout and README

- Keep `icons/`. Delete `icons/README.txt`. Its notes are recorded here and are the only copy:
  - `mirx.svg`: colour icon, transparent background, editable and scalable; for README, repository and visual material.
  - `mirx-symbolic.svg`: monochrome white icon on a 16×16 grid for the dark GNOME bar; check legibility and colour with the real theme; depending on how it is loaded it may need adapting so GNOME recolours it (see D3).
  - Both are a vector interpretation of the approved concept, not an exact trace, and contain no logotype text.
  - For the extension: include `mirx-symbolic.svg` in the package and load it as a `GIcon` from the extension path, or add it to an icon theme; check that packaging includes it and test on GNOME Shell with light and dark themes.
- README, top of file, before the title or directly under it (assumption: logo above the `# mirx` heading, centred):
  ```html
  <p align="center"><img src="icons/mirx.svg" width="128" alt="mirx logo"></p>
  ```
  GitHub renders SVG with a transparent background and the gradient, which reads on both light and dark GitHub themes.
- README Usage: add that the capture can also be started from the top bar icon menu ("Take screenshot"), and that the icon can be hidden. Preferences: add a "Show icon in top bar" row (default on) to the table, and mention that "Preferences" in the icon menu opens the window, besides `gnome-extensions prefs`. Keyboard shortcuts table: unchanged.
- `tests/MANUAL.md`: add a pending section for the real-session checks (task 9.1).

### D7. EGO review guidelines that apply

- `disable()` must destroy every object created in `enable()`: the `PanelMenu.Button` (and with it its menu and container), the settings signal and the idle source. No actor is left in `Main.panel.statusArea`, `uiGroup` or the panel boxes.
- Objects are created in `enable()`, not at import time or in the constructor.
- The settings signal id is stored and disconnected; the settings object is dropped in `disable()`.
- The icon file is shipped in the zip and loaded from the extension path; no network and no files outside the extension.
- Unique `addToStatusArea` role and no private Shell API beyond `Main.panel.addToStatusArea`, `PanelMenu`, `PopupMenu`, which extensions use routinely. No `Main.panel.statusArea[...]` access.
- No stray timeouts: the one idle source is removed on completion and on disable.

### D8. Rendering cost, scaling and export

The indicator is a static panel actor with one 16 px symbolic image; St caches the recoloured pixbuf by colour and scale. No new per-frame work and no effects. At fractional scales St rasterises the SVG at the scaled size. The capture still includes the top bar, as before, so the icon appears in captures of a whole monitor like any other top bar content, which is existing behaviour (the top bar counts as screen content); only the menu must not appear, per D2. No export code changes.

### D9. Capture shortcut hint in the menu

The "Take screenshot" item shows the current `capture-shortcut` as a dimmed, right-aligned hint, for example `Take screenshot          Alt+Shift+X`. Left and right click keep the standard `PanelMenu.Button` behaviour: both open the same menu.

- API: read-only check of `libshell-18.so` on Shell 50.1: `PopupMenuItem` (`_init(text, params)`) only adds one `St.Label`; there is no accelerator-label API. So the item is a `PopupMenu.PopupMenuItem` plus an extra `St.Label` with `style_class: 'popup-inactive-menu-item'` (the dimmed class Shell uses on inactive items), `x_expand: true`, `x_align: Clutter.ActorAlign.END` and `y_align: CENTER`. The hint is hidden when its text is empty. The activate handler is the same as before: close with `PopupAnimation.NONE`, then `onScreenshot()`.
- Formatter: `formatAccelerator(accelerator)` in `src/core/accelerator.js`, pure and GNOME-free, tested in Node. `<Alt><Shift>x` gives `Alt+Shift+X`, `<Control><Super>s` gives `Ctrl+Super+S`, `<Primary>` (also `Control`, `Ctrl`) gives `Ctrl`, `Mod1` gives `Alt`, `Mod4` gives `Super`, `space` gives `Space`, `Print` stays `Print`, F-keys stay `F5`, and `Page_Up` gives `Page Up`. Empty, non-string, unknown modifier, modifier-only or malformed input gives an empty string. It does not use `Gtk`, which Shell does not load.
- Data flow: the controller gets a `shortcutLabel()` port (extension.js: `formatAccelerator(settings.get_strv('capture-shortcut')[0])`), passes `shortcut` to `create()` and offers `syncShortcut()`, which calls `indicator.setShortcut(text)` if an indicator exists and the controller is not destroyed.
- Live update: extension.js connects `changed::capture-shortcut` next to the `show-panel-icon` connection and calls `syncShortcut()`. The indicator is not recreated.
- Cleanup: the signal id is stored in `_shortcutSettingsId` and disconnected in `disable()` before the controller is destroyed. No new actor, timer or idle source exists outside the menu item, which `indicator.destroy()` removes with the menu.
- Shown value only: the label is not the source of truth. A shortcut that Shell rejects still shows, as in the preferences window.

## Risks / Trade-offs

- [Idle is not enough and the menu is captured] → The check in task 9.1 covers it; the fallback is the 50 ms timeout in D2 without further changes.
- [Redrawn SVG differs visibly from the designer's strokes] → Rasterised side-by-side comparison in task 1.1; if the designer wants a different look, they supply a filled symbolic icon and only the file changes.
- [`PanelMenu.Button`/`PopupMenu` are internal Shell modules] → Standard extension surface, checked on Shell 50.1 only; the shell-version stays `["50"]`.
- [`addToStatusArea` throws on a role collision after an unclean reload] → The role is unique to this UUID; `disable()` always destroys the button, which removes the entry.
- [Icon visible in captures of the top bar] → Expected, matches existing behaviour for other top bar content.
- [Two menu clicks in a row] → The controller cancels the pending request; `CaptureSession.open()` also ignores a second call.

## Assumptions (minor, recorded)

- Preference key `show-panel-icon`; label "Show icon in top bar"; the row goes in the existing "Capture" group, below the capture folder, to avoid a new group for one row.
- The indicator sits in the right box at the default position (leftmost of the right box, `addToStatusArea` default).
- Menu strings are plain English literals, like the rest of the UI.
- `docs/mirx.feature` is not edited: it describes the capture flow, which does not change.
- Accessible name of the button: "mirx".

## Open Questions

- Is the redrawn filled symbolic icon acceptable to the designer? It only affects the SVG file and can be answered during the real-session check.
