# Design

## Context

See proposal.md for motivation. `src/core/editor.js` resolves both the hover and the click, and `selectMonitor()` already builds a monitor-sized selection:

- `pointerMove` (no gesture, no selection) sets `this.hover = this._windowAt(point, this._monitorAt(point))`, which is `null` when no window is there.
- `pointerDown` stores `gesture.window = this._windowAt(point, monitor)`. `pointerUp` then uses `distance(point, gesture.start) < DRAG_THRESHOLD ? gesture.window : fromPoints(...)`, so a click on empty space yields `null`.
- The top bar is not a window. `src/platform/capture.js` builds `windows` from `workspace.list_windows()`, which holds only `Meta.Window`s (the panel is a Shell actor), and also drops `DESKTOP` and `DOCK` types. So "no window" already covers the desktop and the top bar, and no platform change is needed.
- The overlay draws `decorationRect(editor)`, which is `selection ?? draft ?? hover`. The shades, the frame and the dimensions label only read that rectangle (or the selection), so any rectangle works as a hover.

## Goals / Non-Goals

**Goals:** resolve click and hover through one rule: window, else monitor.

**Non-Goals:** changing window detection, drag, Ctrl+A, the hint text or the platform adapter.

## Decisions

- **Fallback in the editor.** Add a private `_monitorRect(monitor)` returning `{x, y, width, height}` of a monitor. Click becomes `gesture.window ?? this._monitorRect(gesture.monitor)`, hover becomes `window ?? monitor rect` (the monitor from `_monitorAt`, `null` outside every monitor). `selectMonitor()` reuses the helper. Alternative: put the fallback inside `_windowAt`; rejected because the name would no longer say what it returns, and `gesture.window` is read elsewhere only as "the window".
- **Equal rectangles on purpose.** The monitor rect is the same one Ctrl+A produces, so selection boundaries and physical-pixel alignment are unchanged. The result is a fresh object each call, so a hover never aliases `editor.monitors`.
- **No UI change.** Hover reuses `decorationRect`. A full-monitor hover gives zero-size shade bands on three sides, which `_updateDecorations` already clamps with `Math.max(0, ...)`, as for a Ctrl+A selection. The frame is a 1 px inner border. The dimensions label and hint only depend on `selection`, so they are untouched.
- **Click after hover.** `pointerDown` already records the window at press time, so the click selects what the pointer pressed on.

## Risks / Trade-offs

- An accidental click on empty space now selects a monitor instead of nothing. Esc and an adjusted selection remain available.
- The overlay hint says "Click: window"; it stays accurate for windows and is left unchanged to keep the diff small.
- Hover and guides share the pointer position; both already redraw on motion, so no extra rendering cost beyond one small object per move.
- Node tests do not prove the rendering; the real-session check is tracked separately in tasks.md.
