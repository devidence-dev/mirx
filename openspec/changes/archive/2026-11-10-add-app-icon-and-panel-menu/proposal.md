# Proposal

## Why

mirx has no visible presence in GNOME: it opens only through a global keyboard shortcut, so a new user cannot discover it or reach its preferences without the command line. The project also now has a logo (`icons/`) that is not yet used anywhere.

## What Changes

- Add a top bar (panel) indicator that shows the mirx symbolic icon. Clicking it opens a menu with "Take screenshot" and "Preferences".
- "Take screenshot" closes the menu first, then opens the same capture as the keyboard shortcut. The menu never appears in the frozen capture.
- Add a boolean preference "Show icon in top bar" (default on). Changing it adds or removes the indicator at runtime. Hiding the icon does not affect the shortcut.
- Adapt `icons/mirx-symbolic.svg` so GNOME can recolour it to the top bar foreground colour (the designer's notes warn that it may need this).
- Pack `icons/mirx-symbolic.svg` into the extension zip. `icons/mirx.svg` stays in the repository for the README only.
- Show the colour logo `icons/mirx.svg` at the top of `README.md` and document the indicator and the new preference.
- Remove `icons/README.txt` (Spanish designer notes). Its content moves to `design.md`.

## Capabilities

### New Capabilities

- `panel-indicator`: the top bar icon, its two-item menu, its lifecycle and the "Show icon in top bar" preference.

### Modified Capabilities

- `extension-packaging`: the zip additionally contains `icons/mirx-symbolic.svg`, and the repository README shows the colour logo.

## Impact

- Code: `extension.js`, `prefs.js`, `schemas/org.gnome.shell.extensions.mirx.gschema.xml`, `scripts/pack.js`, new small modules under `src/application/` and `src/ui/`.
- Assets and docs: `icons/mirx-symbolic.svg`, `icons/README.txt` (deleted), `README.md`, `tests/MANUAL.md`.
- Tests: `tests/package.test.js` (exact zip list), `tests/tools.test.js` (package fixture) and new Node tests.
- No new dependency, no network access, no change to the capture, editing or export behaviour.

## Out of Scope

- Any capture option in the menu beyond the two items (area, window, delay, history).
- A quick-settings tile, a keyboard shortcut change, or an indicator on other panel boxes.
- A custom top bar icon for light shell themes beyond what GNOME recolouring gives.
- Translations (gettext) of the new strings; existing UI strings are not translated either.
- Publishing to extensions.gnome.org and changing `shell-version`.
