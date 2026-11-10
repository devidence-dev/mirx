# Proposal

## Why

Releasing today needs a pull request that bumps `version-name` and `version` by hand before the Release workflow can run. The org's other deploys (for example automation-hub) are started with a `workflow_dispatch` that takes semver inputs and take the version from git tags. mirx should release the same way.

## What Changes

- The Release workflow becomes a `workflow_dispatch` with inputs `bump` (patch/minor/major, required), `custom_tag` (optional `vX.Y.Z`, overrides the bump) and `prerelease` (boolean).
- The release version is the git tag: the latest `vX.Y.Z` tag plus `bump` (from `v0.0.0` when there is none), or `custom_tag`. An existing tag is still refused.
- `metadata.json` `version-name` and `package.json` `version` are stamped with the tag version in the CI workspace before packing, never committed. The repo keeps `0.1.0` as the last released or dev value.
- `npm run check` still requires `version-name` to be `X.Y.Z` and equal to `package.json` `version`.
- The README "Releasing" section describes the new flow.
- **BREAKING** (reusable workflow, `devidence-dev/workflows`): `release-gnome-extension.yml` now requires `bump`. mirx is the only caller and changes together with it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-distribution`: version source becomes the computed git tag, manifests are stamped in CI, `prerelease` is supported, existing-tag refusal is kept.

## Impact

- `.github/workflows/release.yml` and `README.md` in this repo.
- `release-gnome-extension.yml`, the `release` step and README in `devidence-dev/workflows`, released as a `minor` bump on `v2`.
- Out of scope: committing version bumps, changelogs, extensions.gnome.org upload, changes to `scripts/check.js`.
