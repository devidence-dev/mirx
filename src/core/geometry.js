/** All geometry is expressed in desktop logical pixels. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function contains(rect, point) {
    return point.x >= rect.x && point.y >= rect.y &&
        point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
}

export function intersect(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return right > x && bottom > y ? {x, y, width: right - x, height: bottom - y} : null;
}

export function fromPoints(a, b) {
    return {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y)};
}

export function clampPoint(point, bounds) {
    return {x: clamp(point.x, bounds.x, bounds.x + bounds.width),
        y: clamp(point.y, bounds.y, bounds.y + bounds.height)};
}

export function moveRect(rect, dx, dy, bounds) {
    return {...rect,
        x: clamp(rect.x + dx, bounds.x, bounds.x + Math.max(0, bounds.width - rect.width)),
        y: clamp(rect.y + dy, bounds.y, bounds.y + Math.max(0, bounds.height - rect.height))};
}

export function resizeRect(rect, handle, point, bounds) {
    const p = bounds ? clampPoint(point, bounds) : point;
    let left = rect.x, right = rect.x + rect.width;
    let top = rect.y, bottom = rect.y + rect.height;
    if (handle.includes('w')) left = p.x;
    if (handle.includes('e')) right = p.x;
    if (handle.includes('n')) top = p.y;
    if (handle.includes('s')) bottom = p.y;
    return fromPoints({x: left, y: top}, {x: right, y: bottom});
}

export function handles({x, y, width: w, height: h}) {
    return [
        {id: 'nw', x, y}, {id: 'n', x: x + w / 2, y}, {id: 'ne', x: x + w, y},
        {id: 'e', x: x + w, y: y + h / 2}, {id: 'se', x: x + w, y: y + h},
        {id: 's', x: x + w / 2, y: y + h}, {id: 'sw', x, y: y + h},
        {id: 'w', x, y: y + h / 2},
    ];
}

export function handleAt(rect, point, tolerance = 7) {
    return handles(rect)
        .filter(handle => Math.abs(handle.x - point.x) <= tolerance && Math.abs(handle.y - point.y) <= tolerance)
        .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0]?.id ?? null;
}
