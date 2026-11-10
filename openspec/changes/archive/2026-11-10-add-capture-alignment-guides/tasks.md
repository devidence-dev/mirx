# Tasks

## 1. Guide geometry and rendering

- [x] 1.1 Create `src/rendering/alignmentGuideGeometry.js` with the two strips, alignment to the magnifier's pixel, physical-grid snapping, and clipping to the monitor. Add `tests/alignment-guide-geometry.test.js` with fractional positions, scales 1/2/4:3, scale precedence, offset origins, and corners; verify with `node --test tests/alignment-guide-geometry.test.js` that bounds, thickness, and alignment are correct.
- [x] 1.2 Create `src/ui/alignmentGuides.js` and GLSL fragments in `src/ui/shaders.js`, following the existing `Shell.GLSLEffect` pattern: two reusable strips, stable-phase dots, a light core and dark outline, without Cairo. Add `tests/alignment-guides.test.js` with mocked actors to check hiding without a monitor, reuse, and geometry updates; verify with `node --test tests/alignment-guides.test.js`. If a new GNOME API is needed, document its signature as verified against the GNOME Shell 50 typelibs before using it.
- [x] 1.3 After visual review, reduce the screen guides' opacity to 0.55 and extend the magnifier crosshair with faint lines from its ticks to the viewport edges, keeping the centre pixel clear and the marks on the physical grid; verify with `node --test tests/magnifier.test.js`.

## 2. Integration with the magnifier and selection

- [x] 2.1 Integrate the guides into `Overlay`, sharing the fractional point, monitor, and visibility condition with the magnifier; place them below controls and the magnifier, without focus or event reception. Add `tests/overlay-guides.test.js` with the state matrix: initial, creation, resizing, completed selection, interior movement, annotation, text, and busy; verify with `node --test tests/overlay-guides.test.js` and preserve the results of `tests/magnifier.test.js`.
- [x] 2.2 Cover monitor transitions, no monitor, cross-monitor dragging with selection limited to the initial monitor, and destruction along with the overlay in `tests/overlay-guides.test.js`. Verify that the monitor and point sent to both aids match and that the guides do not change input received by the editor; run the guide tests and `tests/overlay-motion.test.js`.
- [x] 2.3 Update `docs/mirx.feature`, `README.md`, and the magnifier section of `tests/MANUAL.md` with automatic activation, guides extending to monitor edges, no measurement scale, and checks for contrast, corners, fractional scaling, and two monitors. Verify that documented examples match the spec scenarios and the shared visibility condition.

## 3. Export and recovery

- [x] 3.1 Add the guides container to `Overlay.withExportContent()`. Extend `tests/overlay-export.test.js` to start with visible and hidden guides and check exclusion and exact restoration on both success and error; verify with `node --test tests/overlay-export.test.js tests/gpu-export.test.js` without modifying the export adapter.
- [x] 3.2 Extend `tests/MANUAL.md` to check that guides are absent when copying and saving PNG/JPG and that the editor recovers after a failure. Verify that the protocol checks image content, not just that the guides are hidden during the operation.

## 4. Integrated verification

- [x] 4.1 Run `npm test`, `npm run check`, and `npm run pack`; record the results and confirm the package includes the new component without additional dependencies.
- [x] 4.2 Run the expanded protocol in a GNOME Shell 50/Wayland session: contrast, tracking and alignment with the magnifier at 100%/200%/approximately 133%, edges, selection and resizing, controls, two monitors when available, and exclusion from PNG/JPG/clipboard. Compare smoothness and `mirx-perf` logs in the same environment. Record version, configuration, and results; leave checks pending when the environment is unavailable, rather than treating Node results as approval. Validated by the user in a GNOME Shell 50/Wayland session on 2026-11-10, including the 0.55 opacity and magnifier crosshair adjustments from 1.3; version, scales and monitor setup were not recorded.
