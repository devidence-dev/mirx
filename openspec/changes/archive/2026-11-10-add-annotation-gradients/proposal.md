# Proposal

## Why

Annotations are flat single-colour shapes. A vivid sweep of the chosen colour into a neighbouring hue gives arrows, boxes and markers more presence and direction, without asking the user to pick a second colour or a preset.

## What Changes

- **Depends on `add-numbered-markers`**: gradients apply to numbered markers, so that change must be applied first.
- Add one on/off gradient toggle to the toolbar style row, off by default in every capture session. There is no second colour picker and there are no presets.
- When the toggle is on, a new arrow, rectangle, ellipse or numbered marker slides from its own colour into a neighbouring hue, with no white highlight. Arrows run from tail to head; the other shapes run from their top-left to their bottom-right corner.
- The gradient does not apply to the highlighter, text or pixelate annotations; the toggle has no effect on them. The editor has no pen or line tool.
- As with colour and width, the toggle applies to new annotations and to the selected arrow, rectangle, ellipse or marker, as one undoable change. Unselected annotations keep their look. Changing the colour of a selected gradient annotation recomputes its shades from the new colour.
- A marker's number stays a solid contrasting colour; only the disc is shaded.
- The gradient is exported exactly as displayed in PNG, JPG and clipboard images.

Out of scope: a second colour, presets, custom angles or stops, a pen or line tool, and a `default-gradient` preference.

## Capabilities

### New Capabilities

- `annotation-gradients`: The gradient toggle, which annotations it shades and how, how it applies to new and selected annotations, and export fidelity.

### Modified Capabilities

None. Annotation behaviour is not yet an OpenSpec capability, and `numbered-markers` is still pending in `add-numbered-markers`, so this change states its marker behaviour inside `annotation-gradients`.

## Impact

- Editor state: `src/core/editor.js` (a `gradient` style flag, stored only on shapes that support it; applied to the selected annotation like colour and width).
- Rendering: `src/rendering/actorGeometry.js` (shades, axis and arrow bounds helpers), `src/ui/shaders.js` (gradient GLSL shared by the ellipse shader and a new recolour effect) and `src/ui/annotationActors.js` (effects on ellipses, markers, and on rectangles and arrows only while gradient is set).
- Toolbar: `src/ui/toolbar.js`.
- Export: no change; it paints the same scene.
- Tests: `tests/core.test.js`, `tests/actor-geometry.test.js`, `tests/annotation-actors.test.js`.
- Docs: `docs/mirx.feature`, `README.md`, `tests/MANUAL.md`.
- No new dependencies, preferences or GNOME APIs.
