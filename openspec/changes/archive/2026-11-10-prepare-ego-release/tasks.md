# Tasks

## 1. Package identity

- [x] 1.1 Update `metadata.json`: UUID `mirx@devidence.dev`, `url`, `version-name` `1.0`, a 1-3 sentence description; keep `name`, `shell-version` and `settings-schema`. Verify with `node -e "console.log(require('./metadata.json'))"`.
- [x] 1.2 Update `scripts/check.js` to require the new UUID and a `url`. Verify `npm run check` passes, and fails when the UUID in `metadata.json` is temporarily changed.
- [x] 1.3 Update `tests/package.test.js` for the new UUID and the `url`. Verify `npm test` passes.
- [x] 1.4 Replace every remaining `mirx@mirx.local` in tracked code, scripts and docs (README). Verify `grep -rn "mirx@mirx.local" . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=archive --exclude-dir=docs` only returns the migration note and this change.

## 2. License

- [x] 2.1 Add `LICENSE` copied from `/usr/share/common-licenses/GPL-2`. Verify with `cmp LICENSE /usr/share/common-licenses/GPL-2`.
- [x] 2.2 Set `"license": "GPL-2.0-or-later"` in `package.json` and add a README "License" section with the "or (at your option) any later version" sentence and "Copyright (C) 2026 PX1". Verify by reading both.

## 3. Zip contents

- [x] 3.1 Change `scripts/pack.js`: name the zip `mirx@devidence.dev.shell-extension.zip`, compile the schema in the staging directory with `--strict`, delete `gschemas.compiled` before zipping, stop copying `LICENSE`. Verify `npm run pack` and `unzip -l dist/mirx@devidence.dev.shell-extension.zip`.
- [x] 3.2 Add tests in `tests/package.test.js` that build the zip and assert the expected runtime files, no `schemas/gschemas.compiled`, no tests or tooling, and no required `LICENSE`. Verify `npm test` passes (the zip test is skipped when `glib-compile-schemas` or the zip tool is unavailable).

## 4. Documentation

- [x] 4.1 Update README install and update instructions for the new zip name and add the one-time migration note: `gnome-extensions uninstall mirx@mirx.local`, then log out and in, then install. Verify the commands read correctly and match the design (D2).

## 5. Automated verification

- [x] 5.1 Run `npm test`, `npm run lint`, `npm run check` and `npm run pack`. Verify all pass and the zip listing matches the spec.

## 6. Real GNOME session (user)

- [x] 6.1 REQUIRES A REAL GNOME SESSION, done by the user, not the agent. On a machine with the old UUID: run `gnome-extensions uninstall mirx@mirx.local`, log out and in, run `gnome-extensions install dist/mirx@devidence.dev.shell-extension.zip`, log out and in, enable it. Verify: `ls ~/.local/share/gnome-shell/extensions/mirx@devidence.dev/schemas` shows `gschemas.compiled` (confirms install compiles the schema; otherwise apply the D4 fallback); earlier settings are kept; the shortcut opens the overlay; preferences open; one capture and one save succeed. Validated by the user on 2026-11-10 in GNOME Shell 50.1 (Ubuntu 26.04): old UUID uninstalled, `mirx@devidence.dev` installed from the zip without a compiled schema (`gnome-extensions install` compiled it), shortcut, preferences kept, capture and save work.
