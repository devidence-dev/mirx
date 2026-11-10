# Proposal

## Why

Each capture currently reloads the configured colour and width and resets the gradient toggle, so users repeat the same adjustments. A shared width also makes switching between thin arrows and larger numbered markers inconvenient.

## What Changes

- Remember the last explicitly chosen colour and gradient state across captures, extension disable/enable and GNOME sessions, using local settings. Both remain shared across tools.
- Remember an independent size for arrow, rectangle, ellipse, numbered marker, highlighter, pixelate and text. For example, arrows can keep 3 px while markers keep 5 px.
- Restore the relevant size when choosing a tool by button or shortcut. Restyling a selected annotation updates the remembered size for that annotation's type.
- Keep the existing default width as the fallback for tools without a remembered size. Preserve the existing colour preference and schema identity.
- Replace the explicit session-only gradient rule and document first-use defaults separately from remembered values.
- Keep annotation edits undoable without undoing preference memory. Merely selecting an annotation or switching tools does not overwrite preferences or restyle existing annotations.

Out of scope: capture history, saved images or selections, restoring the active tool, cloud sync, style presets, per-tool colour or gradient, new size units, changes to rendering algorithms, and a new reset interface.

## Capabilities

### New Capabilities

- `annotation-style-memory`: Local persistence of shared colour/gradient and per-tool sizes, including fallback values, editing semantics, failure handling and session lifecycle.

### Modified Capabilities

- `annotation-gradients`: Restore the remembered toggle state instead of requiring it to be off at every capture start.

## Impact

Affected areas: `src/core/editor.js`, `src/application/captureSession.js`, `extension.js`, `src/ui/overlay.js`, `src/ui/toolbar.js`, `prefs.js`, and the existing GSettings schema. Add focused core/session/settings tests and update `README.md`, `docs/mirx.feature` and `tests/MANUAL.md`. Keep storage behind existing injection boundaries; no external services, new dependencies or rendering changes are needed. Real GNOME Shell 50 / Wayland validation remains distinct from Node tests.
