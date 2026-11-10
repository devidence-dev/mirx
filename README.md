# mirx

A GNOME Shell extension for capturing a window, an area, or a monitor and annotating it before copying or saving. It implements the specification in `docs/mirx.feature`. It works locally, without external services.

The extension targets **Ubuntu 26.04 with GNOME Shell 50 on Wayland**. Ubuntu identifies this GNOME version in its [official release notes](https://documentation.ubuntu.com/release-notes/26.04/changes-since-previous-interim/). Compatibility with other Shell versions is not declared.

## Set up and install

For development or packaging, you need Node.js 22 or later and `glib-compile-schemas` (the `libglib2.0-bin` package). The packager uses `zip`, or Python 3 if `zip` is unavailable. The installed extension uses libraries included with GNOME; it does not need Node.js or npm packages.

From the repository root:

```sh
npm test
npm run check
npm run pack
gnome-extensions install --force dist/mirx@mirx.local.shell-extension.zip
```

After the first installation, log out and back in so GNOME recognizes the extension. Enable it and open its preferences:

```sh
gnome-extensions enable mirx@mirx.local
gnome-extensions prefs mirx@mirx.local
```

To update the code loaded in Wayland, you must also log out and back in after installing the new package. `npm run pack` creates the archive without installing it. You can specify a different compiler location with `GLIB_COMPILE_SCHEMAS=/path/to/compiler`; the override must be an absolute path.

## Usage

Press **Alt+Shift+X**. Click a window, drag to select an area, click empty space (the desktop or the top bar) or press **Ctrl+A** to select the monitor under the pointer. Before you select, the highlight shows what a click would pick: the window under the pointer, or the whole monitor where there is no window. The image across all monitors remains frozen while editing.

| Control                                                                   | Action                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eight handles / drag empty interior                                       | Resize / move the selection                                                                                                                                                                                                                                                                                               |
| Arrow keys / Shift+arrow keys                                             | Move / resize the selection by one desktop pixel                                                                                                                                                                                                                                                                          |
| ↖ on the toolbar                                                          | Select, move, and edit annotations                                                                                                                                                                                                                                                                                        |
| Arrow, rectangle, ellipse, numbered marker, highlighter, pixelation, text | Choose a tool                                                                                                                                                                                                                                                                                                             |
| ◐ on the toolbar (Gradient)                                               | Shade new or selected arrows, rectangles, ellipses and numbered markers so the colour slides into a neighbouring hue (for example blue to violet, red to pink, yellow to orange), with no white highlight. Off at the start of each session; highlighter, text and pixelation are never shaded (graphical checks pending) |
| Shift while drawing an ellipse                                            | Perfect circle                                                                                                                                                                                                                                                                                                            |
| Double-click text in selection mode                                       | Edit its content                                                                                                                                                                                                                                                                                                          |
| Enter / Shift+Enter while editing text                                    | Confirm / add a line                                                                                                                                                                                                                                                                                                      |
| Delete                                                                    | Delete the selected annotation                                                                                                                                                                                                                                                                                            |
| Ctrl+Z / Ctrl+Shift+Z                                                     | Undo / redo                                                                                                                                                                                                                                                                                                               |
| Ctrl+C / Ctrl+S                                                           | Copy PNG / save in the chosen format                                                                                                                                                                                                                                                                                      |
| Enter outside the text editor                                             | Run the configured action                                                                                                                                                                                                                                                                                                 |
| Esc                                                                       | Cancel text, deselect an annotation, or close the capture                                                                                                                                                                                                                                                                 |

Before a selection exists, and while creating or resizing one, a magnifier appears next to the pointer and two thin solid guides cross at the pixel it marks, spanning the whole monitor under the pointer so you can line up distant edges. A translucent circle with a cross marks where they cross, and the pointer coordinates are shown next to it. They need no setting; they hide whenever the magnifier does and are never exported. The magnifier is a square with rounded corners, and translucent bands frame the marked pixel without covering it.

The selection stays within a single monitor. Annotations retain their screen coordinates when the selection is adjusted. The file contains only the crop and its annotations; controls are never exported. The displayed dimensions correspond to the output pixels: a selection of 400 × 300 units on a monitor at 200% produces 800 × 600 pixels.

In preferences, you can change the shortcut, the Enter action, the output folder and format (PNG/JPG), and the default annotation color and stroke width. The default folder is `~/screenshots`. A custom folder must start with `/` or `~/`. Files include the capture date and time; if the name already exists, a suffix is added without overwriting it. A save error preserves the session so you can try again.

## Architecture

| Layer             | Responsibility                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `src/core`        | Geometry, selection, annotations, and undo/redo commands. JavaScript with no GNOME dependencies. |
| `src/application` | Coordinate capture and export through injected services; manage concurrency and shutdown.        |
| `src/platform`    | Shell capture, file, and clipboard adapters.                                                     |
| `src/rendering`   | Draw annotations and sample pixelation from the original image.                                  |
| `src/ui`          | Input events, overlay view, toolbar, magnifier, and decorations.                                 |
| `extension.js`    | Compose services and manage the extension lifecycle.                                             |

Application dependencies are passed to the constructor, allowing the adapters to be replaced in tests. `CommandHistory` records one operation per gesture and discards the redo branch when a new action is created. The view and export share annotation rendering; decorations are separate. Text is measured using Pango, with the measurement injected into the model.

Capture uses `Shell.Screenshot.screenshot_stage_to_content()` and excludes the cursor texture. The integration follows the [GNOME Shell 50 APIs](https://github.com/GNOME/gnome-shell/blob/gnome-50/js/ui/screenshot.js). Annotations and exports share GPU actors and shaders. Export paints the selection on the physical pixel grid; clipboard and PNG saves reuse the compositor's PNG bytes, while JPG saves encode the returned pixbuf. No capture history is stored.

## Development

```sh
npm test              # unit tests
npm run lint          # Biome: lint and format check
npm run format        # Biome: apply formatting and safe lint fixes
npm run glsl          # validate the GLSL shaders (needs glslangValidator, package glslang-tools)
npm run coverage      # tests with coverage, writes lcov.info
npm run check         # metadata, JavaScript syntax, and schema
npm run pack          # build dist/mirx@mirx.local.shell-extension.zip
```

Install the dev dependency (Biome) once with `npm ci`; the tests and the extension itself have no runtime dependencies.

## Validation

`npm test` checks geometry, editing and history, pixelation sampling, concurrency and session errors, and the preferences schema. `npm run check` checks metadata, JavaScript syntax, and the schema using GLib. Installing npm dependencies is not required for either.

The Node tests do not run GNOME Shell or validate the graphical APIs in a real session. Installation, Wayland capture, visual interaction, clipboard, and PNG/JPG should be checked on Ubuntu 26.04 using the [manual test protocol](tests/MANUAL.md). GNOME Shell and GJS were unavailable in the implementation environment.

The v1 scope of the specification is retained: no selection across multiple monitors, delay, cursor, pencil, lines, “Save As,” pinning on screen, video, GIF, OCR, or capture history.
