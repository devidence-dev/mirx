# Tasks

## 1. Version

- [x] 1.1 Set `metadata.json` `version-name` to `0.1.0` and `package.json` `version` to `0.1.0`; verify with `grep -E '"version(-name)?"' metadata.json package.json`
- [x] 1.2 Make `scripts/check.js` fail when `version-name` is not `X.Y.Z` or differs from `package.json` `version`; verify `npm run check` passes on the current files
- [x] 1.3 Add tests in `tests/package.test.js` for both failures (`1.0` and a mismatch against `package.json`); verify `npm test` passes and the tests fail if the check is removed

## 2. Release workflow

- [x] 2.1 Add `.github/workflows/release.yml` (`workflow_dispatch`, calls `release-gnome-extension.yml@v2`, `contents: write`) in the repo's YAML style; verify with `npx --no-install biome ci .` and `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:1.7.12 -color` printing nothing

## 3. Documentation

- [x] 3.1 Update the README installation section: "From GitHub Releases" first, extensions.gnome.org marked planned, "From source" kept; verify by reading the section and that the download URL is `https://github.com/devidence-dev/mirx/releases/latest`
- [x] 3.2 Add a short "Releasing" note to the README Development section; verify it names `version-name`, `version` and the Release workflow
- [x] 3.3 Add one line to `prepare-ego-release/proposal.md` saying the EGO upload is deferred and GitHub Releases distribute the zip meanwhile; verify `openspec validate prepare-ego-release --strict` passes

## 4. Integration

- [x] 4.1 Run `npm test`, `npx --no-install biome ci .`, `npm run check` and `npm run pack`; verify all pass and the zip is still `dist/mirx@devidence.dev.shell-extension.zip`
- [x] 4.2 Run `openspec validate add-github-release --strict`; verify it passes

## 5. Release (user only)

- [ ] 5.1 User only: release `devidence-dev/workflows` as a minor `v2` bump, run the mirx Release workflow on the default branch, then download the zip from the GitHub Release and install it on the test machine with `gnome-extensions install --force`; verify the release `v0.1.0` exists with the zip and the extension enables after logging out and in Pending at archive time (2026-11-10): archived before the first release by the user's decision; to be done after merging to `main`.
