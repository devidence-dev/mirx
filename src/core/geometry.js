/** All geometry is expressed in desktop logical pixels. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function contains(rect, point) {
    return point.x >= rect.x && point.y >= rect.y && point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
}

// Unlike contains, excludes the rectangle edges.
export function inside(rect, point) {
    return point.x > rect.x && point.y > rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

export function intersect(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

export function fromPoints(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

export function clampPoint(point, bounds) {
    return {
        x: clamp(point.x, bounds.x, bounds.x + bounds.width),
        y: clamp(point.y, bounds.y, bounds.y + bounds.height),
    };
}

export function moveRect(rect, dx, dy, bounds) {
    return {
        ...rect,
        x: clamp(rect.x + dx, bounds.x, bounds.x + Math.max(0, bounds.width - rect.width)),
        y: clamp(rect.y + dy, bounds.y, bounds.y + Math.max(0, bounds.height - rect.height)),
    };
}

export function resizeRect(rect, handle, point, bounds) {
    const p = bounds ? clampPoint(point, bounds) : point;
    let left = rect.x,
        right = rect.x + rect.width;
    let top = rect.y,
        bottom = rect.y + rect.height;
    if (handle.includes('w')) left = p.x;
    if (handle.includes('e')) right = p.x;
    if (handle.includes('n')) top = p.y;
    if (handle.includes('s')) bottom = p.y;
    return fromPoints({ x: left, y: top }, { x: right, y: bottom });
}

export function handles({ x, y, width: w, height: h }) {
    return [
        { id: 'nw', x, y },
        { id: 'n', x: x + w / 2, y },
        { id: 'ne', x: x + w, y },
        { id: 'e', x: x + w, y: y + h / 2 },
        { id: 'se', x: x + w, y: y + h },
        { id: 's', x: x + w / 2, y: y + h },
        { id: 'sw', x, y: y + h },
        { id: 'w', x, y: y + h / 2 },
    ];
}

export function handleAt(rect, point, tolerance = 7) {
    return (
        handles(rect)
            .filter((handle) => Math.abs(handle.x - point.x) <= tolerance && Math.abs(handle.y - point.y) <= tolerance)
            .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0]
            ?.id ?? null
    );
}

// Numbered marker radius in logical pixels; the minimum keeps one-digit numbers readable.
export function markerRadius(width) {
    return Math.max(10, 4 * width);
}

// Integer physical-pixel rectangle of a logical selection. The single source of truth
// for export size and position in every engine and for the dimensions label.
export function physicalRect(selection, scale) {
    const x = Math.round(selection.x * scale),
        y = Math.round(selection.y * scale);
    return {
        x,
        y,
        width: Math.round((selection.x + selection.width) * scale) - x,
        height: Math.round((selection.y + selection.height) * scale) - y,
    };
}

// Integer logical rectangle covering `physical` whose origin lies exactly on the physical grid,
// so the stage can be painted 1:1 without resampling. offsetX/offsetY locate `physical` inside
// the painted texture. Null when the scale has no small grid-aligned logical period.
export function alignedPaintRect(physical, scale) {
    let q = 1;
    while (q <= 16 && Math.abs(q * scale - Math.round(q * scale)) >= 1e-4) q++;
    if (q > 16) return null;
    const lx0 = Math.floor(physical.x / scale / q) * q;
    const ly0 = Math.floor(physical.y / scale / q) * q;
    const lx1 = Math.ceil((physical.x + physical.width) / scale / q) * q;
    const ly1 = Math.ceil((physical.y + physical.height) / scale / q) * q;
    const rect = { x: lx0, y: ly0, width: lx1 - lx0, height: ly1 - ly0 };
    const offsetX = physical.x - Math.round(lx0 * scale),
        offsetY = physical.y - Math.round(ly0 * scale);
    if (
        offsetX < 0 ||
        offsetY < 0 ||
        offsetX + physical.width > Math.round(rect.width * scale) ||
        offsetY + physical.height > Math.round(rect.height * scale)
    )
        return null;
    return { rect, offsetX, offsetY };
}
