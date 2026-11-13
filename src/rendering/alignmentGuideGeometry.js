/** Logical stage units; strips are local to the monitor origin. No GNOME imports. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const CROSS_UNITS = 21; // maximum logical span of the core, including its centre pixel

// Same precedence as the magnifier.
export function guideScale(monitor, textureScale) {
    return monitor.scale ?? monitor.scaleFactor ?? textureScale;
}

/**
 * Two full-length strips (1 px core plus a 1 px outline on each side) centred on the source pixel
 * the magnifier centres, snapped to the monitor's physical grid and clipped to the monitor.
 * Sizes are logical; core is in physical pixels across the strip.
 */
export function alignmentGuideGeometry(point, monitor, textureScale) {
    const scale = guideScale(monitor, textureScale);
    const length = { x: monitor.width * scale, y: monitor.height * scale };
    const axis = (key) => {
        const centre = (Math.floor(point[key] * textureScale) + 0.5) / textureScale;
        const core = clamp(
            Math.round((centre - monitor[key]) * scale - 0.5),
            0,
            Math.max(0, Math.ceil(length[key]) - 1),
        );
        const start = Math.max(0, core - 1),
            end = Math.min(length[key], core + 2);
        return { start: start / scale, size: Math.max(0, end - start) / scale, core: core - start, index: core };
    };
    const x = axis('x'),
        y = axis('y');
    // Odd physical square centred on the core pixel centre (index + 0.5); not clipped, the container clips it.
    const outer = Math.max(0, Math.floor((CROSS_UNITS * scale - 1) / 2));
    const half = outer + 1; // one physical pixel of contrast outline
    const cross = {
        x: (x.index - half) / scale,
        y: (y.index - half) / scale,
        size: (2 * half + 1) / scale,
        half,
        outer,
    };
    return {
        scale,
        vertical: { x: x.start, y: 0, width: x.size, height: monitor.height, core: x.core },
        horizontal: { x: 0, y: y.start, width: monitor.width, height: y.size, core: y.core },
        cross,
    };
}
