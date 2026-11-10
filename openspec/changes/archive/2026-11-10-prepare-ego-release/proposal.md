# Proposal

## Why

mirx is ready to be submitted to extensions.gnome.org (EGO). The current package identity (`mirx@mirx.local`, no license, no project URL, a one-line description, a zip that ships a compiled schema) does not meet EGO review rules. The UUID is immutable once published, so it must change before the first upload.

## What Changes

- **BREAKING**: UUID changes from `mirx@mirx.local` to `mirx@devidence.dev`. Machines with the old UUID must uninstall it first (see design).
- `metadata.json` gains `url` and `version-name`, and a clearer `description`.
- Add a `LICENSE` file (GPL-2.0-or-later, full text) and declare the license in `package.json` and the README.
- The installable zip drops `schemas/gschemas.compiled`; it is built only to validate the schema.
- The zip is named `mirx@devidence.dev.shell-extension.zip`.
- README gets a one-time migration note and a License section.
- `scripts/pack.js`, `scripts/check.js` and `tests/package.test.js` follow the new identity and assert the zip contents.

Out of scope: any change to extension behavior, the settings schema id or path, translations, supporting Shell versions other than 50, and the actual EGO upload.

The EGO upload itself is deferred; GitHub Releases distribute the zip meanwhile (see `add-github-release`).

## Capabilities

### New Capabilities
- `extension-packaging`: package identity, license, installable zip contents and settings preservation across the UUID change.

### Modified Capabilities

None. No existing capability changes behavior.

## Impact

- Files: `metadata.json`, `package.json`, `LICENSE`, `README.md`, `scripts/pack.js`, `scripts/check.js`, `tests/package.test.js`.
- Users of `mirx@mirx.local` must uninstall it once and log out and in.
- Schema id `org.gnome.shell.extensions.mirx` and its path do not change, so settings are kept.

**Status (2026-11-10):** the package is ready for EGO, but the upload is postponed by the user's decision. GitHub Releases distribute the zip in the meantime (see `add-github-release`); EGO publication is a planned follow-up.
