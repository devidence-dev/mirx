import {handles} from '../core/geometry.js';
import {annotationRect} from '../core/editor.js';

function drawHandles(cr, points) {
    for (const {x, y} of points) {
        cr.rectangle(x - 4, y - 4, 8, 8);
        cr.setSourceRGB(1, 1, 1);
        cr.fillPreserve();
        cr.setSourceRGB(0.1, 0.45, 1);
        cr.stroke();
    }
}

export function decorationRect(editor) {
    return editor.selection ?? (editor.draft?.type ? null : editor.draft) ?? editor.hover;
}

/** Presentation only: this module is never called by the image output adapter. */
export function drawDecorations(cr, editor) {
    cr.save();
    cr.setLineWidth(1);
    const annotation = editor.annotations.find(a => a.id === editor.selectedId);
    if (annotation) {
        const bounds = annotationRect(annotation);
        cr.setSourceRGBA(1, 1, 1, 0.8);
        cr.setDash([3, 3], 0);
        cr.rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
        cr.stroke();
        cr.setDash([], 0);
        if (annotation.type === 'arrow')
            drawHandles(cr, [{x: annotation.x1, y: annotation.y1}, {x: annotation.x2, y: annotation.y2}]);
        else if (annotation.type !== 'text')
            drawHandles(cr, handles(bounds));
    }
    cr.restore();
}
