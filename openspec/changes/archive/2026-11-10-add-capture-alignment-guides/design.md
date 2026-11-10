# Design

## Context

The motivation and scope are in `proposal.md`; the observable contract is in `specs/capture-alignment-guides/spec.md`.

- `src/ui/magnifier.js` magnifies the frozen texture, centers the pixel calculated with `snapshot.scale`, and aligns the crosshair marks to the monitor's physical pixel grid. The magnifier is offset from the cursor: its visual center is not the origin of the screen guides.
- `Overlay._refresh()` has the fractional position in `_pointer`, the monitor under the cursor, and the condition that controls the magnifier. `_selectionDrag` distinguishes creating and resizing a selection from moving it.
- `Overlay.withExportContent()` hides decorations and restores their visibility exactly in `finally`. GPU export paints the scene, so a new actor must explicitly participate in that exclusion.
- `src/ui/annotationActors.js` already uses `Shell.GLSLEffect` and shader constants in `src/ui/shaders.js`. `docs/gpu-renderer.feature` requires preserving GPU rendering without introducing Cairo or a full-screen canvas.
- `docs/mirx.feature` contains the reference behavior; there are no published capabilities in `openspec/specs/`. Its exclusions for a line-drawing tool and cursor capture do not prevent temporary alignment decorations, which are never exported.

## Goals / Non-Goals

**Goals:**

- Add an independent decoration that reuses the overlay's coordination, visibility, and lifecycle.
- Keep the number of actors constant and limit the effects' processed area to two narrow strips.
- Separate geometry that can be tested with Node from GNOME graphics adapters.

**Non-Goals:**

- Change selection, history, input coordinates, or magnifier sampling.
- Add a second visibility policy, preferences, or a new export path.

## Decisions

### 1. Independent component and two reusable GPU strips

Create `src/ui/alignmentGuides.js` with a non-reactive container and two narrow actors, horizontal and vertical, updated by `update(point, monitor, visible)`. An effect based on the existing `Shell.GLSLEffect` pattern produces the dotted line with transparent fragments between dashes. GLSL constants live in `src/ui/shaders.js`.

The initial pattern uses dashes of approximately 4 logical units and 4-unit gaps, with a one-physical-pixel white core and a one-pixel dark outline on each side. The phase is anchored to the monitor origin so the pattern does not slide as the cursor moves parallel to a guide. Physical dash and gap dimensions are rounded to at least one pixel. These are internal values that can be adjusted during visual review. After the first review the guides are drawn at 0.55 opacity, and the magnifier's crosshair gains faint extensions from its ticks to the viewport edges so it continues the screen guides without covering the centre pixel.

The shader reuses the resource-scale and texture-size handling of the current effects. Actors are created once; each movement updates position and, only when needed, dimensions and parameters. Avoiding one actor per segment and a full-screen effect reduces allocations, traversals, and unnecessary processing. A Cairo canvas conflicts with the current renderer; relying on dotted CSS borders would add a dependency on a style not yet verified in St.

### 2. One shared point and condition with the magnifier

Calculate the existing visibility condition and the `_pointer ?? _point` value once in `_refresh()`, and pass them to both components. Place the guides above the background, shadows, and annotations, but below handles, labels, the toolbar, and the magnifier. The container and its children do not receive focus or intercept events.

A completed selection hides both aids; moving within it does not activate them. If a drag crosses to another monitor, the guides follow the monitor under the cursor, like the current magnifier; the model continues to limit the selection to the initial monitor. Do not change this behavior to introduce tracking of the clipped edge.

Rejected alternative: placing the guides inside `Magnifier.actor`. Its clipping, local scale, and offset from the cursor would prevent them from extending correctly across the monitor and would complicate export.

### 3. Pure geometry in stage coordinates and physical scale

Create `src/rendering/alignmentGuideGeometry.js` to derive the two strips and pattern parameters from the fractional point, monitor, and frozen texture scale. Use the same source pixel as the magnifier's center, calculated with `snapshot.scale`, and align the representation to the nearest physical pixel on the monitor. Obtain the monitor scale using the same precedence as the magnifier: `scale`, `scaleFactor`, then capture scale.

Align relative to the monitor origin, not the stage origin. When the texture and monitor scales differ, limit visual displacement to rounding to the nearest physical pixel. Clip the strips to the monitor rectangle, including their outlines, at edges and corners. The container is positioned over the monitor; children use local positions.

Tests with fractional positions, scales of 1, 2, and approximately 4/3, different origins, and corners will verify alignment, bounds, and the absence of negative dimensions. Do not use the model's integer coordinates as a substitute for the fractional point, because that would lose HiDPI precision.

### 4. Exclude and restore using the existing export mechanism

Add the guides container to the set of actors in `withExportContent()`. Preserve the prior-visibility mechanism and `finally` on both success and error, without changes to `GpuImageOutput`.

The guides are descendants of the overlay, so `Overlay.destroy()` destroys them too. They need no global signals, timers, or persistent state. Tests must force an export with visible guides: normally being hidden by the busy state does not prove that exclusion works.

## Risks / Trade-offs

- [GPU effects may vary by scale and driver] → Reuse APIs already present and visually validate in GNOME Shell 50/Wayland; check any new graphics API against the typelibs before adding it.
- [Misalignment or blur at fractional scaling] → Separate texture scale, monitor scale, and resource scale; verify the physical grid with tests and contrast captures in a real session.
- [Two high-contrast guides may be distracting] → Keep them narrow and dotted, and show them only during operations that already use the magnifier; review spacing with the user during implementation testing.
- [Guides appear on the cursor's monitor while the selection remains limited to the initial monitor] → Preserve and document the magnifier's current policy, with a specific two-monitor scenario.
- [Node tests do not validate shaders or perceived smoothness] → Cover actor coordination with mocks and separately record pending graphics checks; compare movement using the existing `mirx-perf` log in the same environment.

## Migration Plan

There is no data or preference to migrate. Implement the component, integrate it, expand the checks, and update the functional documentation. Run `npm test`, `npm run check`, and `npm run pack`; visual review requires loading the extension in a real GNOME session. Reverting the change removes only the new decoration and its integration, without affecting saved captures.
