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
