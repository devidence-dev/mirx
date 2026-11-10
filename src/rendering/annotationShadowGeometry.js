// Keep the source phase intact while snapping the offset and padded wrapper to the physical grid.
export function annotationShadowGeometry(rect, scale, resourceScale = Math.ceil(scale)) {
    const snap = (value) => Math.round(value * scale) / scale;
    const x = rect.x + snap(1);
    const y = rect.y + snap(2);
    const padding = 6;
    const left = Math.floor((x - padding) * scale) / scale;
    const top = Math.floor((y - padding) * scale) / scale;
    const right = Math.ceil((x + rect.width + padding) * scale) / scale;
    const bottom = Math.ceil((y + rect.height + padding) * scale) / scale;
    return {
        wrapper: { x: left, y: top, width: right - left, height: bottom - top },
        clone: { x: x - left, y: y - top, width: rect.width, height: rect.height },
        radius: 3 * resourceScale,
    };
}
