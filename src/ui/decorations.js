import {handles} from '../core/geometry.js';
import {annotationRect} from '../core/editor.js';

export function decorationRect(editor) {
    return editor.selection ?? (editor.draft?.type ? null : editor.draft) ?? editor.hover;
}

/** Presentation only: this module is never called by the image output adapter. */
export class DecorationActors {
    constructor({width, height, createActor}) {
        this.actor = createActor({width, height});
        this._box = createActor({style_class: 'mirx-annotation-box', visible: false});
        this.actor.add_child(this._box);
        this._handles = Array.from({length: 8}, () =>
            createActor({style_class: 'mirx-handle', width: 8, height: 8, visible: false}));
        this._handles.forEach(handle => this.actor.add_child(handle));
    }

    update(editor) {
        const annotation = editor.annotations.find(a => a.id === editor.selectedId);
        const key = JSON.stringify(annotation ?? null);
        if (key === this._key)
            return;
        this._key = key;
        if (!annotation) {
            this._box.hide();
            this._handles.forEach(handle => handle.hide());
            return;
        }
        const bounds = annotationRect(annotation);
        this._box.set_position(bounds.x, bounds.y);
        this._box.set_size(bounds.width, bounds.height);
        this._box.show();
        const points = annotation.type === 'arrow'
            ? [{x: annotation.x1, y: annotation.y1}, {x: annotation.x2, y: annotation.y2}]
            : annotation.type === 'text' ? [] : handles(bounds);
        this._handles.forEach((handle, i) => {
            if (points[i]) {
                handle.set_position(points[i].x - 4, points[i].y - 4);
                handle.show();
            } else {
                handle.hide();
            }
        });
    }
}
