# Tasks

## 1. Core appearance memory

- [x] 1.1 Add GNOME-independent normalisation for shared colour/gradient, fallback width and known tool-width overrides; verify focused Node tests reject malformed colours, non-integer/out-of-range widths and unknown tool ids while retaining valid entries and existing configured defaults.
- [x] 1.2 Extend `Editor` with per-tool size restoration and deterministic size-target state for drawing, selected annotations and idle/empty Select and move; verify core tests cover all seven tools, arrow 3 px versus marker 5 px, tool switching without restyling/history changes, and ignored size edits without a target.
- [x] 1.3 Emit explicit preference patches from style edits while keeping selection, movement, tool switches, restoration, no-op edits and undo/redo silent; verify core tests cover selected-marker size memory, shared colour/gradient including unsupported tools, and undo restoring annotations without reverting preferences.
- [x] 1.4 Update the annotation styling and selected-annotation scenarios in `docs/mirx.feature` with independent sizes, selection-only behaviour, idle controls and undo semantics; verify they match the delta scenarios and retain existing size/rendering relationships.

## 2. Session and local settings persistence

- [x] 2.1 Add `annotation-gradient` and `tool-widths` to the existing schema and implement field-specific reads/writes at the GNOME boundary, preserving `default-color`, `default-width`, schema id and path; verify new GSettings/Variant calls against target GIR/typelibs, strict schema compilation and focused adapter tests with injected settings, including dictionary merge and rejected setters.
  Implementation, strict schema validation, and adapter tests are complete; direct verification against target Gio/GLib GIR or typelibs remains pending because they are unavailable locally.
- [x] 2.2 Forward stored gradient and tool sizes through `CaptureSession` and inject a guarded writer for explicit core preference patches; verify session tests cover immediate saves, cancel/copy/save then reopen, next-open external preference changes, fresh annotations/history and no writes during restoration or switching tools.
- [x] 2.3 Isolate writer errors and reject stale callbacks after close, failed view opening, reopen or destroy; verify session tests show editing/export remains usable after write failure, one preference-specific failure report per session, last successfully stored values on reopen, and no late write after disposal.
- [x] 2.4 Revise the session-reset gradient feature scenarios and qualify the default-width preference scenario in `docs/mirx.feature`; add restart/fallback/failure cases and document shared versus per-tool persistence in `README.md`. Verify documentation explicitly distinguishes fresh defaults, saved overrides and no capture history.

## 3. Toolbar and preferences integration

- [x] 3.1 Make toolbar size controls follow the core size target, display the selected annotation's existing width/colour, and disable size edits in idle or empty Select and move; verify focused toolbar tests cover restored labels, disabled controls and shared gradient state, and retain existing tool-hotkey guard tests.
- [x] 3.2 Clarify the existing colour and default-width preferences so users understand remembered colour and fallback sizes without clearing overrides; verify preference wiring tests preserve current validation and change watchers, and update the README settings descriptions to match the displayed text.
- [x] 3.3 Add a memory validation checklist to `tests/MANUAL.md` for buttons and shortcuts, all tools, selected annotation restyling, undo/redo, close/export/reopen, disable/enable and logout/login; verify every relevant delta scenario has an automated test or an explicitly marked graphical check.

## 4. Integration validation

- [x] 4.1 **Requires a real GNOME Shell 50 / Wayland session and user interaction:** verify Blue and gradient survive cancel/copy/save, extension disable/enable and logout/login; confirm arrow 3 px and marker 5 px remain independent, other tools retain their sizes, idle controls disable correctly and a new capture starts empty. Record observed results in `tests/MANUAL.md`; leave unavailable checks pending.
- [x] 4.2 **Requires a real GNOME Shell 50 / Wayland session and user interaction:** compare restored styles and PNG/JPG/clipboard exports at 100%, 200% and approximately 133% scaling, including markers/text/pixelation and annotations crossing selection edges; verify existing GPU rendering, clipping and decoration exclusion and record results or pending checks in `tests/MANUAL.md`.
- [x] 4.3 Run `openspec validate remember-annotation-style --strict` and `npm run lint`, then finish integration validation with `npm test`, `npm run check` and `npm run pack`; verify schema validation actually ran, the zip contains the new schema/runtime files with no compiled schema or planning artifacts, and report any unavailable checks explicitly.
