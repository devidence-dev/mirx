<p align="center"><img src="icons/mirx.svg" width="128" alt="mirx logo"></p>

# 📸 mirx

Screenshot and annotate on GNOME Shell: grab a window, an area or a monitor, mark it up, then copy or save. Everything stays on your machine.

[![CI](https://github.com/devidence-dev/mirx/actions/workflows/ci.yml/badge.svg)](https://github.com/devidence-dev/mirx/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=devidence-dev_mirx&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=devidence-dev_mirx)
[![License: GPL-2.0-or-later](https://img.shields.io/badge/license-GPL--2.0--or--later-blue.svg)](LICENSE)

Targets **GNOME Shell 50 on Wayland**, tested on Ubuntu 26.04 LTS (GNOME Shell 50.1). Other Shell versions are not declared compatible.

## ✨ Features

- 🎯 **Three ways to select**: drag an area, click a window, or click empty space (desktop or top bar) or press Ctrl+A for the whole monitor under the pointer. A selection stays within one monitor.
- 🔍 **Magnifier** with a band crosshair and live cursor coordinates.
- 📐 **Alignment guides**: thin guides span the monitor under the pointer, with a translucent circle-and-cross mark on the pixel you are aiming at.
- ✏️ **Annotation tools**: arrow, rectangle, ellipse, numbered marker, highlighter, pixelate and text. Seven colours, stroke width 1-30 px.
- ① **Numbered markers** that renumber themselves when you delete one.
- ◐ **Gradient toggle** for arrows, rectangles, ellipses and markers.
- ↩️ **Undo / redo** per gesture.
- 💾 **Copy or save** as PNG or JPG. Guides, magnifier, toolbar and handles are never exported.
- 🔒 **Local only**: no network, no capture history.
- ⚡ **GPU rendering** for the overlay and the export.
- 🖥️ **HiDPI and fractional scaling**: exports match physical pixels (a 400 × 300 selection at 200% saves 800 × 600).

## 📦 Installation

### 📥 From GitHub Releases

Download `mirx@devidence.dev.shell-extension.zip` from the [latest release](https://github.com/devidence-dev/mirx/releases/latest), then install it:

```sh
gnome-extensions install --force mirx@devidence.dev.shell-extension.zip
```

Then **log out and back in** (Wayland only loads new extension code at login), and enable it:

```sh
gnome-extensions enable mirx@devidence.dev
```

### 🚧 extensions.gnome.org (planned)

Publication on [extensions.gnome.org](https://extensions.gnome.org/) is planned for a future version. Until then, use GitHub Releases or build from source.

### From source

You need Node.js 22 or later, `glib-compile-schemas` (package `libglib2.0-bin`) and `zip` (or Python 3 as a fallback).

```sh
npm run pack
gnome-extensions install --force dist/mirx@devidence.dev.shell-extension.zip
```

Then **log out and back in** (Wayland only loads new extension code at login), and enable it:

```sh
gnome-extensions enable mirx@devidence.dev
gnome-extensions prefs mirx@devidence.dev
```

Updating works the same way: install the new package, then log out and in.

`GLIB_COMPILE_SCHEMAS=/absolute/path` overrides the schema compiler used by `npm run pack`.

## 🖱️ Usage

Press **Alt+Shift+X**, or choose **Take screenshot** from the top bar icon menu (left or right click; the item shows your current shortcut). You can hide the icon in Preferences; the shortcut still works. The screen freezes. Hover to preview what a click would pick (a window, or the whole monitor where there is no window), then drag, click or press Ctrl+A. Annotate, then copy or save.

Annotations keep their screen position when you adjust the selection. Each annotation has a subtle shadow that follows its visible shape; shadows appear in exports and are clipped to the selection along with the annotations.

## ⌨️ Keyboard shortcuts

| Key                              | Action                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| Alt+Shift+X                      | Open the capture (configurable)                                                             |
| V / A / R / E / N / H / P / T    | Select/move / arrow / rectangle / ellipse / numbered marker / highlighter / pixelate / text |
| Ctrl+A                           | Select the monitor under the pointer                                                        |
| Arrow keys / Shift+arrow keys    | Move / resize the selection by one pixel                                                    |
| Ctrl+C / Ctrl+S                  | Copy to clipboard / save to file                                                            |
| Enter                            | Run the configured Enter action (copy or save)                                              |
| Ctrl+Z / Ctrl+Shift+Z            | Undo / redo                                                                                 |
| Delete                           | Delete the selected annotation (select/move tool)                                           |
| Esc                              | Cancel text, deselect an annotation, or close the capture                                   |
| Shift (while drawing an ellipse) | Perfect circle                                                                              |
| Enter / Shift+Enter (text)       | Confirm / add a new line                                                                    |

Mouse: a new capture has no tool chosen (nothing highlighted). In that idle state the cursor is the normal arrow inside the selection, dragging inside does nothing, and only the eight handles resize the selection. Choose the select/move tool (click it or press V) to drag the selection by its empty interior, click an annotation to select, move or resize it, or double-click text to change its content.

## ⚙️ Preferences

Choose **Preferences** from the top bar icon menu, or open with `gnome-extensions prefs mirx@devidence.dev`. The menu shows the keyboard shortcut next to **Take screenshot** and updates it when you change it.

| Setting              | Default         | Notes                                           |
| -------------------- | --------------- | ----------------------------------------------- |
| Keyboard shortcut    | `Alt+Shift+X`   | Needs Ctrl, Alt or Super                        |
| Enter action         | Copy            | Copy or Save                                    |
| Image format         | PNG             | PNG or JPG                                      |
| Capture folder       | `~/screenshots` | Must start with `/` or `~/`. Created if missing |
| Show icon in top bar | On              | Show or hide the top bar icon                   |
| Default colour       | `#ff0000`       | Hex, six digits                                 |
| Default width        | 3 px            | 1-30                                            |

File names carry the capture date and time. If a name exists, a suffix is added instead of overwriting. A save error keeps your session open so you can retry.

The schema also has a hidden `perf-log` key (default off) that logs motion and export timings, for developers.

## 🛠️ Development

Node with no runtime dependencies. [Biome](https://biomejs.dev/) is the only devDependency (`npm ci`). `npm run glsl` needs `glslangValidator`, from the OS package `glslang-tools`.

```sh
npm test         # Node test suite
npm run lint     # Biome lint and format check
npm run format   # Biome: apply formatting and safe fixes
npm run glsl     # compile the GLSL shaders
npm run coverage # tests with coverage, writes lcov.info
npm run check    # metadata, JS syntax and schema
npm run pack     # build dist/mirx@devidence.dev.shell-extension.zip
```

### 🚀 Releasing

Run the **Release** workflow from the Actions tab on the default branch. Pick `bump` (`patch`, `minor` or `major`) or set `custom_tag` (e.g. `v1.2.3`, which overrides `bump`), and optionally tick `prerelease`. No version edits are needed. It checks the code, packs the zip and publishes a GitHub Release with that tag. It refuses a tag that already exists. For the first release, choose `minor` (from `v0.0.0`) or `custom_tag: v0.1.0`.

The git tag is the source of truth for the version. The workflow stamps it into `version-name` in `metadata.json` and `version` in `package.json` in the CI workspace only, so the zip carries the right version and nothing is committed. The values in the repo are just the last released or dev value; `npm run check` still requires them to be `X.Y.Z` and equal.

## 🧭 How it was built

mirx was vibe-coded with AI coding assistants. To keep that orderly, it follows a spec-driven workflow with [OpenSpec](https://github.com/Fission-AI/OpenSpec): every change goes through proposal, specs, design and tasks before implementation, and is archived after verification. The living capability specs are in [`openspec/specs/`](openspec/specs/), and finished changes are kept in [`openspec/changes/archive/`](openspec/changes/archive/).

Every push and pull request is validated by CI, using the reusable `ci-gnome-extension.yml` from `devidence-dev/workflows`:

- Biome lint and format (cognitive complexity ≤ 15)
- GLSL shader compilation with `glslangValidator`
- the Node test suite
- coverage uploaded to SonarCloud, with a blocking Quality Gate
- Betterleaks secret scanning over the full history
- the pack build check

The Node tests do not run GNOME Shell, so real GNOME Shell 50 / Wayland sessions are checked by hand with [`tests/MANUAL.md`](tests/MANUAL.md), at 100%, 200% and about 133% scaling. Checks not yet run there are marked pending in that file.

## 📜 License

mirx is free software, licensed under the GNU General Public License, version 2 or (at your option) any later version (GPL-2.0-or-later). See [LICENSE](LICENSE).

Copyright (C) 2026 PX1
