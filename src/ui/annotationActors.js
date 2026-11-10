import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {textFont} from '../rendering/annotations.js';
import {arrowBars, effectTextureUniforms, ellipseUniforms, pixelateGeometry, pixelateUniforms, rectangleGeometry} from '../rendering/actorGeometry.js';
import {ELLIPSE_CODE, ELLIPSE_DECLARATIONS, PIXELATE_CODE, PIXELATE_DECLARATIONS} from './shaders.js';

export function setUniforms(effect, values) {
    effect.locations ??= new Map();
    for (const [name, value] of Object.entries(values)) {
        if (!effect.locations.has(name))
            effect.locations.set(name, effect.get_uniform_location(name));
        // GIR array-length metadata hides total_count from the GJS signature.
        effect.set_uniform_float(effect.locations.get(name), value.length, value);
    }
}

export function textureUniforms(effect) {
    const actor = effect.get_actor();
    const texture = effect.get_texture();
    return effectTextureUniforms(actor,
        [texture.get_width(), texture.get_height()], actor.get_resource_scale());
}

const EllipseEffect = GObject.registerClass(class MirxEllipseEffect extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, ELLIPSE_DECLARATIONS, ELLIPSE_CODE, true);
    }

    vfunc_paint_target(node, paintContext) {
        const scale = this.get_actor().get_resource_scale();
        setUniforms(this, {...textureUniforms(this),
            ...ellipseUniforms(this.annotation, scale, this.physicalScale), ringColor: this.color});
        super.vfunc_paint_target(node, paintContext);
    }
});

const PixelateEffect = GObject.registerClass(class MirxPixelateEffect extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.TEXTURE_LOOKUP, PIXELATE_DECLARATIONS, PIXELATE_CODE, true);
    }

    vfunc_paint_target(node, paintContext) {
        setUniforms(this, {...textureUniforms(this),
            ...pixelateUniforms(this.geometry, this.get_actor().get_resource_scale())});
        super.vfunc_paint_target(node, paintContext);
    }
});

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

export class AnnotationActors {
    constructor({snapshot, width, height}) {
        this.snapshot = snapshot;
        this._stage = {width, height};
        this.actor = new Clutter.Actor({width, height});
        this._entries = new Map();
        this._order = '';
        this._clip = undefined;
    }

    _create(annotation) {
        let actor, bars = null, image = null, effect = null;
        if (annotation.type === 'arrow') {
            actor = new Clutter.Actor();
            bars = [0, 1, 2].map(() => new St.Widget());
            bars.forEach(bar => actor.add_child(bar));
        } else if (annotation.type === 'text') {
            actor = new Clutter.Text({single_line_mode: false});
        } else if (annotation.type === 'circle') {
            const [, background] = Cogl.Color.from_string('#ffffff');
            actor = new Clutter.Actor({background_color: background});
            effect = new EllipseEffect();
        } else if (annotation.type === 'pixelate') {
            actor = new Clutter.Actor({clip_to_allocation: true});
            image = new Clutter.Actor({content: this.snapshot.content, ...this._stage});
            image.set_content_scaling_filters(Clutter.ScalingFilter.NEAREST, Clutter.ScalingFilter.NEAREST);
            actor.add_child(image);
            effect = new PixelateEffect();
        } else {
            actor = new St.Widget();
        }
        const entry = {actor, bars, image, effect, type: annotation.type, key: null, hidden: false};
        if (effect)
            actor.add_effect(effect);
        this.actor.add_child(actor);
        return entry;
    }

    _updateEntry(entry, annotation, selection) {
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
            place(actor, rectangleGeometry(annotation));
            entry.empty = annotation.x1 === annotation.x2 || annotation.y1 === annotation.y2;
            entry.effect.annotation = {...annotation};
            entry.effect.physicalScale = this._physicalScale;
            entry.effect.color = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
            actor.queue_redraw();
            break;
        case 'pixelate': {
            const geometry = pixelateGeometry(annotation, selection, this._stage);
            place(actor, geometry.rect);
            entry.empty = geometry.rect.width === 0 || geometry.rect.height === 0;
            entry.image.set_position(-geometry.rect.x, -geometry.rect.y);
            entry.effect.geometry = geometry;
            actor.queue_redraw();
            break;
        }
        }
    }

    update(annotations, selection, editingId = null) {
        const monitor = this.snapshot.monitors?.find(m => selection && selection.x >= m.x && selection.y >= m.y &&
            selection.x < m.x + m.width && selection.y < m.y + m.height);
        this._physicalScale = monitor?.scale ?? monitor?.scaleFactor ?? this.snapshot.scale ?? 1;
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
                annotation.type === 'pixelate' ? selection : null,
                annotation.type === 'circle' ? this._physicalScale : null]);
            if (entry.key !== key) {
                this._updateEntry(entry, annotation, selection);
                entry.key = key;
            }
            const hidden = Boolean(entry.empty || annotation.type === 'text' && annotation.id === editingId);
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

    prepareExport() {
        for (const entry of this._entries.values()) {
            if (entry.type === 'circle' || entry.type === 'pixelate')
                entry.actor.get_allocation_box();
        }
    }
}

