## MODIFIED Requirements

### Requirement: The installable zip contains only runtime files

The zip SHALL contain `extension.js`, `prefs.js`, `metadata.json`, `stylesheet.css`, the schema XML under `schemas/`, the runtime sources under `src/` and the top bar icon `icons/mirx-symbolic.svg`. It SHALL NOT contain `schemas/gschemas.compiled`, the colour logo `icons/mirx.svg`, any other file under `icons/`, tests, scripts, `node_modules`, `dist`, tooling configuration or `openspec`. A `LICENSE` file SHALL NOT be required inside the zip.

#### Scenario: Runtime files are present
- **WHEN** the zip is listed
- **THEN** it includes `extension.js`, `prefs.js`, `metadata.json`, `stylesheet.css`, `schemas/org.gnome.shell.extensions.mirx.gschema.xml`, `icons/mirx-symbolic.svg` and every file under `src/`

#### Scenario: Only the symbolic icon is packaged
- **WHEN** the zip is listed
- **THEN** `icons/mirx-symbolic.svg` is the only entry under `icons/`
- **AND** no entry is `icons/mirx.svg` or `icons/README.txt`

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

#### Scenario: Missing icon fails the pack
- **GIVEN** `icons/mirx-symbolic.svg` is missing
- **WHEN** `npm run pack` runs
- **THEN** it fails naming the missing file and writes no zip

## ADDED Requirements

### Requirement: The README shows the colour logo

The repository SHALL keep the colour logo at `icons/mirx.svg`, and the top of `README.md` SHALL show it, centred, before the badges. The designer's notes file `icons/README.txt` SHALL NOT remain in the repository.

#### Scenario: README starts with the logo
- **WHEN** `README.md` is read
- **THEN** its first element is an image of `icons/mirx.svg` with alt text "mirx logo"
- **AND** the referenced file exists

#### Scenario: Logo is repository-only
- **WHEN** the repository is searched for references to `icons/mirx.svg` in shipped files
- **THEN** only `README.md` refers to it

#### Scenario: Notes file is gone
- **WHEN** the `icons/` folder is listed
- **THEN** it holds `mirx.svg` and `mirx-symbolic.svg` and no `README.txt`
