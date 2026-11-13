## MODIFIED Requirements

### Requirement: Releases are GitHub Releases built from the default branch

A release SHALL be a GitHub Release tagged `vX.Y.Z`, started manually with the inputs `bump` (patch, minor or major), optional `custom_tag` and `prerelease`. It SHALL be built only from the repository default branch, and only after lint, GLSL validation, tests and `npm run check` pass.

#### Scenario: Release from the default branch
- **WHEN** the Release workflow is run on the default branch and all checks pass
- **THEN** a GitHub Release `vX.Y.Z` is created, with its tag on the commit that was checked

#### Scenario: Prerelease
- **WHEN** the Release workflow is run with `prerelease` enabled and all checks pass
- **THEN** the GitHub Release is marked as a prerelease

#### Scenario: Release from another branch
- **WHEN** the Release workflow is run on a branch that is not the default branch
- **THEN** no release is created and no tag is pushed

#### Scenario: A check fails
- **WHEN** lint, GLSL validation, tests or `npm run check` fail during the Release workflow
- **THEN** the pack and release steps do not run and no release is created

### Requirement: The version has a single validated source

The release version SHALL be the git tag computed from the inputs: `custom_tag` when set, else the latest `vX.Y.Z` tag (`v0.0.0` when none) incremented by `bump`. The workflow SHALL stamp it into `metadata.json` `version-name` and `package.json` `version` in the job workspace only. The repository files SHALL hold `X.Y.Z` values that are equal.

#### Scenario: Automatic bump
- **WHEN** the latest tag is `v0.1.0` and `bump` is `minor`
- **THEN** the release tag is `v0.2.0` and the packed `metadata.json` `version-name` is `0.2.0`

#### Scenario: First release
- **WHEN** no `vX.Y.Z` tag exists and `bump` is `minor`
- **THEN** the release tag is `v0.1.0`

#### Scenario: Custom tag
- **WHEN** `custom_tag` is `v1.0.0`
- **THEN** the release tag is `v1.0.0`, whatever `bump` is

#### Scenario: Malformed custom tag
- **WHEN** `custom_tag` is `1.0` or `v1.0`
- **THEN** the workflow fails and no release is created

#### Scenario: Versions agree
- **WHEN** `metadata.json` `version-name` and `package.json` `version` are both `0.1.0`
- **THEN** `npm run check` passes

#### Scenario: Malformed version
- **WHEN** `version-name` is `1.0` or `v0.1.0`
- **THEN** `npm run check` fails and names the invalid value

#### Scenario: Versions differ
- **WHEN** `version-name` is `0.1.0` and `package.json` `version` is `0.2.0`
- **THEN** `npm run check` fails and names both values

### Requirement: An existing tag is refused

The Release workflow SHALL fail without creating a release when the computed tag `vX.Y.Z` already exists, locally or on the remote.

#### Scenario: Version not yet released
- **WHEN** the computed tag does not exist
- **THEN** the workflow continues and creates the release

#### Scenario: Version already released
- **WHEN** `custom_tag` is `v0.1.0` and the tag `v0.1.0` already exists
- **THEN** the workflow fails with a message naming the tag, and the existing release and tag are unchanged
