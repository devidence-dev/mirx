# Tasks

## 1. Editor logic

- [x] 1.1 In `src/core/editor.js`, add a monitor-rect helper used by `selectMonitor()`, and make `pointerMove` hover and the `pointerUp` click fall back to it when no window is found. Extend `tests/core.test.js`: click on blank desktop and on a top-bar-like spot (a point covered by no window) selects the monitor, a click on a window still selects the window, a drag from empty space is a free selection clamped to the start monitor, a click on the second monitor selects only that monitor, hover is the monitor over empty space and the window over a window, hover is `null` after a selection, and the old "blank click selects nothing" assertion is replaced. Verify with `node --test tests/core.test.js`.
- [x] 1.2 Confirm `src/core` still has no GNOME imports and that `src/platform/capture.js` excludes the top bar from `windows` (it only lists `Meta` windows and drops `DESKTOP` and `DOCK`). Verify with `grep -rn "gi://\|resource://" src/core` returning nothing, and `npm run check`.
- [x] 1.3 Check that the overlay needs no change: `decorationRect` returns `editor.hover`, and `_updateDecorations` clamps zero-size shade bands. Extend `tests/decorations.test.js` only if no test covers a hover rectangle equal to a monitor; verify with `node --test tests/decorations.test.js`.

## 2. Documentation

- [x] 2.1 Update `docs/mirx.feature`: revise "With no window under the cursor, nothing is highlighted" (it contradicts the change) and add scenarios under "A free area or the full monitor can be selected" for the click on empty desktop, on the top bar, the two-monitor case and a drag from empty space, keeping the existing scenarios. Verify that each scenario matches `specs/capture-selection/spec.md`.
- [x] 2.2 Update `README.md` (click on empty space selects the monitor under the pointer) and `tests/MANUAL.md` (checks for hover and click on the desktop and top bar, one and two monitors, marked pending). Verify by reading both against the spec.

## 3. Integration

- [x] 3.1 Run `npm test`, `npm run check` and `npm run pack`, then `openspec validate select-monitor-on-empty-click --strict`. Verify that all four pass.
- [x] 3.2 **Requires a real GNOME Shell 50/Wayland session (user):** hover and click the empty desktop and the top bar on one and two monitors (also with different scales) and confirm the monitor highlight, the selection, the shades, and the dimensions label; confirm a window still highlights and selects as before and that a drag is limited to its monitor. Record the results and leave the check pending if the session is unavailable. Validated by the user on 2026-11-10 in GNOME Shell 50.1 on Wayland, single 2560×1600 monitor at 100%, 200% and 133%: screen checks by the user and phone photos, saved PNG/JPG and clipboard images measured over SSH, save failure, magnifier and coordinate flips at the edges, and the shortcut after a scale change. Not checked: two monitors (only one available) and a side-by-side `mirx-perf` comparison (logs show motion 0.15–0.5 ms and export 40–670 ms).
