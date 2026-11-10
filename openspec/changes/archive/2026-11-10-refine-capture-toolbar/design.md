# Design

## Context

See proposal.md for motivation. The behaviour is in `specs/capture-toolbar`, `specs/capture-pointer-feedback` and the `extension-packaging` delta.

Current state, from the code:

- `src/ui/toolbar.js` builds a vertical `St.BoxLayout` with three rows, text-glyph `St.Button`s and a `_toolLabel` that `update()` overwrites. It already has `Shell.BlurEffect` (mode BACKGROUND, radius 30, brightness 0.75). `place()` positions it below the selection, flips it above, clamps it to the monitor and only ever shrinks it.
- Style is `stylesheet.css:1-44`. The frame is `1px` blue, handles are 8 × 8 squares placed at `x-4, y-4` in `overlay.js` and `decorations.js` (shared class `mirx-handle`).
- The only cursor call is in `Overlay._refresh()`: TEXT for the text tool, CROSSHAIR for any tool or no selection, DEFAULT otherwise.
- Keys go through `_key` → `_textKey` or `_runShortcut` → `_runCtrlShortcut`. `_runShortcut` returns false for unknown keys so focus navigation can run.
- `handleAt` uses tolerance 7 (a 15 px box). `Editor._selectedHandleAt` uses a 7 px radius for arrow endpoints. There is no public "what is under the pointer" query.
- Export hides a fixed list of actors in `Overlay.withExportContent`.
- Constraints from the project: `src/core` stays GNOME-free; GPU rendering is kept; the toolbar is never exported; real-session checks stay "pending" until the user runs them.

## Goals / Non-Goals

**Goals:**

- A larger, grouped, glass-styled two-row toolbar with icons, tooltips, tool hotkeys and one suggested action.
- A cursor that always matches what a press would do, testable in Node.
- A thicker frame, rounder handles and a 16 px grab area.
- Subtle silhouette shadows on annotations, shared by the preview and exported image.

**Non-Goals:**

- Resizing from a whole edge, a toolbar preferences page, width hotkeys, more tools.
- A real backdrop filter (St has none) or changes to the export adapter.
- Tracking the text scale factor for icon sizes (icons stay 18 logical px).

## Decisions

### 1. Capability split

- `capture-toolbar` is new: everything about the toolbar widget.
- The frame, handles and cursors go into a new `capture-pointer-feedback`, not into `capture-selection`.

Why: `capture-selection` is about choosing the area before it is adjusted (click, drag, hover highlight). Cursors and handles also cover adjusting and annotating, after the choice, so adding them there would stretch its Purpose into "everything on the canvas". The new capability has one idea, "the pointer and the frame tell the user what a press will do", and it can own later affordances such as edge resizing.

Alternative: ADDED requirements under `capture-selection`. This keeps the capability count down but mixes two lifecycles.

Alternative: MODIFIED on `panel-indicator`. Not needed, since nothing in it changes.

`extension-packaging` is MODIFIED twice, each as a full copy of its block:

- "The installable zip contains only runtime files". Its icon scenarios assumed one icon.
- "The README shows the colour logo". Its "Notes file is gone" scenario lists the `icons/` content, which gains `tools/`.

### 2. Layout and sizes

The toolbar stays one vertical `St.BoxLayout` of two row `BoxLayout`s. Each row is a list of group `BoxLayout`s, and a `mirx-divider` widget sits between groups. Both rows are centred in the card.

| Token | Value |
|---|---|
| Card radius | 16 px |
| Card padding | 12 px |
| Row spacing | 8 px |
| Spacing inside a group | 4 px |
| Gap between groups | 12 px (divider margin 5 px before, 6 px after, 1 px line) |
| Divider height | 20 px, centred vertically |
| Icon button | 36 × 36, radius 10 |
| Icon | 18 px |
| Swatch | 28 × 28 circle, 2 px ring, radius 14 |
| Width value | text, 44 px minimum width, centred |
| Copy / Save | 36 × 36 icon buttons like the others (revised from text buttons) |

The row-2 width is about 590 px (220 swatches + 124 width + 36 gradient + 172 actions + three 12 px gaps with their 1 px dividers + 24 padding). Row 1 is about 405 px and is centred.

The tool order and names live in one GNOME-free module, `src/ui/toolbarModel.js`: the tool id, name, key, icon file and tooltip hint. The toolbar, the overlay hotkeys and the pack script read it. Node tests import it, because it has no `gi://` imports.

The divider is drawn as a CSS border (`border-left: 1px`), not as a 1 px widget width or a background, because St snaps border widths to whole physical pixels. This still needs a check at 133%.

`COLORS` stays a literal array in `toolbar.js` in the form `['#rrggbb', 'Name']`, because `tests/actor-geometry.test.js` parses it.

### 3. Icons

Alternatives:

- (a) Theme icons only. Adwaita lacks arrow, rectangle, ellipse, pixelate and move/pan. Mixing sources gives different weights and different looks per theme.
- (b) Custom set only.
- (c) Mixed.

Decision: custom set for everything that has an icon, 14 files under `icons/tools/`:

`select-move`, `arrow`, `rectangle`, `ellipse`, `marker`, `highlighter`, `pixelate`, `text`, `gradient`, `undo`, `redo`, `minus`, `plus`, `close`.

All are named `<name>-symbolic.svg`. Rules:

- 16 × 16 grid, filled paths only, no stroke, no gradient, no `fill="none"`. St recolours only fill-based symbolic SVGs, and the test mirrors `tests/icons.test.js`.
- 2 px outlines, drawn as filled outline paths. The user said 1.5 px looked thin on `mirx-symbolic.svg`.
- `select-move` is four arrow heads on a cross (the move-arrows icon).
- `marker` is a ring with a cut-out "1" via `fill-rule="evenodd"`. `pixelate` is a 3 × 3 checker of squares. `gradient` is a circle whose half is cut out.
- Copy and Save use the theme icons `edit-copy-symbolic` and `document-save-symbolic` (`St.Icon({ icon_name, icon_size: 18 })`), not bundled files; Yaru and Adwaita both ship them. The HIG allows icon-only buttons when a tooltip names them. The earlier text-only choice is revised after user review. The primary accent fill stays the same 36 px square as the other buttons, wide enough for the icon.

The toolbar loads each icon with `St.Icon({ gicon: Gio.icon_new_for_string(`${iconDir}/${name}-symbolic.svg`), icon_size: 18 })` and `-st-icon-style: symbolic`. This is the approach that already works for the panel icon (`panelIndicator.js`). `iconDir` is `${this.path}/icons/tools`, passed from `extension.js` through the overlay options, so the toolbar stays testable with a stub directory.

Packaging: `scripts/pack.js` copies `icons/tools` (all files) next to the existing icon and fails, naming the file, if any icon named by `toolbarModel` is missing. `tests/package.test.js`'s expected list adds the `icons/tools/*` entries.

SVG drafts are not part of this plan. They are drawn in the implementation task and checked by the no-stroke test and by eye on the device.

### 4. Tooltip component

Shell's `Tooltip` is not exported to extensions, so mirx replicates it in `src/ui/tooltip.js`.

- One `St.Label` (`mirx-tooltip`), a child of the **overlay actor**, placed directly above the toolbar in z-order and below the magnifier. It is not a child of the toolbar, because the toolbar carries `BlurEffect` and a shrink transform, which would blur and clip it.
- API: `attach(widget, text, side)` and `destroy()`. `attach` connects `notify::hover` and `key-focus-in`/`key-focus-out` on the widget. It also connects `button-press-event` and `destroy` to hide it.
- On hover: `GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, show)` with the callback returning `GLib.SOURCE_REMOVE`. The source id is stored. The label is positioned from `widget.get_transformed_extents()`, which already includes the toolbar shrink, centred on the widget with an 8 px gap, then clamped to the monitor. Row-1 widgets open above and row-2 widgets open below, so a tooltip never covers the buttons of the other row. If a side does not fit, it flips.
- Show: `label.ease({ opacity: 255, duration: 150 })`. Hide: ease to 0 over 100 ms, then `hide()` in `onComplete`.
- `hideNow()` cancels the pending source with `GLib.Source.remove`, removes transitions and hides at once. The overlay calls it when the toolbar hides, on a key press, on `setBusy(true)`, and from `withExportContent` (the label is in its hidden list).
- `destroy()` removes the source, disconnects every signal it made and destroys the label. The overlay calls it from `destroy()` before `actor.destroy()`.
- Text comes from `tooltipText(name, shortcut, hint)` in `toolbarModel.js`: `Name (Shortcut)`, `Name` when no shortcut, and ` · hint` appended when there is a hint (only the ellipse has one: `Ellipse (E) · Shift for a circle`). The suggested action appends `, Enter`: `Copy (Ctrl+C, Enter)`.
- CSS copies Shell's `.screenshot-ui-tooltip`: `rgba(0,0,0,0.9)` background, 1 px `rgba(255,255,255,0.1)` border, white text, 999 px radius, `6px 12px` padding.

Alternatives:

- Reusing `St.Widget`'s built-in `tooltip-text`. It does not exist in St.
- Shell's `Tooltip` class. Not importable and tied to the screenshot UI.
- A tooltip inside the toolbar actor. Rejected for the blur and clipping reasons above.

### 5. Hotkeys

`_key` already computes `ctrl` and `shift`. It gains an `alt` flag (Alt, Super or Meta mask). `_runShortcut` gets one more branch, after Delete, Enter and the arrow keys, so those keep priority:

```
if (!ctrl && !alt && selection && !textEdit && !dragging && !busy)
    tool = toolForKey(char of keyval)   // case-insensitive
```

- The keysym → character step is `String.fromCodePoint(Clutter.keysym_to_unicode(symbol))`, as declared in the supplied GNOME Shell 50 `Clutter-18.gir`. The mapping itself, `toolForKey(char)`, is pure.
- `_key` already returns early for `_busy`, for `_dragging`, and for `_textEdit` (which goes to `_textKey`), so the gate is mostly structural. The explicit selection check is the one new condition.
- The action is the same call as the toolbar button: `change(() => editor.setTool(tool))`. `change` also finishes any text edit, which cannot be active here, and refreshes.
- Clash audit: the only letter-bearing existing keys are Ctrl+C/S/A/Z, which carry Ctrl and are consumed first in `_runCtrlShortcut`. Delete, Enter, Escape and the arrows are not letters. `toolbarModel` holds the reserved combinations; tests distinguish their modifiers, including A from Ctrl+A.
- Limit: with a non-Latin active layout the keysym is not a Latin letter, so the keys do nothing. Ctrl+C has the same limit today. Not addressed here.

### 6. Primary action

`Toolbar` gets a `primaryAction: () => 'copy' | 'save'` callback. `Overlay` passes `() => this.enterAction()`. `update()` reads it and toggles the `mirx-primary` style class on Copy or Save, so a settings change shows on the next refresh. `update()` runs on every refresh, so the cost is two class toggles.

Swatch shape: a circle needs an exact square. The CSS `width`/`height` of an `St.Button` are content sizes that border and padding add to, and a button in a horizontal `BoxLayout` is stretched to the row height by default, which gave the rounded rectangle seen on the device. So `Toolbar` sets the actor `width` and `height` to `28 * scale_factor`, centres the swatch on both axes, gives it no label, child or padding, and the CSS keeps `border-radius: 14px` (half of 28). The swatch no longer takes the `mirx-icon-button` class. The `mirx-label-button` class is removed.

No tool highlighted at start: the editor starts with `tool === null`, which is idle (decision 12), and the Toolbar keeps no highlight state. A button is checked when `editor.tool === tool.id`, so nothing is checked when the capture opens, and the select button (id `'select'`) is checked after a click or V.

### 7. Cursor resolver

The existing code sets one cursor on the overlay root once per `_refresh()`. That stays the design: **one resolver on the root, no per-child cursors**, because child-over-parent precedence is unverified.

Two pure pieces make it testable in Node:

1. `Editor.hitTarget(point)` in `src/core/editor.js`. It mirrors `pointerDown`'s priorities and returns one of:
   - `{ kind: 'none' }` (no selection);
   - `{ kind: 'selection-handle', handle }`;
   - `{ kind: 'annotation-handle', handle }`;
   - `{ kind: 'annotation', id }`;
   - `{ kind: 'selection' }` (inside, nothing else under the pointer; Select and move only);
   - `{ kind: 'inert' }` (inside the selection while idle: a press does nothing);
   - `{ kind: 'canvas' }` (inside the selection with a tool active);
   - `{ kind: 'outside' }`.

   With a tool active only handle-outside-interior, canvas and outside can occur, as in `_pointerDownWithTool`. With the Select and move tool the order is annotation handle, selection handle, annotation, selection interior, outside, as in `_pointerDownSelect`. While idle only a selection handle, `inert` and `outside` occur, as in `_pointerDownIdle`; `cursorFor` maps `inert` to the default arrow. A consistency test runs `pointerDown` on a copy of the editor for sample points and checks the gesture matches `hitTarget`.
2. `cursorFor({ target, tool, interaction, interactionHandle, control, editingText })` in `src/ui/cursorModel.js`, returning an abstract name (`'pointer'`, `'move'`, `'crosshair'`, `'text'`, `'default'`, `'ns-resize'`, ...). The precedence:
   1. a gesture in progress wins, using `interaction` and a new `Editor.interactionHandle` getter;
   2. toolbar button or swatch → pointer, toolbar background → default, text editor → text;
   3. `hitTarget` mapping;
   4. no selection → crosshair.

The overlay keeps the Clutter mapping (`name → Clutter.CursorType`) in a small table. Motion events record `_control` (`'button' | 'toolbar' | 'text' | null`) from `global.stage.get_event_actor(event)`, the same source `_isControl` already uses. A button counts when the actor or one of its ancestors up to the toolbar is a reactive `St.Button` that is not insensitive.

Cursor choice per handle id: `n`,`s` → `NS_RESIZE`; `e`,`w` → `EW_RESIZE`; `nw`,`se` → `NWSE_RESIZE`; `ne`,`sw` → `NESW_RESIZE`; arrow `start`/`end` → `MOVE`. The directional `N_RESIZE`-style values are the fallback if the user's cursor theme lacks the bidirectional names.

Cost: one pure function call per refresh; `hitTarget` is O(annotations), the same as `pointerDown`.

Behaviour change: with a tool active and the pointer outside the selection, the cursor was CROSSHAIR and becomes DEFAULT, because a press there does nothing.

On-device check: the root cursor must also show over toolbar children. If it does not, the same resolved cursor is also set on `toolbar.actor`. This is a one-line fallback.

Alternatives:

- Set a cursor on each child (toolbar, handles). Needs precedence rules that are unverified, and many call sites.
- Compute the cursor inside `Overlay` without `hitTarget`. Not testable in Node, and it duplicates the hit rules.
- A fuller "pointer state machine" in the editor. Over-built for this.

### 8. Frame, handles and the 16 px hit area

- Frame: `border: 2px solid rgb(51,166,255)`, plus an outer dark ring drawn by a separate `St.Widget` (`.mirx-frame-ring`, `border: 1px solid rgba(0,0,0,0.45)`) one pixel larger on each side and placed below the frame. Revision after the real-session review: the first build used `box-shadow: 0 0 0 1px` on the frame, but St renders a box-shadow as a filled copy of the box, which darkened the whole selection interior on screen (exports were unaffected because the frame is hidden during export), so the planned fallback became the implementation. The frame widget stays at the selection rectangle with the border drawn inside it, so a full-monitor selection still shows its frame and the pixels at the very edge stay visible. Spread in `box-shadow` is not on the verified list; if it does not render, the fallback is a second `St.Widget` one pixel larger with a 1 px dark border, placed below the frame.
- Handles: `width/height 10`, `border-radius: 5px`, white fill, `border: 2px solid rgb(10,132,255)`, `box-shadow: 0 1px 3px rgba(0,0,0,0.5)` (single shadow). Positioned at `x-5, y-5` in `overlay.js` and in `decorations.js`, so the shared class gives annotation handles the same look.
- Hit area: a `HANDLE_HIT = 8` constant in `geometry.js` becomes the default of `handleAt` and replaces the 7 in `_selectedHandleAt`. The pointer box becomes 16 px half-extent 8 (17 integer points, at least the 16 px asked for). The cursor and the press share it because both go through `hitTarget` / `pointerDown`.

Alternatives for the frame: keep 1 px (rejected, the original complaint); a white 2 px border like GNOME's screenshot UI (user prefers blue); frame outside the selection (hides at monitor edges).

### 9. Glass styling

St has no `backdrop-filter`, multiple shadows or text-shadow (not verified), so the look is built from what works:

| Token | Value |
|---|---|
| Card gradient (vertical, two-stop) | start `rgba(58,62,74,0.62)`, end `rgba(22,24,32,0.62)` |
| Card border | `1px solid rgba(255,255,255,0.18)` |
| Card shadow | `0 12px 32px rgba(0,0,0,0.45)` (single) |
| Divider | `rgba(255,255,255,0.18)` |
| Button | bg `rgba(255,255,255,0.10)`, hover `0.18`, pressed `0.26`, inset top highlight `inset 0 1px 0 rgba(255,255,255,0.12)` |
| Checked | bg `rgba(10,132,255,0.55)`, border `rgba(255,255,255,0.35)` |
| Suggested | bg `rgb(0,102,214)`, hover `rgb(20,120,235)`, pressed `rgb(0,84,184)`, white text, weight 600 (5.4:1 with white text) |
| Disabled | icon opacity 0.4 |
| Focus ring | `box-shadow: inset 0 0 0 2px #ffffff`, distinct from hover |
| Icon colour | `#ffffff` |
| Transition | `transition-duration: 120ms` on buttons |
| Tooltip | see decision 4 |

A gradient replaces the tint colour in St, so the tint lives in the two gradient stops.

Blur: keep `Shell.BlurEffect`, set `mode: Shell.BlurMode.BACKGROUND` explicitly (already so), and set `radius = 30 * St.ThemeContext.get_for_stage(global.stage).scale_factor`, as the lock screen does. Brightness stays 0.75. Cost: one offscreen pass per frame while the toolbar is visible; it is kept to the toolbar actor only and not on the tooltip or the magnifier.

Contrast, by calculation: over a pure white capture with the blur (white × 0.75 behind a 0.62 tint) the lightest part of the card is about rgb(109,111,119). White icons reach about 4.09:1 on a normal button, 3.50:1 on hover and 3.01:1 when pressed, including the translucent button background. The solid fallback uses a stronger tint without blur.

Fallback: a `mirx-toolbar-solid` style class on the card, gradient `rgba(46,50,62,0.90)` → `rgba(24,26,34,0.92)`. A single constant in `toolbar.js`, `GLASS_BLUR = true`, decides whether the blur effect and the glass class or the solid class are used. It is flipped by hand after the on-device check, not by a preference or runtime detection, which would be speculative.

Rounded corners: the blur is a rectangle and ignores `border-radius` (existing `shortcut:` comment in `toolbar.js`). At 16 px radius the square corners may show. Order of mitigation, decided on the device:

1. accept if invisible;
2. reduce the radius to 12;
3. a rounded-corner clip shader after the blur (the repo already has GLSL tooling);
4. switch to the solid fallback.

### 10. Scaling

All sizes are logical px in CSS, so St multiplies them by the monitor scale (100%, 133%, 200%). The text scale factor changes Pango resolution, so labels and `font-size` grow, and the width value grows with it. Icons stay 18 logical px. `place()` keeps its uniform shrink to the monitor, which also covers the larger toolbar on small screens. The blur radius uses `scale_factor` as above.

### 11. Export and lifecycle

`withExportContent` already hides the toolbar. The tooltip label is added to its list, and the tooltip is also hidden at once when an export begins. `overlay-guides.test.js` (z-order) and `overlay-export.test.js` get the new actor. `Overlay.destroy()` calls `tooltip.destroy()`; the `Toolbar` gets a `destroy()` that disconnects its own signals, because its buttons and `BlurEffect` die with `actor.destroy()` but the tooltip's timer does not.

### 12. Idle vs Select and move

The editor has three tool states: `null` (idle), `'select'` (Select and move, the first entry of `TOOLS`, key V) and the drawing tools. `setTool` is unchanged and clears the annotation selection on every change.

| Input | Idle (`null`) | Select | Drawing tool |
| --- | --- | --- | --- |
| No selection yet: click, drag | window, monitor or area choice | same | same |
| Press on a selection handle | resizes the selection | same | same, outside the interior only |
| Drag inside the selection | nothing | moves the selection | draws |
| Click or drag an annotation | nothing | selects, moves | draws |
| Annotation handles | none | resize | none |
| Double-click text | nothing | edits the text | new draw or text |
| Arrow-key nudge | works | works | works |
| Ctrl+A, undo, redo, Enter, Escape | unchanged | unchanged | unchanged |
| Delete | nothing (nothing selected) | deletes the selected annotation | nothing |
| `setStyle` | style only | style and the selected annotation | style only |
| Cursor inside / over annotation | default arrow | move cross | crosshair or text |
| Cursor on a selection handle | resize cursor | resize cursor | resize cursor (outside interior) |

Rules: only Select and move may select, move or resize annotations or move the selection; the arrow-key nudge stays in every state because it is keyboard-only and cannot be mistaken for a pointer gesture; the magnifier and guides show in the same states as before (no selection, or a selection drag or resize).

Rationale: an idle editor that moves the selection on any stray drag is easy to trigger by accident, and the toolbar showed nothing checked while the editor was in "select and move". Making the state explicit lets the toolbar highlight exactly `editor.tool`, and keeps the cursor equal to what a press does (arrow when nothing happens, move cross when it moves).

Rejected: a cursor-only change (arrow while idle, behaviour unchanged). It breaks the rule that the cursor matches the press, because a drag would still move the selection under an arrow. A toolbar-only flag (`_selectChosen`) was also rejected: it hid the real state from the editor and tests.

### 13. Subtle annotation shadows

The requested depth is a fixed black shadow at about 45% opacity (actor opacity 115), offset 1 logical px right and 2 logical px down, with a 3 logical px blur. Revision after the real-session review: the first build used 25% and a 2 px blur; measured on an exported PNG over a dark background (luminance 30), it darkened pixels by only 2 to 6 levels, which was not perceptible. It applies to arrows, rectangle and ellipse outlines, markers, text, highlighters and pixelation. The source alpha controls the shadow, so hollow outlines remain hollow and translucent highlights retain their transparency. The existing number shadow stays unchanged; marker depth follows only the disc.

Use one non-reactive padded actor immediately below each annotation, holding a `Clutter.Clone` of its drawing actor (the disc for markers), blackened with `Clutter.ColorizeEffect` and blurred in `Shell.BlurMode.ACTOR`. Give the clone the source's dimensions with no stretch, and leave transparent padding around it: Shell 50's blur uses the actor allocation and does not enlarge it for a halo. This adds two bounded GPU passes and a clone per annotation, cached by the existing annotation update keys; no CPU pixels, new shaders or model state are needed. Text uses its preferred size. Match blur and offset to display scale and snap positions to physical pixels.

The shadow shares selection clipping, stacking order, hidden/editing state and destruction with its annotation. Drafts use the same renderer. Export retains shadows as annotation content; handles and toolbar remain excluded. Hit testing, undo records, annotation bounds and selection geometry are unchanged. Removing an annotation or closing the overlay removes its clone and effects. Unchanged refreshes must make no extra actor writes.

The supplied `.gir/Clutter-18.gir` declares Clone/source at line 5140 and ColorizeEffect/tint at line 5772; `.gir/Shell-18.gir:472` declares blur radius and ACTOR mode. The target [Shell 50.1 blur source](https://github.com/GNOME/gnome-shell/blob/50.1/src/shell-blur-effect.c) establishes the allocation limit. A rectangle CSS box shadow was rejected because it fills the hollow interior; CPU silhouette rendering was rejected by the GPU constraint. Real-session checks must verify cloned shader content, halo padding, text, transparency, stacking, movement and export at 100%, about 133% and 200%.

## Risks / Trade-offs

- [Blur may not sample the frozen screenshot actor] → The first on-device check decides it; the solid fallback is one constant and equally legible.
- [Blur rectangle behind a 16 px rounded card shows corners] → The mitigation order in decision 9.
- [`box-shadow` spread or a 2 px border may render differently under fractional scales] → Check at 100/133/200%; the second-widget fallback in decision 8.
- [Bidirectional resize cursor names may be missing in some cursor themes] → Fall back to the directional values; one table.
- [Root cursor may not show over toolbar children] → Also set it on the toolbar actor.
- [Larger toolbar covers more of the capture] → It already flips above/below and shrinks to the monitor; the selection stays editable.
- [Tool hotkeys do nothing in non-Latin layouts] → Documented; same limit as Ctrl+C.
- [Frame inside the selection covers 2 px of preview content] → Preview only; export is unaffected.
- [Row 2 is much wider than row 1, so a centred row 1 may look uneven] → Judge on the device; the alternative is left-aligning both.

## Migration Plan

No data or settings migration. Rollback is reverting the change. New shipped files are the toolbar SVGs and focused UI modules; annotation exports also include the requested shadow.

## Open Questions

- Should the whole selection edge, not only the eight handles, be a resize target? The default here is no (out of scope). Saying yes would add requirements to `capture-pointer-feedback` and change `pointerDown`, so it deserves its own change.
