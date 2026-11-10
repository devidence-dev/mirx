# Proposal

## Why

Before a selection exists, clicking where there is no window (the desktop background or the GNOME top bar) selects nothing. The full monitor is reachable only with Ctrl+A, which needs the keyboard. A plain click on an empty spot is a natural way to ask for the whole monitor.

## What Changes

- A click (press and release with less than 5 px of movement) where no window is under the pointer selects the whole monitor under the pointer. "No window" includes the desktop background and the top bar, which is shell chrome and not a window.
- While hovering before any selection exists, a spot with no window highlights the whole monitor under the pointer. A spot over a window still highlights that window.
- No change for clicking a window, dragging a free selection, Ctrl+A, or the single-monitor selection boundaries.
- The `docs/mirx.feature` scenario "With no window under the cursor, nothing is highlighted" is revised, because it states the opposite of the new behavior.

## Capabilities

### New Capabilities
- `capture-selection`: how the capture area is chosen before it is adjusted: window, free area or full monitor, including the hover highlight.

### Modified Capabilities
<!-- None: no existing capability covers selection. -->

## Impact

- Code: `src/core/editor.js` (click and hover resolution only). The overlay already draws any hover rectangle, so no UI code changes.
- Tests and docs: `tests/core.test.js`, `docs/mirx.feature`, `README.md`, `tests/MANUAL.md`.
- Out of scope: Ctrl+A, drag behavior, selection adjustment, window detection in `src/platform/capture.js`, the overlay hint text, new settings, and multi-monitor selections spanning several monitors.
