# Design

## Context

mirx targets GNOME Shell 50 only. The package currently has UUID `mirx@mirx.local`, no license, no `url`, and `scripts/pack.js` stages the sources, compiles the schema and ships `schemas/gschemas.compiled` in the zip. See proposal.md for the motivation. The settings schema id `org.gnome.shell.extensions.mirx` has path `/org/gnome/shell/extensions/mirx/`; dconf stores values by path, not by UUID.

## Goals / Non-Goals

**Goals:**
- A zip that passes EGO review rules and still installs locally with `gnome-extensions install`.
- No loss of user settings.

**Non-Goals:**
- Supporting an automatic migration from the old UUID (only a documented manual step).
- Translations, new Shell versions, behavior changes.

## Decisions

### D1. Change the UUID now, to `mirx@devidence.dev`

EGO identifies an extension by UUID and the UUID cannot be changed after publication. `@mirx.local` is not a domain the author controls, and EGO requires a namespace the author controls. Changing it before the first upload costs one manual migration for the few existing installs; changing it later would cost a new listing and lose reviews and users. Alternative: keep `mirx@mirx.local` and rename after review. Rejected: it would make the first listing permanent under a rejected namespace.

### D2. Migration on a machine with the old UUID

Run `gnome-extensions uninstall mirx@mirx.local`, then install `mirx@devidence.dev`, then log out and in. The uninstall must come first: both extensions would register the same keybinding and the same schema id, so enabling both would conflict. Settings survive because the schema id and path are unchanged (D3) and `gnome-extensions uninstall` removes the extension directory, not dconf values. The README carries this as a one-time note.

### D3. Keep the settings schema id and path

Renaming the schema would reset every user setting and force changes in `prefs.js` and the extension. Nothing in EGO rules requires the schema id to contain the UUID; it must only start with `org.gnome.shell.extensions.`. It does.

### D4. Drop `schemas/gschemas.compiled` from the zip

EGO review guidelines say extensions for GNOME 44 and later should not ship the compiled schema. The runtime side was checked before deciding, read-only, on the GNOME Shell 50.1 test machine (192.168.100.144):

1. `getSettings()` in the Shell's `Extension` class (strings in `/usr/lib/gnome-shell/libshell-18.so`) calls `Gio.SettingsSchemaSource.new_from_directory(<ext>/schemas, default, false)`. It needs `gschemas.compiled` to exist in that directory at run time; it does not compile anything.
2. EGO-style installs: the Shell's `installExtension` code in the same library unzips the bundle and then runs `['glib-compile-schemas', '--strict', <ext>/schemas]` if a `schemas` directory exists. Confirmed in source text.
3. Local install: `/usr/bin/gnome-extensions` was copied off the machine and analyzed statically (no disassembler on hand, so by string and call-site cross-references). It has two `g_subprocess_new` call sites. One belongs to `pack` (`msgfmt`). The other loads the arguments `--strict` and `glib-compile-schemas`, with no `--dry-run`, and sits in the `install` code block, between the `metadata.json`, `schemas` and "`%s` exists and `--force` was not specified" references and before `uninstall`. So `gnome-extensions install` extracts the zip and compiles the schema itself. `gnome-extensions pack` only copies the schema XML.
4. The compiler exists on the target machine: `/usr/bin/glib-compile-schemas` (package `libglib2.0-bin`).

Decision: drop the compiled schema. Residual uncertainty: point 3 is static analysis, not an execution, because running an install on the test machine is out of scope here. The real-session task therefore checks that `schemas/gschemas.compiled` appears in the installed directory and preferences open. If it does not, the fallback is to keep the compiled file in the local zip and strip it only for the EGO upload.

`scripts/pack.js` still compiles the schema with `--strict` in the staging directory so that an invalid schema fails the build, then deletes the compiled file before zipping. `scripts/check.js` already validates with `--strict --dry-run`. Alternative: ship both zips. Rejected: more moving parts for a one-line difference.

### D5. License GPL-2.0-or-later, `LICENSE` outside the zip

GNOME Shell extensions run inside the GPL-2.0-or-later Shell process, and EGO requires a GPL-compatible license. Copyright holder is PX1, year 2026. `LICENSE` is the verbatim text from `/usr/share/common-licenses/GPL-2`, with nothing downloaded. EGO does not need `LICENSE` inside the uploaded zip, so `pack.js` stops copying it conditionally and tests do not require it there. Alternative: GPL-3.0-or-later. Rejected by the user decision.

### D6. Metadata

`url` is `https://github.com/devidence-dev/mirx`. `version-name` is `"1.0"` (a free-form label; EGO assigns its own integer `version` on upload, so none is added). `shell-version` stays `["50"]`: the README states other versions are not verified.

## Risks / Trade-offs

- [Local install may not compile the schema] -> Static evidence only (D4); the user-run session task verifies it, with a documented fallback.
- [Users keep both UUIDs enabled] -> README migration note, uninstall first; the Shell's duplicate keybinding is the visible symptom.
- [Historical reports under the untracked `docs/` folder still mention the old UUID] -> They describe past test runs; they are not shipped and are left as is.
- [Metadata, URL or license text rejected in review] -> Fix and re-upload; none of these is immutable except the UUID.
