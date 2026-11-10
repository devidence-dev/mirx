# Proposal

## Why

mirx has no way to reach users except building from source. The extensions.gnome.org (EGO) upload is postponed, so users need another installable download now. GitHub Releases can carry the packed zip with no review wait.

## What Changes

- Start versioning at `0.1.0`: `metadata.json` `version-name` and `package.json` `version` both become `0.1.0`.
- `npm run check` fails when `version-name` is not `X.Y.Z` or differs from `package.json` `version`.
- Add a manual `Release` workflow that calls the reusable `release-gnome-extension.yml` from `devidence-dev/workflows`. It verifies the code, packs the zip and publishes a GitHub Release `vX.Y.Z` with the zip attached.
- README: installation starts with GitHub Releases, the EGO section becomes "planned", and Development gains a short releasing note.

Out of scope: the EGO upload itself (planned follow-up), automatic releases on push, changelog files beyond GitHub's generated notes, signing, and any change to extension behavior or to the zip name.

## Capabilities

### New Capabilities
- `release-distribution`: how a version is declared, validated, tagged and published as a GitHub Release with the installable zip.

### Modified Capabilities

None. `extension-packaging` (in the open `prepare-ego-release` change) keeps owning the zip contents and name.

## Impact

- Files: `metadata.json`, `package.json`, `scripts/check.js`, `tests/package.test.js`, `README.md`, `.github/workflows/release.yml`, and one line in `openspec/changes/prepare-ego-release/proposal.md`.
- Depends on the new `release-gnome-extension.yml` in `devidence-dev/workflows`, released as a minor `v2` bump before the first run.
- The first release tag `v0.1.0` is created by the workflow, not by hand.
