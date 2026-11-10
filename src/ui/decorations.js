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

/** Presentation only: this module is never called by the image output adapter. */
export function drawDecorations(cr, editor, stageWidth, stageHeight) {
    const selection = editor.selection ?? (editor.draft?.type ? null : editor.draft) ?? editor.hover;
    cr.save();
    cr.setSourceRGBA(0, 0, 0, 0.48);
    if (selection) {
        const {x, y, width, height} = selection;
        cr.rectangle(0, 0, stageWidth, y);
        cr.rectangle(0, y + height, stageWidth, stageHeight - y - height);
        cr.rectangle(0, y, x, height);
        cr.rectangle(x + width, y, stageWidth - x - width, height);
    } else {
        cr.rectangle(0, 0, stageWidth, stageHeight);
    }
    cr.fill();
    if (selection) {
        cr.setLineWidth(1);
        cr.setSourceRGB(0.2, 0.65, 1);
        cr.rectangle(selection.x, selection.y, selection.width, selection.height);
        cr.stroke();
        if (editor.selection)
            drawHandles(cr, handles(editor.selection));
    }
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
