# extension-packaging Specification

## Purpose

Defines the identity, license and installable archive of the mirx extension so that it can be submitted to extensions.gnome.org and installed without losing user settings.

## Requirements

### Requirement: The extension uses a UUID in a namespace the author controls

The extension UUID SHALL be `mirx@devidence.dev`. The old UUID `mirx@mirx.local` SHALL NOT appear in the shipped files, the build scripts or the user documentation, except in the one-time migration note.

#### Scenario: Metadata carries the new UUID
- **WHEN** `metadata.json` is read
- **THEN** its `uuid` is `mirx@devidence.dev`

#### Scenario: No stale references to the old UUID
- **WHEN** the tracked files are searched for `mirx@mirx.local`, excluding archived changes, `dist` and `node_modules`
- **THEN** the only matches are the migration note in the README and the migration text in this change

#### Scenario: The archive is named after the new UUID
- **WHEN** `npm run pack` succeeds
- **THEN** it writes `dist/mirx@devidence.dev.shell-extension.zip`

### Requirement: The metadata describes the extension for review

`metadata.json` SHALL contain `name`, `description`, `url`, `shell-version` and `settings-schema`. `url` SHALL point to the project repository. `description` SHALL be 1 to 3 short sentences. `shell-version` SHALL list only verified Shell versions.

#### Scenario: Required keys are present
- **WHEN** `metadata.json` is read
- **THEN** `name` is `mirx`, `url` is `https://github.com/devidence-dev/mirx`, and `description` is a non-empty string
- **AND** `settings-schema` is `org.gnome.shell.extensions.mirx`

#### Scenario: Only the verified Shell version is declared
- **WHEN** `metadata.json` is read
- **THEN** `shell-version` is `["50"]`

#### Scenario: The description is concise
- **WHEN** the `description` is read
- **THEN** it has at most 3 sentences and mentions annotated screenshots and that everything stays local

#### Scenario: Invalid metadata fails the check
- **GIVEN** `metadata.json` has another UUID or no `url`
- **WHEN** `npm run check` runs
- **THEN** it exits with an error

### Requirement: The project is licensed GPL-2.0-or-later

The repository SHALL contain a `LICENSE` file with the full unmodified text of the GNU General Public License version 2. `package.json` SHALL declare `GPL-2.0-or-later`. The README SHALL state the license, the "or (at your option) any later version" grant and the copyright holder and year.

#### Scenario: License text is in the repository
- **WHEN** `LICENSE` is compared with the GPL version 2 text
- **THEN** both are identical

#### Scenario: Package manifest declares the license
- **WHEN** `package.json` is read
- **THEN** its `license` is `GPL-2.0-or-later`

#### Scenario: README states the license
- **WHEN** the README is read
- **THEN** it has a "License" section naming GPL-2.0-or-later and "Copyright (C) 2026 PX1"

### Requirement: The installable zip contains only runtime files

The zip SHALL contain `extension.js`, `prefs.js`, `metadata.json`, `stylesheet.css`, the schema XML under `schemas/` and the runtime sources under `src/`. It SHALL NOT contain `schemas/gschemas.compiled`, tests, scripts, `node_modules`, `dist`, tooling configuration or `openspec`. A `LICENSE` file SHALL NOT be required inside the zip.

#### Scenario: Runtime files are present
- **WHEN** the zip is listed
- **THEN** it includes `extension.js`, `prefs.js`, `metadata.json`, `stylesheet.css`, `schemas/org.gnome.shell.extensions.mirx.gschema.xml` and every file under `src/`

#### Scenario: No compiled schema
- **WHEN** the zip is listed
- **THEN** no entry is named `schemas/gschemas.compiled`

#### Scenario: No tests or tooling
- **WHEN** the zip is listed
- **THEN** no entry starts with `tests/`, `scripts/`, `node_modules/`, `dist/` or `openspec/`
- **AND** no entry is `package.json`, `biome.json` or a lock file

#### Scenario: Schema is validated even though it is not shipped
- **GIVEN** a schema XML that does not compile with `glib-compile-schemas --strict`
- **WHEN** `npm run pack` runs
- **THEN** it fails and writes no zip

#### Scenario: Compiled schema is built on install
- **GIVEN** a zip without `schemas/gschemas.compiled`
- **WHEN** it is installed with `gnome-extensions install`
- **THEN** the installed extension directory contains `schemas/gschemas.compiled` and preferences load

### Requirement: User settings survive the UUID change

The GSettings schema id SHALL remain `org.gnome.shell.extensions.mirx` and its path SHALL remain unchanged, so values stored under that path are read by the extension under the new UUID.

#### Scenario: Schema id and path are unchanged
- **WHEN** the schema XML is read
- **THEN** its id is `org.gnome.shell.extensions.mirx` and its path is `/org/gnome/shell/extensions/mirx/`

#### Scenario: Settings kept after migration
- **GIVEN** the user changed settings under the old UUID
- **WHEN** the old UUID is uninstalled and the new zip is installed
- **THEN** preferences show the earlier values

#### Scenario: Old UUID must be removed first
- **GIVEN** both `mirx@mirx.local` and `mirx@devidence.dev` are installed
- **WHEN** both are enabled
- **THEN** they would register the same keybinding and schema, so the README tells the user to uninstall the old UUID before installing the new one
