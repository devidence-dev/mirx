# Spec Delta

## Purpose

Defines how a mirx version is declared, validated and published as a GitHub Release carrying the installable zip, so users can install the extension without building it from source.

## ADDED Requirements

### Requirement: Releases are GitHub Releases built from the default branch

A release SHALL be a GitHub Release tagged `vX.Y.Z`, started manually. It SHALL be built only from the repository default branch, and only after lint, GLSL validation, tests and `npm run check` pass.

#### Scenario: Release from the default branch
- **WHEN** the Release workflow is run on the default branch and all checks pass
- **THEN** a GitHub Release `vX.Y.Z` is created, with its tag on the commit that was checked

#### Scenario: Release from another branch
- **WHEN** the Release workflow is run on a branch that is not the default branch
- **THEN** no release is created and no tag is pushed

#### Scenario: A check fails
- **WHEN** lint, GLSL validation, tests or `npm run check` fail during the Release workflow
- **THEN** the pack and release steps do not run and no release is created

### Requirement: The version has a single validated source

The release version SHALL be `version-name` in `metadata.json`, in the form `X.Y.Z`, and SHALL equal `version` in `package.json`. The first release SHALL be `0.1.0`.

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

The Release workflow SHALL fail without creating a release when the tag `vX.Y.Z` already exists on the remote.

#### Scenario: Version not yet released
- **WHEN** the tag `v0.1.0` does not exist on the remote
- **THEN** the workflow continues and creates the release

#### Scenario: Version already released
- **WHEN** the tag `v0.1.0` already exists on the remote
- **THEN** the workflow fails with a message to bump `version-name`, and the existing release and tag are unchanged

### Requirement: The release carries the installable zip

The release SHALL have exactly one asset, `mirx@devidence.dev.shell-extension.zip`, built by `npm run pack`, installable with `gnome-extensions install`.

#### Scenario: Asset attached
- **WHEN** a release is published
- **THEN** its only asset is `mirx@devidence.dev.shell-extension.zip`, and it is also reachable from `releases/latest`

#### Scenario: No zip or several zips
- **WHEN** `dist` holds no `*.shell-extension.zip` or more than one
- **THEN** the workflow fails and no release is created

### Requirement: extensions.gnome.org publication is a planned follow-up

This capability SHALL NOT upload to extensions.gnome.org. The README SHALL present GitHub Releases as the install route and extensions.gnome.org as planned.

#### Scenario: Installation docs
- **WHEN** a user reads the README installation section
- **THEN** "From GitHub Releases" is listed first, and extensions.gnome.org is marked planned for a future version

#### Scenario: No EGO upload
- **WHEN** the Release workflow runs
- **THEN** nothing is sent to extensions.gnome.org
