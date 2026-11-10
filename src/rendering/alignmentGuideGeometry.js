/** Logical stage units; strips are local to the monitor origin. No GNOME imports. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const DASH_UNITS = 4;

// Same precedence as the magnifier.
export function guideScale(monitor, textureScale) {
    return monitor.scale ?? monitor.scaleFactor ?? textureScale;
}

/**
 * Two full-length strips (1 px core plus a 1 px outline on each side) centred on the source pixel
 * the magnifier centres, snapped to the monitor's physical grid and clipped to the monitor.
 * Sizes are logical; core, dash and period are physical pixels along the strip's own axes.
 * Both strips start at the monitor origin, so the dash phase is anchored there.
 */
export function alignmentGuideGeometry(point, monitor, textureScale) {
    const scale = guideScale(monitor, textureScale);
    const length = {x: monitor.width * scale, y: monitor.height * scale};
    const axis = key => {
        const centre = (Math.floor(point[key] * textureScale) + 0.5) / textureScale;
        const core = clamp(Math.round((centre - monitor[key]) * scale - 0.5), 0, Math.max(0, Math.ceil(length[key]) - 1));
        const start = Math.max(0, core - 1), end = Math.min(length[key], core + 2);
        return {start: start / scale, size: Math.max(0, end - start) / scale, core: core - start};
    };
    const x = axis('x'), y = axis('y');
    const dash = Math.max(1, Math.round(DASH_UNITS * scale));
    return {scale, dash, period: 2 * dash,
        vertical: {x: x.start, y: 0, width: x.size, height: monitor.height, core: x.core},
        horizontal: {x: 0, y: y.start, width: monitor.width, height: y.size, core: y.core}};
}
