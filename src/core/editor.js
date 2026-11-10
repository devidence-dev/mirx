import {
    contains,
    inside,
    intersect,
    fromPoints,
    clampPoint,
    moveRect,
    resizeRect,
    handleAt,
    markerRadius,
    HANDLE_HIT,
} from './geometry.js';
import { CommandHistory } from './history.js';

const cloneAnnotation = (annotation) => {
    if (typeof structuredClone === 'function') return structuredClone(annotation);
    // Annotations contain only primitive fields, so a spread also works in runtimes without structuredClone.
    return { ...annotation };
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const startOf = (annotation) => ({ x: annotation.x1, y: annotation.y1 });
const endOf = (annotation) => ({ x: annotation.x2, y: annotation.y2 });
const DRAG_THRESHOLD = 5;

export function supportsGradient(type) {
    return ['arrow', 'rectangle', 'circle', 'marker'].includes(type);
}

export function annotationRect(annotation) {
    if (annotation.type === 'marker') {
        const r = markerRadius(annotation.width);
        return { x: annotation.x1 - r, y: annotation.y1 - r, width: 2 * r, height: 2 * r };
    }
    return fromPoints(startOf(annotation), endOf(annotation));
}

// Labels are derived from array order, so delete, undo and redo need no renumbering.
export function markerNumbers(annotations) {
    const numbers = new Map();
    for (const annotation of annotations)
        if (annotation.type === 'marker') numbers.set(annotation.id, numbers.size + 1);
    return numbers;
}

function lineDistance(point, a, b) {
    const dx = b.x - a.x,
        dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

export function annotationHit(annotation, point) {
    const rect = annotationRect(annotation);
    const tolerance = Math.max(5, annotation.width / 2 + 2);
    switch (annotation.type) {
        case 'arrow':
            return lineDistance(point, startOf(annotation), endOf(annotation)) <= tolerance;
        case 'pixelate':
        case 'highlighter':
        case 'text':
            return contains(rect, point);
        case 'rectangle': {
            const outer = {
                x: rect.x - tolerance,
                y: rect.y - tolerance,
                width: rect.width + 2 * tolerance,
                height: rect.height + 2 * tolerance,
            };
            const inner = {
                x: rect.x + tolerance,
                y: rect.y + tolerance,
                width: Math.max(0, rect.width - 2 * tolerance),
                height: Math.max(0, rect.height - 2 * tolerance),
            };
            return (
                contains(outer, point) &&
                (rect.width <= 2 * tolerance || rect.height <= 2 * tolerance || !contains(inner, point))
            );
        }
        case 'circle': {
            const rx = rect.width / 2,
                ry = rect.height / 2;
            if (!rx || !ry) return lineDistance(point, startOf(annotation), endOf(annotation)) <= tolerance;
            const normalized = Math.hypot((point.x - rect.x - rx) / rx, (point.y - rect.y - ry) / ry);
            return Math.abs(normalized - 1) * Math.min(rx, ry) <= tolerance;
        }
        case 'marker':
            return distance(point, startOf(annotation)) <= markerRadius(annotation.width);
        default:
            return false;
    }
}

function estimateText({ text, width }) {
    const lines = text.split('\n');
    const fontSize = Math.max(14, width * 5);
    return {
        width: Math.max(1, ...lines.map((line) => line.length)) * fontSize * 0.6,
        height: lines.length * fontSize * 1.2,
    };
}

function squareEnd(start, point) {
    const size = Math.max(Math.abs(point.x - start.x), Math.abs(point.y - start.y));
    return { x: start.x + (point.x < start.x ? -size : size), y: start.y + (point.y < start.y ? -size : size) };
}

/** Session model. It has no knowledge of GNOME, the clipboard, files or rendering. */
export class Editor {
    constructor({
        monitors,
        windows = [],
        color = '#ff0000',
        width = 3,
        gradient = false,
        measureText = estimateText,
    }) {
        this.monitors = monitors;
        this.windows = windows;
        this.selection = null;
        this.monitor = null;
        this.annotations = [];
        this.selectedId = null;
        this.tool = null;
        this.style = { color, width, gradient };
        this.hover = null;
        this.draft = null;
        this.history = new CommandHistory();
        this.measureText = measureText;
        this._gesture = null;
        this._nextId = 1;
    }

    _snapshot() {
        return this.history.snapshot(this.annotations);
    }

    _commit(before) {
        this.history.commit(before, this.annotations);
    }

    _measure(annotation) {
        const size = this.measureText({ text: annotation.text, width: annotation.width });
        annotation.x2 = annotation.x1 + size.width;
        annotation.y2 = annotation.y1 + size.height;
    }

    _selected() {
        return this.annotations.find((annotation) => annotation.id === this.selectedId);
    }

    _gradientFor(type) {
        return Boolean(this.style.gradient) && supportsGradient(type);
    }

    get interaction() {
        return this._gesture?.kind ?? null;
    }

    get interactionHandle() {
        return this._gesture?.handle ?? null;
    }

    hitTarget(point) {
        if (!this.selection) return { kind: 'none' };
        const selectionHandle = handleAt(this.selection, point);
        if (this.tool === null) return this._hitIdle(point, selectionHandle);
        if (this.tool !== 'select') return this._hitDrawing(point, selectionHandle);
        const selected = this._selected();
        if (selected && !['text', 'marker'].includes(selected.type)) {
            const handle = this._selectedHandleAt(selected, point);
            if (handle) return { kind: 'annotation-handle', handle };
        }
        if (selectionHandle) return { kind: 'selection-handle', handle: selectionHandle };
        const hit = [...this.annotations].reverse().find((annotation) => annotationHit(annotation, point));
        if (hit) return { kind: 'annotation', id: hit.id };
        return { kind: contains(this.selection, point) ? 'selection' : 'outside' };
    }

    // Idle: only the selection handles react; everything else inside the selection is inert.
    _hitIdle(point, selectionHandle) {
        if (selectionHandle) return { kind: 'selection-handle', handle: selectionHandle };
        return { kind: contains(this.selection, point) ? 'inert' : 'outside' };
    }

    _hitDrawing(point, selectionHandle) {
        if (selectionHandle && !inside(this.selection, point))
            return { kind: 'selection-handle', handle: selectionHandle };
        return { kind: contains(this.selection, point) ? 'canvas' : 'outside' };
    }

    _monitorAt(point) {
        // Half-open boundaries assign a shared monitor edge to exactly one monitor.
        return (
            this.monitors.find(
                (monitor) =>
                    point.x >= monitor.x &&
                    point.y >= monitor.y &&
                    point.x < monitor.x + monitor.width &&
                    point.y < monitor.y + monitor.height,
            ) ?? null
        );
    }

    _windowAt(point, monitor) {
        const window = this.windows.find((rect) => contains(rect, point));
        return window && monitor ? intersect(window, monitor) : null;
    }

    _monitorRect(monitor) {
        return monitor && { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height };
    }

    setTool(tool) {
        this.tool = tool;
        this.selectedId = null;
    }

    setStyle(style) {
        const before = this._snapshot();
        Object.assign(this.style, style);
        const selected = this._selected();
        if (selected) {
            const { gradient, ...shared } = style;
            Object.assign(selected, shared);
            // Legacy annotations lack the field; compare as booleans so a no-op toggle records no undo entry.
            if (
                gradient !== undefined &&
                supportsGradient(selected.type) &&
                Boolean(selected.gradient) !== Boolean(gradient)
            )
                selected.gradient = Boolean(gradient);
            if (selected.type === 'text' && style.width !== undefined) this._measure(selected);
        }
        this._commit(before);
    }

    selectMonitor(point) {
        const monitor = this._monitorAt(point);
        if (!monitor) return false;
        this.monitor = monitor;
        this.selection = this._monitorRect(monitor);
        this.selectedId = null;
        return true;
    }

    pointerDown(point, { clickCount = 1 } = {}) {
        if (!this.selection) return this._beginSelect(point);
        if (this.tool === null) return this._pointerDownIdle(point);
        if (this.tool === 'select') return this._pointerDownSelect(point, clickCount);
        return this._pointerDownWithTool(point);
    }

    _beginSelect(point) {
        const monitor = this._monitorAt(point);
        if (monitor) {
            this.monitor = monitor;
            this._gesture = { kind: 'select', start: point, monitor, window: this._windowAt(point, monitor) };
        }
        return null;
    }

    _newAnnotationAt(type, point) {
        return {
            id: this._nextId++,
            type,
            ...this.style,
            gradient: this._gradientFor(type),
            x1: point.x,
            y1: point.y,
            x2: point.x,
            y2: point.y,
        };
    }

    _pointerDownWithTool(point) {
        const handle = handleAt(this.selection, point);
        if (handle && !inside(this.selection, point)) {
            this._gesture = { kind: 'selection-resize', handle, start: point, original: { ...this.selection } };
            return null;
        }
        if (!contains(this.selection, point)) return null;
        if (this.tool === 'text') return { newText: { ...point } };
        if (this.tool === 'marker') {
            const before = this._snapshot();
            this.annotations.push(this._newAnnotationAt('marker', point));
            this._commit(before);
            return null;
        }
        this.draft = this._newAnnotationAt(this.tool, point);
        this._gesture = { kind: 'draw', start: point, before: this._snapshot() };
        return null;
    }

    _selectedHandleAt(selected, point) {
        if (selected.type !== 'arrow') return handleAt(annotationRect(selected), point);
        if (distance(point, startOf(selected)) <= HANDLE_HIT) return 'start';
        return distance(point, endOf(selected)) <= HANDLE_HIT ? 'end' : null;
    }

    // Idle (no tool): only the eight selection handles act; nothing else is selectable or movable.
    _pointerDownIdle(point) {
        const handle = handleAt(this.selection, point);
        if (handle) this._gesture = { kind: 'selection-resize', handle, start: point, original: { ...this.selection } };
        return null;
    }

    // The Select and move tool: select, move and resize annotations, move and resize the selection.
    _pointerDownSelect(point, clickCount) {
        const selected = this._selected();
        if (selected && !['text', 'marker'].includes(selected.type)) {
            const handle = this._selectedHandleAt(selected, point);
            if (handle) {
                this._gesture = {
                    kind: 'annotation-resize',
                    handle,
                    start: point,
                    original: cloneAnnotation(selected),
                    before: this._snapshot(),
                };
                return null;
            }
        }
        const selectionHandle = handleAt(this.selection, point);
        if (selectionHandle) {
            this.selectedId = null;
            this._gesture = {
                kind: 'selection-resize',
                handle: selectionHandle,
                start: point,
                original: { ...this.selection },
            };
            return null;
        }
        const hit = [...this.annotations].reverse().find((annotation) => annotationHit(annotation, point));
        if (hit) {
            this.selectedId = hit.id;
            if (hit.type === 'text' && clickCount >= 2) return { editText: hit.id };
            this._gesture = {
                kind: 'annotation-move',
                start: point,
                original: cloneAnnotation(hit),
                before: this._snapshot(),
            };
            return null;
        }
        this.selectedId = null;
        if (contains(this.selection, point))
            this._gesture = { kind: 'selection-move', start: point, original: { ...this.selection } };
        return null;
    }

    pointerMove(point, { shift = false } = {}) {
        const gesture = this._gesture;
        if (!gesture) {
            if (!this.selection) {
                const monitor = this._monitorAt(point);
                // With no window under the pointer, a click selects the monitor, so the hover shows it.
                this.hover = this._windowAt(point, monitor) ?? this._monitorRect(monitor);
            }
            return;
        }
        switch (gesture.kind) {
            case 'select':
                this.draft =
                    distance(point, gesture.start) >= DRAG_THRESHOLD
                        ? fromPoints(gesture.start, clampPoint(point, gesture.monitor))
                        : null;
                break;
            case 'draw': {
                const end = shift && this.draft.type === 'circle' ? squareEnd(gesture.start, point) : point;
                this.draft.x2 = end.x;
                this.draft.y2 = end.y;
                break;
            }
            case 'selection-move':
                this.selection = moveRect(
                    gesture.original,
                    point.x - gesture.start.x,
                    point.y - gesture.start.y,
                    this.monitor,
                );
                break;
            case 'selection-resize':
                this.selection = this._resizeSelection(gesture.original, gesture.handle, point);
                break;
            default:
                this._transformAnnotation(gesture, point);
        }
    }

    _transformAnnotation(gesture, point) {
        const annotation = this._selected();
        if (!annotation) return;
        if (gesture.kind === 'annotation-move') {
            const dx = point.x - gesture.start.x,
                dy = point.y - gesture.start.y;
            annotation.x1 = gesture.original.x1 + dx;
            annotation.x2 = gesture.original.x2 + dx;
            annotation.y1 = gesture.original.y1 + dy;
            annotation.y2 = gesture.original.y2 + dy;
        } else if (['start', 'end'].includes(gesture.handle)) {
            const end = gesture.handle === 'start' ? 1 : 2;
            annotation[`x${end}`] = point.x;
            annotation[`y${end}`] = point.y;
        } else {
            const rect = resizeRect(annotationRect(gesture.original), gesture.handle, point);
            annotation.x1 = rect.x;
            annotation.y1 = rect.y;
            annotation.x2 = rect.x + rect.width;
            annotation.y2 = rect.y + rect.height;
        }
    }

    pointerUp(point, options = {}) {
        const gesture = this._gesture;
        if (!gesture) return null;
        this.pointerMove(point, options);
        if (gesture.kind === 'select') {
            this.selection =
                distance(point, gesture.start) < DRAG_THRESHOLD
                    ? (gesture.window ?? this._monitorRect(gesture.monitor))
                    : fromPoints(gesture.start, clampPoint(point, gesture.monitor));
            if (this.selection && (!this.selection.width || !this.selection.height)) this.selection = null;
            this.draft = null;
            this.hover = null;
        } else if (gesture.kind === 'draw') {
            if (distance(gesture.start, point) > 0) {
                this.annotations.push(this.draft);
                this._commit(gesture.before);
            }
            this.draft = null;
        } else if (gesture.before) {
            this._commit(gesture.before);
        }
        this._gesture = null;
        return null;
    }

    _resizeSelection(rect, handle, point) {
        const p = clampPoint(point, this.monitor);
        if (handle.includes('w') && p.x === rect.x + rect.width) p.x -= 1;
        if (handle.includes('e') && p.x === rect.x) p.x += 1;
        if (handle.includes('n') && p.y === rect.y + rect.height) p.y -= 1;
        if (handle.includes('s') && p.y === rect.y) p.y += 1;
        return resizeRect(rect, handle, p, this.monitor);
    }

    addText(point, text) {
        if (!text || !this.selection || !contains(this.selection, point)) return null;
        const before = this._snapshot();
        const annotation = {
            id: this._nextId++,
            type: 'text',
            ...this.style,
            gradient: this._gradientFor('text'),
            x1: point.x,
            y1: point.y,
            x2: point.x,
            y2: point.y,
            text,
        };
        this._measure(annotation);
        this.annotations.push(annotation);
        this._commit(before);
        return annotation.id;
    }

    updateText(id, text) {
        const annotation = this.annotations.find((a) => a.id === id && a.type === 'text');
        if (!annotation) return false;
        const before = this._snapshot();
        annotation.text = text;
        this._measure(annotation);
        this._commit(before);
        return true;
    }

    nudge(dx, dy, resize = false) {
        if (!this.selection || !this.monitor || this.selectedId !== null) return;
        this.selection = resize
            ? this._resizeSelection(this.selection, 'se', {
                  x: this.selection.x + this.selection.width + dx,
                  y: this.selection.y + this.selection.height + dy,
              })
            : moveRect(this.selection, dx, dy, this.monitor);
    }

    undo() {
        const annotations = this.history.undo();
        if (!annotations) return false;
        this.annotations = annotations;
        if (!this._selected()) this.selectedId = null;
        return true;
    }

    redo() {
        const annotations = this.history.redo();
        if (!annotations) return false;
        this.annotations = annotations;
        if (!this._selected()) this.selectedId = null;
        return true;
    }

    deleteSelected() {
        if (!this._selected()) return false;
        const before = this._snapshot();
        this.annotations = this.annotations.filter((annotation) => annotation.id !== this.selectedId);
        this.selectedId = null;
        this._commit(before);
        return true;
    }

    escape() {
        if (this.selectedId !== null) {
            this.selectedId = null;
            return 'handled';
        }
        return 'close';
    }
}
