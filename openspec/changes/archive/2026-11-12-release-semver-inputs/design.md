# Design

## Context

The reusable `release-gnome-extension.yml` (in `devidence-dev/workflows`, called as `@v2`) read `version-name` from `metadata.json`, refused an existing tag and ran `gh release create`. See proposal.md for motivation. `scripts/check.js` validates the manifests and stays unchanged.

## Goals / Non-Goals

**Goals:**
- Match the org deploys: `workflow_dispatch` with `bump`, `custom_tag`, `prerelease`; tags as the version source.
- Ship a zip whose `metadata.json` carries the released version.

**Non-Goals:**
- Committing the stamped files back to the repo.
- Prerelease suffixes on the tag (the deploys append one; here the GitHub flag is used).

## Decisions

- **Version calculation in the reusable workflow, inline in the `release` job.** Same shell as the org's `release.yml` (latest `vX.Y.Z` by `git tag --sort=-v:refname`, `v0.0.0` fallback, `fetch-depth: 0`). Alternative: a composite step; rejected, one caller and no reuse.
- **`custom_tag` must match `^v[0-9]+\.[0-9]+\.[0-9]+$`.** Deploys accept a bare `1.2.3` and prefix `v`; here a strict match fails early, since `check.js` and the tag need X.Y.Z.
- **Existing-tag check covers local and origin** (`git rev-parse` plus `git ls-remote`), before any build.
- **Stamp with node in the workspace, before `pack`.** `JSON.parse` and `JSON.stringify(..., null, 2)` plus a newline. Alternative: commit a bump; rejected, needs a push to a protected default branch. Side effect: `shell-version` is written multi-line in the zip's `metadata.json`; still valid JSON.
- **Prerelease uses `gh release create --prerelease`**, the tag stays plain `vX.Y.Z`.
- **Repo keeps `0.1.0`**; the tag is the source of truth, and `check.js` still guards that the two repo files agree.

## Risks / Trade-offs

- [Reusable workflow input change breaks callers] → mirx is the only caller and changes together; release workflows as `minor` on `v2` (or `major` for strictness).
- [mirx Release run before `v2` moves] → mirx must be merged only after the workflows release.
- [Stale local tags] → checkout uses `fetch-depth: 0`, and origin is queried for the tag check.

## Migration Plan

Merge workflows, release a `v2` bump, merge mirx, run Release. Rollback: revert mirx `release.yml` and point `@v2` back by moving the tag.
