# Tasks

## 1. Release workflow

- [x] 1.1 Replace `on: workflow_dispatch` in `.github/workflows/release.yml` with the `bump`, `custom_tag` and `prerelease` inputs and pass them via `with:`; verify with actionlint and `npx --no-install biome ci .`
- [x] 1.2 Keep `scripts/check.js` unchanged and the repo version at `0.1.0`; verify `npm run check` passes

## 2. Documentation

- [x] 2.1 Rewrite README "Releasing" (run Release, pick `bump` or `custom_tag`, optional `prerelease`, first release via `minor` or `v0.1.0`) and explain that the tag is the source of truth and files are stamped at release time; verify by reading the section
- [x] 2.2 Validate the change with `openspec validate release-semver-inputs --strict`

## 3. Integration

- [x] 3.1 Run `npm test`, `npx --no-install biome ci .`, `npm run check` and `npm run pack`; verify all pass

## 4. Release (user only)

- [ ] 4.1 User only: merge the `devidence-dev/workflows` change and release a `v2` bump (`minor`, or `major` for strictness)
- [ ] 4.2 User only: merge this mirx change
- [ ] 4.3 User only: run **Release** with `bump: minor` or `custom_tag: v0.1.0`, then check that `version-name` in the release zip's `metadata.json` matches the tag
