import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import St from 'gi://St';

import {annotationBounds, renderAnnotations, textFont} from '../rendering/annotations.js';
import {arrowBars, rectangleGeometry} from '../rendering/actorGeometry.js';

function colorOf(value) {
    let color = (value ?? '#ff0000').replace('#', '');
    if (color.length === 3)
        color = [...color].map(c => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : '#ff0000';
}

function place(actor, rect) {
    actor.set_position(rect.x, rect.y);
    actor.set_size(rect.width, rect.height);
}

function canvasRect(annotation) {
    const bounds = annotationBounds(annotation);
    const padding = annotation.type === 'circle' ? Math.max(1, annotation.width || 3) / 2 + 1 : 0;
    const x = Math.floor(bounds.x - padding), y = Math.floor(bounds.y - padding);
    return {x, y, width: Math.max(1, Math.ceil(bounds.x + bounds.width + padding) - x),
        height: Math.max(1, Math.ceil(bounds.y + bounds.height + padding) - y)};
}

export class AnnotationActors {
    constructor({snapshot, width, height}) {
        this.snapshot = snapshot;
        this.actor = new Clutter.Actor({width, height});
        this._entries = new Map();
        this._order = '';
        this._clip = undefined;
        this._pixelRevision = 0;
    }

    _create(annotation) {
        let actor, bars = null;
        if (annotation.type === 'arrow') {
            actor = new Clutter.Actor();
            bars = [0, 1, 2].map(() => new St.Widget());
            bars.forEach(bar => actor.add_child(bar));
        } else if (annotation.type === 'text') {
            actor = new Clutter.Text({single_line_mode: false});
        } else if (annotation.type === 'circle' || annotation.type === 'pixelate') {
            actor = new St.DrawingArea();
        } else {
            actor = new St.Widget();
        }
        const entry = {actor, bars, type: annotation.type, key: null, hidden: false};
        if (annotation.type === 'circle' || annotation.type === 'pixelate') {
            actor.connect('repaint', area => {
                const cr = area.get_context();
                try {
                    cr.translate(-entry.rect.x, -entry.rect.y);
                    renderAnnotations(cr, [entry.annotation], {scale: this.snapshot.scale,
                        pixbuf: this.snapshot.pixelationPixbuf ?? this.snapshot.pixbuf});
                } finally {
                    cr.$dispose();
                }
            });
        }
        this.actor.add_child(actor);
        return entry;
    }

    _updateEntry(entry, annotation) {
        const {actor} = entry;
        const color = colorOf(annotation.color);
        const width = Math.max(1, annotation.width || 3);
        switch (annotation.type) {
        case 'rectangle':
            place(actor, rectangleGeometry(annotation));
            if (entry.style !== `${width}:${color}`) {
                actor.set_style(`border: ${width}px solid ${color}; border-radius: ${width / 2}px;`);
                entry.style = `${width}:${color}`;
            }
            break;
        case 'highlighter': {
            place(actor, rectangleGeometry(annotation));
            if (entry.style !== color) {
                const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
                actor.set_style(`background-color: rgba(${rgb.join(', ')}, 0.35);`);
                entry.style = color;
            }
            break;
        }
        case 'arrow':
            arrowBars(annotation).forEach((bar, i) => {
                const part = entry.bars[i];
                place(part, bar);
                part.set_pivot_point(bar.pivotX, bar.pivotY);
                part.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, bar.angle);
                if (entry.style !== `${width}:${color}`)
                    part.set_style(`background-color: ${color}; border-radius: ${width / 2}px;`);
            });
            entry.style = `${width}:${color}`;
            break;
        case 'text': {
            actor.set_position(annotation.x1, annotation.y1);
            const text = annotation.text ?? '';
            if (entry.text !== text) {
                actor.set_text(text);
                entry.text = text;
            }
            if (entry.fontWidth !== width) {
                actor.set_font_description(textFont(width));
                entry.fontWidth = width;
            }
            if (entry.color !== color) {
                const [, coglColor] = Cogl.Color.from_string(color);
                actor.set_color(coglColor);
                entry.color = color;
            }
            break;
        }
        case 'circle':
        case 'pixelate':
            entry.annotation = {...annotation};
            entry.rect = canvasRect(annotation);
            place(actor, entry.rect);
            actor.queue_repaint();
            break;
        }
    }

    update(annotations, selection, editingId = null) {
        const clip = JSON.stringify(selection);
        if (clip !== this._clip) {
            this._clip = clip;
            if (selection)
                this.actor.set_clip(selection.x, selection.y, selection.width, selection.height);
            else
                this.actor.set_clip(0, 0, 0, 0);
        }
        const ids = new Set(annotations.map(annotation => annotation.id));
        for (const [id, entry] of this._entries) {
            if (!ids.has(id)) {
                entry.actor.destroy();
                this._entries.delete(id);
            }
        }
        for (const annotation of annotations) {
            let entry = this._entries.get(annotation.id);
            if (!entry) {
                entry = this._create(annotation);
                this._entries.set(annotation.id, entry);
            }
            const key = JSON.stringify([annotation,
                annotation.type === 'pixelate' ? this._pixelRevision : null]);
            if (entry.key !== key) {
                this._updateEntry(entry, annotation);
                entry.key = key;
            }
            const hidden = annotation.type === 'text' && annotation.id === editingId;
            if (hidden !== entry.hidden) {
                entry.hidden = hidden;
                if (hidden)
                    entry.actor.hide();
                else
                    entry.actor.show();
            }
        }
        const order = JSON.stringify(annotations.map(annotation => annotation.id));
        if (order !== this._order) {
            let previous = null;
            for (const annotation of annotations) {
                const actor = this._entries.get(annotation.id).actor;
                this.actor.set_child_above_sibling(actor, previous);
                previous = actor;
            }
            this._order = order;
        }
    }

    invalidatePixels() {
        this._pixelRevision++;
    }

    prepareExport() {
        for (const entry of this._entries.values()) {
            if (entry.type === 'circle' || entry.type === 'pixelate')
                entry.actor.get_allocation_box();
        }
    }
}

