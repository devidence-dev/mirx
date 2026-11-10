# Design

## Context

CI already runs through the reusable `ci-gnome-extension.yml` in `devidence-dev/workflows` (`.github/workflows/ci.yml`). `scripts/pack.js` writes `dist/mirx@devidence.dev.shell-extension.zip`, and `scripts/check.js` validates `metadata.json`. `metadata.json` currently has `"version-name": "1.0"` and `package.json` has `"version": "1.0.0"`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One manual action turns the default branch into a GitHub Release with the zip attached.
- A wrong or reused version fails early, before anything is published.

**Non-Goals:**
- No change to what the zip contains or to its name.
- No release on push or on tag push; no changelog file; no EGO upload.

## Decisions

**Release logic lives in the shared `workflows` repo, not in mirx.** A new reusable workflow `release-gnome-extension.yml` and a composite step `ci/gnome-extension/steps/release` hold the logic; mirx keeps a 10-line caller, as it does for CI. Alternative: a full workflow in mirx. Rejected because the next GNOME extension would copy it. Trade-off: mirx depends on a minor `v2` release of `workflows` before its first run.

**`metadata.json` `version-name` is the source of truth.** It is what GNOME and EGO show to users. `package.json` `version` must match, and `scripts/check.js` enforces both the `X.Y.Z` form and the match, so the existing `check` step in CI and in the release verify job catches drift. Alternative: derive the tag from `package.json`. Rejected because `package.json` is private tooling, not the shipped metadata. The test file covers both failure cases by running the check against a temporary copy of the metadata.

**Start at `0.1.0`.** The old `1.0` was never published. EGO's integer `version` is assigned by EGO at upload, so it is not set here.

**Tag created by `gh release create --target $GITHUB_SHA`.** The tag appears on the verified commit with no separate push step, and the release and tag cannot get out of step. An existing tag is refused first with `git ls-remote --tags origin`, because `gh release create` against an existing tag would reuse it. Alternative: tag with git and then create the release. Rejected: two steps and a half-done state if the second fails.

**Default-branch guard is a job `if`.** `github.ref == format('refs/heads/{0}', github.event.repository.default_branch)` on the release job means a run from another branch verifies the code but publishes nothing. Alternative: fail the workflow. Rejected: a skipped publish is simpler, and `verify` still gives feedback.

**Least privilege.** The caller and the `release` job get `contents: write`; `verify` gets `contents: read`. The token is passed explicitly because composite actions cannot default to `github.token`.

**No `v0.1` floating tag.** Users download the zip, not a `uses:` reference, so only immutable `vX.Y.Z` tags exist. `releases/latest` serves the newest.

## Risks / Trade-offs

- [Caller runs before `workflows` ships the new workflow] → Release the `workflows` minor `v2` bump first (last task).
- [Version bumped in one file only] → `npm run check` fails in CI before merge.
- [Release started while a bad commit is on the default branch] → `verify` runs the same checks as CI; Sonar and secret scan are not repeated, they already gate the merge.
- [A tag created by a failed half-run] → `gh release create` makes tag and release together; if it fails, delete the stray tag and rerun.

## Migration Plan

1. Merge this change. 2. Release `workflows` as a minor `v2` bump. 3. Run the mirx Release workflow on the default branch. 4. Download the zip and install it on the test machine. Rollback: delete the GitHub Release and its tag, bump `version-name`, and release again.
