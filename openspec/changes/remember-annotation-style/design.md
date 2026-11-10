# Design

## Context

See `proposal.md` for motivation and the two delta specs for the behaviour contract.

- `extension.js` owns GSettings and injects a read-only settings function into `CaptureSession`. Only colour and width are forwarded to each new `Editor`; gradient currently falls back to `false`.
- `Editor` is GNOME-independent. It has a shared `style`, and `setStyle()` both changes that style and restyles a selected annotation. Annotation history contains annotations only, already separating preference state from undo/redo.
- `Overlay` routes toolbar style changes through `editor.setStyle()`. Toolbar buttons and tool hotkeys both use `editor.setTool()`.
- `Toolbar.update()` displays a selected annotation's colour/width, or the editor's creation style, while gradient reflects the shared creation toggle. Its size controls currently always act on the displayed width.
- The schema already stores `default-color` and a range-limited `default-width`. Preferences exposes both and watches changes. Text size, marker radius and pixelation blocks derive from annotation width; highlighter coverage derives from the drawn region.
- `annotation-gradients` and `docs/mirx.feature` explicitly require the gradient to reset on every capture. This change replaces that rule, rather than treating persistence as an implementation-only fix.
- No `graphify-out/graph.json` exists in this checkout; planning findings come from the implementation, tests and specifications above.

## Goals / Non-Goals

**Goals:** Preserve the core/platform boundary, attach persistence only to explicit appearance edits, and keep existing annotation rendering and history semantics. Make target resolution deterministic for drawing, selected annotations and idle mode.

**Non-Goals:** A generic preference framework, new rendering paths, live synchronisation of appearance from an external preferences window into an already open capture, or storage of capture content. External preference edits are read at the next capture; saving a toolbar change writes only fields explicitly edited.

## Decisions

### 1. Reuse GSettings with one shared colour and two additive keys

Keep the existing schema id/path and keys. Use `default-color` as both the shared remembered colour and the existing preference's backing value. Add `annotation-gradient` (`b`, default `false`) and `tool-widths` (`a{si}`, default `{}`). Keys in the dictionary are the existing drawing tool ids: `arrow`, `rectangle`, `circle`, `marker`, `highlighter`, `pixelate` and `text`. Keep `default-width` as the fallback for a tool lacking an explicit size.

An empty dictionary provides migration without copying all defaults into overrides. A changed default width affects uncustomised tools on the next capture; explicitly sized tools keep their choices. In `prefs.js`, clarify that colour is remembered from the toolbar and explain that default width applies to tools without a remembered size. Keep the colour preference's existing validation and change watcher.

Alternatives: Separate remembered-colour storage would introduce unclear precedence with the existing colour preference. One key per tool is strongly typed but repeats seven schema and adapter paths. JSON string storage needs unnecessary parsing and versioning. Session-only memory cannot survive disabling the extension or logging out.

### 2. Resolve size targets in the core, independently of presentation

Extend `Editor` to accept a copied, normalised tool-width dictionary while retaining constructor defaults. Keep shared colour/gradient in the creation style. Resolve a size edit to the selected annotation's type when one exists, otherwise to the active drawing tool. `null` and `select` without a selected annotation have no size target.

On `setTool()`, clear selection as today and resolve the tool's remembered width or fallback. In idle or empty Select and move, display the configured fallback and disable both width buttons. Ignore width edits without a target at the core boundary as well. With a selected annotation, display its existing width/colour; selecting it does not copy those values into creation preferences. Explicit size changes update its type's memory and the selected annotation; explicit colour/gradient changes update shared preferences and retain the existing selected-annotation editing rules. Gradient remains global even for unsupported tools.

Store overrides only after an explicit size adjustment, including a valid choice equal to the default if the control actually changes an annotation or effective size. A button click clamped at 1 or 30 that makes no effective change is a no-op. Tool switching and preference restoration create no history entries or persistence calls. Undo/redo restore annotation snapshots only, so a marker reverted from 5 px to 3 px does not reset future markers to 3 px.

Alternative: Put size memory in `Toolbar` or learn it on every refresh. That would couple hotkey behaviour to presentation and could accidentally learn styles from selected annotations or history replay.

### 3. Persist explicit preference patches through the existing session boundary

Add a small optional core notification for explicit preference changes, carrying only the edited shared fields and/or target tool/width. `CaptureSession` supplies it when creating an editor and forwards it to an injected settings writer. `extension.js` performs GSettings reads/writes, directly or through a small injected adapter if needed for tests; no GNOME imports enter core or application code.

Write accepted edits immediately, without timers or a save-on-export path. For dictionary updates, merge the single edited tool into the current stored dictionary rather than writing all editor defaults or unrelated snapshot fields. This avoids overwriting an unrelated external preference change. No writes occur during initialisation, tool selection, pointer motion, toolbar refresh or undo/redo. The existing generation/disposed guard rejects callbacks from closed or superseded captures. Closing invalidates callbacks before destroying the view; there is no deferred preference job to flush.

Alternative: Save the entire editor style on close. That loses the target tool, may overwrite unrelated preference edits and makes teardown a persistence responsibility.

### 4. Validate stored values and isolate storage failures

Normalise stored colour as six-digit hex, width as an integer in 1–30, gradient as a boolean, and dictionary entries against known drawing ids. Use the configured width if valid, otherwise 3; use Red for an invalid colour and `false` for invalid/missing gradient. Retain valid dictionary entries when another entry is invalid. Keep this normalisation GNOME-independent so it can be tested with plain values.

Treat a rejected settings setter or thrown storage error as a preference failure, separate from capture failure. The edit remains in the current editor. Report a concise preference-specific error through the view/notification boundary, deduplicated per session to avoid repeated alerts, without closing the overlay or rolling back annotation history. Next capture reads the last successfully stored values. Writes are field-specific; no multi-field atomic transaction is promised.

### 5. Keep input, rendering and export paths stable

Existing button/shortcut restrictions, text editing and export busy handling continue to apply. Use the core's size-target state to control both width buttons; do not infer it separately from toolbar widgets. Colour swatches and gradient remain usable without a drawing tool. Selecting an annotation still shows that annotation's colour/width, while gradient shows the global toggle as today.

Persist logical width values, never resource-scale or screenshot-scale values. Existing renderers continue to derive stroke width, marker diameter, text font and pixelation blocks from each annotation's width. Preferences add no rendering work to motion events, no CPU pixel readbacks and no new export decorations. PNG, JPG and clipboard continue to use the existing GPU path and selection clipping.

## Risks / Trade-offs

- [Users may expect default width to override every tool] → Explain its fallback role in preferences and documentation; retain independent overrides. A reset interface is outside this change.
- [Selecting an old annotation might overwrite current preferences] → Emit persistence only from explicit style edits and test selection, movement and history separately.
- [Storage can reject writes] → Keep edits usable, report the failure once per session and test with a rejecting writer.
- [Old callbacks could touch settings after disable] → Check generation/disposed state before invoking the writer; exercise close, destroy and reopen in session tests.
- [Node tests cannot establish Shell appearance or backend durability] → Validate in GNOME Shell 50 / Wayland and record unavailable checks as pending.

## Migration Plan

Ship additive schema keys with the existing id/path. Existing colour and default width values remain authoritative initial values; no migration flag or eager write is needed. Update the gradient session scenarios and qualify the default-width feature scenario for tools without overrides. Add explicit per-tool and cross-session cases to `docs/mirx.feature`, explain memory in `README.md`, and record graphical checks in `tests/MANUAL.md`.

Validate the schema with `glib-compile-schemas --strict` via the existing checks and package path. Inspect any newly used GSettings/Variant methods in the target environment's GIR/typelibs before implementation depends on them. Do not install or restart the extension as part of this planning change.

Rolling back code makes the older version ignore the new keys and reload `default-width` as before. The last saved colour remains in the existing key; no settings or capture-content migration needs to be undone.
