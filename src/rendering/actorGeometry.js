/** Geometry is in logical stage pixels. */
export function rectangleGeometry(a) {
    const width = Math.max(1, a.width || 3);
    const x = Math.min(a.x1, a.x2), y = Math.min(a.y1, a.y2);
    const w = Math.abs(a.x2 - a.x1), h = Math.abs(a.y2 - a.y1);
    if (a.type === 'highlighter')
        return {x, y, width: w, height: h};
    return {x: x - width / 2, y: y - width / 2,
        width: w + width, height: h + width};
}

export function arrowBars(a) {
    const width = Math.max(1, a.width || 3);
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const head = Math.max(12, width * 4);
    const bar = (x1, y1, x2, y2) => {
        const length = Math.hypot(x2 - x1, y2 - y1);
        const total = length + width;
        return {x: x1 - width / 2, y: y1 - width / 2,
            width: total, height: width, pivotX: width / (2 * total), pivotY: 0.5,
            angle: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI};
    };
    return [bar(a.x1, a.y1, a.x2, a.y2),
        ...[-1, 1].map(sign => bar(a.x2, a.y2,
            a.x2 - head * Math.cos(angle + sign * Math.PI / 6),
            a.y2 - head * Math.sin(angle + sign * Math.PI / 6)))];
}

export function pixelateGeometry(a, selection, stage) {
    const x = Math.min(a.x1, a.x2), y = Math.min(a.y1, a.y2);
    const left = Math.max(x, selection?.x ?? 0, 0);
    const top = Math.max(y, selection?.y ?? 0, 0);
    const right = Math.min(Math.max(a.x1, a.x2),
        selection ? selection.x + selection.width : 0, stage.width);
    const bottom = Math.min(Math.max(a.y1, a.y2),
        selection ? selection.y + selection.height : 0, stage.height);
    return {rect: {x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top)},
        anchor: [left - x, top - y], block: Math.max(8, (a.width || 3) * 4)};
}

// GNOME 50.1 enlarges the local paint volume before allocating the offscreen
// texture (clutter-actor-box.c:474). Recover its origin from the actual texture,
// not width * screenshot scale: Actor.get_resource_scale() is rounded up.
export function effectTextureUniforms(rect, textureSize, resourceScale) {
    return {textureSize,
        contentOffset: [textureSize[0] - Math.ceil(rect.width + 0.75) * resourceScale,
            textureSize[1] - Math.ceil(rect.height + 0.75) * resourceScale],
        extent: [rect.width * resourceScale, rect.height * resourceScale]};
}

export function ellipseUniforms(a, resourceScale, physicalScale) {
    return {radii: [Math.abs(a.x2 - a.x1) * resourceScale / 2,
        Math.abs(a.y2 - a.y1) * resourceScale / 2],
        stroke: [Math.max(1, a.width || 3) * resourceScale],
        antialias: [resourceScale / physicalScale]};
}

export function pixelateUniforms(geometry, resourceScale) {
    return {anchor: geometry.anchor.map(value => value * resourceScale),
        block: [geometry.block * resourceScale]};
}
