import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import { markerNumbers } from '../core/editor.js';
import { markerRadius } from '../core/geometry.js';
import { textFont } from '../rendering/annotations.js';
import {
    arrowBars,
    arrowBounds,
    contrastColor,
    effectTextureUniforms,
    ellipseUniforms,
    gradientShades,
    gradientUniforms,
    markerDisc,
    markerLabel,
    pixelateGeometry,
    pixelateUniforms,
    rectangleGeometry,
} from '../rendering/actorGeometry.js';
import {
    ELLIPSE_CODE,
    ELLIPSE_DECLARATIONS,
    GRADIENT_RECOLOR_CODE,
    GRADIENT_RECOLOR_DECLARATIONS,
    PIXELATE_CODE,
    PIXELATE_DECLARATIONS,
} from './shaders.js';

export function setUniforms(effect, values) {
    effect.locations ??= new Map();
    for (const [name, value] of Object.entries(values)) {
        if (!effect.locations.has(name)) effect.locations.set(name, effect.get_uniform_location(name));
        // GIR array-length metadata hides total_count from the GJS signature.
        effect.set_uniform_float(effect.locations.get(name), value.length, value);
    }
}

export function textureUniforms(effect) {
    const actor = effect.get_actor();
    const texture = effect.get_texture();
    return effectTextureUniforms(actor, [texture.get_width(), texture.get_height()], actor.get_resource_scale());
}

const EllipseEffect = GObject.registerClass(
    class MirxEllipseEffect extends Shell.GLSLEffect {
        vfunc_build_pipeline() {
            this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, ELLIPSE_DECLARATIONS, ELLIPSE_CODE, true);
        }

        vfunc_paint_target(node, paintContext) {
            const scale = this.get_actor().get_resource_scale();
            const shape = this.marker
                ? markerDisc(this.marker, scale, this.physicalScale).uniforms
                : ellipseUniforms(this.annotation, scale, this.physicalScale);
            const size = this.marker
                ? markerDisc(this.marker, 1, this.physicalScale).rect
                : rectangleGeometry(this.annotation);
            const gradient = gradientUniforms(this.marker ?? this.annotation, size, this.shades, scale);
            setUniforms(this, { ...textureUniforms(this), ...shape, ...gradient, ringColor: this.color });
            super.vfunc_paint_target(node, paintContext);
        }
    },
);

// Recolours the St pixels already painted by a rectangle or arrow; exists only while it has a gradient.
const GradientEffect = GObject.registerClass(
    class MirxGradientEffect extends Shell.GLSLEffect {
        vfunc_build_pipeline() {
            // Samples its texture explicitly, the same way GNOME Shell's own effects do.
            this.add_glsl_snippet(
                Cogl.SnippetHook.FRAGMENT,
                GRADIENT_RECOLOR_DECLARATIONS,
                GRADIENT_RECOLOR_CODE,
                true,
            );
        }

        vfunc_paint_target(node, paintContext) {
            const scale = this.get_actor().get_resource_scale();
            const size =
                this.annotation.type === 'arrow' ? arrowBounds(this.annotation) : rectangleGeometry(this.annotation);
            const { textureSize, contentOffset } = textureUniforms(this);
            setUniforms(this, {
                textureSize,
                contentOffset,
                ...gradientUniforms(this.annotation, size, this.shades, scale),
            });
            super.vfunc_paint_target(node, paintContext);
        }
    },
);

const PixelateEffect = GObject.registerClass(
    class MirxPixelateEffect extends Shell.GLSLEffect {
        vfunc_build_pipeline() {
            this.add_glsl_snippet(Cogl.SnippetHook.TEXTURE_LOOKUP, PIXELATE_DECLARATIONS, PIXELATE_CODE, true);
        }

        vfunc_paint_target(node, paintContext) {
            setUniforms(this, {
                ...textureUniforms(this),
                ...pixelateUniforms(this.geometry, this.get_actor().get_resource_scale()),
            });
            super.vfunc_paint_target(node, paintContext);
        }
    },
);

function colorOf(value) {
    let color = (value ?? '#ff0000').replace('#', '');
    if (color.length === 3) color = [...color].map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : '#ff0000';
}

function place(actor, rect) {
    actor.set_position(rect.x, rect.y);
    actor.set_size(rect.width, rect.height);
}

// Adds the effect once while the gradient is on, reuses it, and removes it when the gradient goes off.
function syncGradient(entry, annotation, color) {
    const { actor } = entry;
    if (annotation.gradient && !entry.effect) {
        entry.effect = new GradientEffect();
        actor.add_effect(entry.effect);
    } else if (!annotation.gradient && entry.effect) {
        actor.remove_effect(entry.effect);
        entry.effect = null;
    }
    if (!entry.effect) return;
    entry.effect.annotation = { ...annotation };
    entry.effect.shades = gradientShades(color);
    actor.queue_redraw();
}

function updateRectangle(entry, annotation, color, width) {
    place(entry.actor, rectangleGeometry(annotation));
    if (entry.style !== `${width}:${color}`) {
        entry.actor.set_style(`border: ${width}px solid ${color}; border-radius: ${width / 2}px;`);
        entry.style = `${width}:${color}`;
    }
    syncGradient(entry, annotation, color);
}

function updateHighlighter(entry, annotation, color) {
    place(entry.actor, rectangleGeometry(annotation));
    if (entry.style !== color) {
        const rgb = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
        entry.actor.set_style(`background-color: rgba(${rgb.join(', ')}, 0.35);`);
        entry.style = color;
    }
}

function updateArrow(entry, annotation, color, width) {
    // The container is the arrowBounds box, so bars are placed relative to its origin.
    const bounds = arrowBounds(annotation);
    place(entry.actor, bounds);
    arrowBars(annotation).forEach((bar, i) => {
        const part = entry.bars[i];
        place(part, { ...bar, x: bar.x - bounds.x, y: bar.y - bounds.y });
        part.set_pivot_point(bar.pivotX, bar.pivotY);
        part.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, bar.angle);
        if (entry.style !== `${width}:${color}`)
            part.set_style(`background-color: ${color}; border-radius: ${width / 2}px;`);
    });
    entry.style = `${width}:${color}`;
    syncGradient(entry, annotation, color);
}

function updateText(entry, annotation, color, width) {
    const { actor } = entry;
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
}

function updateMarkerLabel(entry, annotation, color, width, text, scale) {
    const { label, shadow } = entry;
    label.set_text(text);
    label.set_font_description(textFont(width, markerLabel(markerRadius(annotation.width), text.length).fontSize));
    const ink = contrastColor(color);
    const [, coglColor] = Cogl.Color.from_string(ink);
    label.set_color(coglColor);
    shadow.set_text(text);
    shadow.set_font_description(textFont(width, markerLabel(markerRadius(annotation.width), text.length).fontSize));
    const [, shadowColor] = Cogl.Color.from_string('#00000059'); // 35% black
    shadow.set_color(shadowColor);
    shadow.visible = ink === '#ffffff'; // a shadow under a black number would only smudge it
    const [, w] = label.get_preferred_width(-1);
    const [, h] = label.get_preferred_height(-1);
    const snap = (v) => Math.round(v * scale) / scale;
    place(label, { x: snap(annotation.x1 - w / 2), y: snap(annotation.y1 - h / 2), width: w, height: h });
    place(shadow, {
        x: snap(annotation.x1 - w / 2),
        y: snap(annotation.y1 - h / 2 + 1 / scale),
        width: w,
        height: h,
    });
}

function syncHidden(entry, annotation, editingId) {
    const hidden = Boolean(entry.empty || (annotation.type === 'text' && annotation.id === editingId));
    if (hidden === entry.hidden) return;
    entry.hidden = hidden;
    if (hidden) entry.actor.hide();
    else entry.actor.show();
}

export class AnnotationActors {
    constructor({ snapshot, width, height }) {
        this.snapshot = snapshot;
        this._stage = { width, height };
        this.actor = new Clutter.Actor({ width, height });
        this._entries = new Map();
        this._order = '';
        this._clip = undefined;
    }

    _create(annotation) {
        let actor,
            bars = null,
            image = null,
            effect = null,
            disc = null,
            shadow = null,
            label = null;
        if (annotation.type === 'arrow') {
            actor = new Clutter.Actor();
            bars = [0, 1, 2].map(() => new St.Widget());
            bars.forEach((bar) => {
                actor.add_child(bar);
            });
        } else if (annotation.type === 'text') {
            actor = new Clutter.Text({ single_line_mode: false });
        } else if (annotation.type === 'circle') {
            const [, background] = Cogl.Color.from_string('#ffffff');
            actor = new Clutter.Actor({ background_color: background });
            effect = new EllipseEffect();
        } else if (annotation.type === 'marker') {
            // Only the disc carries the effect, so the number is drawn unfiltered.
            const [, background] = Cogl.Color.from_string('#ffffff');
            actor = new Clutter.Actor();
            disc = new Clutter.Actor({ background_color: background });
            shadow = new Clutter.Text();
            label = new Clutter.Text();
            actor.add_child(disc);
            actor.add_child(shadow);
            actor.add_child(label);
            effect = new EllipseEffect();
        } else if (annotation.type === 'pixelate') {
            actor = new Clutter.Actor({ clip_to_allocation: true });
            image = new Clutter.Actor({ content: this.snapshot.content, ...this._stage });
            image.set_content_scaling_filters(Clutter.ScalingFilter.NEAREST, Clutter.ScalingFilter.NEAREST);
            actor.add_child(image);
            effect = new PixelateEffect();
        } else {
            actor = new St.Widget();
        }
        const entry = {
            actor,
            bars,
            image,
            disc,
            shadow,
            label,
            effect,
            type: annotation.type,
            key: null,
            hidden: false,
        };
        if (effect) (disc ?? actor).add_effect(effect);
        this.actor.add_child(actor);
        return entry;
    }

    _updateEntry(entry, annotation, selection, number) {
        const color = colorOf(annotation.color);
        const width = Math.max(1, annotation.width || 3);
        switch (annotation.type) {
            case 'rectangle':
                updateRectangle(entry, annotation, color, width);
                break;
            case 'highlighter':
                updateHighlighter(entry, annotation, color);
                break;
            case 'arrow':
                updateArrow(entry, annotation, color, width);
                break;
            case 'text':
                updateText(entry, annotation, color, width);
                break;
            case 'circle':
                this._updateCircle(entry, annotation, color);
                break;
            case 'marker':
                this._updateMarker(entry, annotation, color, width, number);
                break;
            case 'pixelate':
                this._updatePixelate(entry, annotation, selection);
                break;
        }
    }

    _updateCircle(entry, annotation, color) {
        place(entry.actor, rectangleGeometry(annotation));
        entry.empty = annotation.x1 === annotation.x2 || annotation.y1 === annotation.y2;
        entry.effect.annotation = { ...annotation };
        entry.effect.physicalScale = this._physicalScale;
        entry.effect.color = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16) / 255);
        entry.effect.shades = annotation.gradient ? gradientShades(color) : null;
        entry.actor.queue_redraw();
    }

    _updateMarker(entry, annotation, color, width, number) {
        const scale = this._physicalScale;
        place(entry.disc, markerDisc(annotation, 1, scale).rect);
        entry.effect.marker = annotation;
        entry.effect.physicalScale = scale;
        entry.effect.color = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16) / 255);
        entry.effect.shades = annotation.gradient ? gradientShades(color) : null;
        entry.disc.queue_redraw();
        updateMarkerLabel(entry, annotation, color, width, String(number), scale);
    }

    _updatePixelate(entry, annotation, selection) {
        const geometry = pixelateGeometry(annotation, selection, this._stage);
        place(entry.actor, geometry.rect);
        entry.empty = geometry.rect.width === 0 || geometry.rect.height === 0;
        entry.image.set_position(-geometry.rect.x, -geometry.rect.y);
        entry.effect.geometry = geometry;
        entry.actor.queue_redraw();
    }

    _monitorScale(selection) {
        const monitor = this.snapshot.monitors?.find(
            (m) =>
                selection &&
                selection.x >= m.x &&
                selection.y >= m.y &&
                selection.x < m.x + m.width &&
                selection.y < m.y + m.height,
        );
        return monitor?.scale ?? monitor?.scaleFactor ?? this.snapshot.scale ?? 1;
    }

    _syncClip(selection) {
        const clip = JSON.stringify(selection);
        if (clip === this._clip) return;
        this._clip = clip;
        if (selection) this.actor.set_clip(selection.x, selection.y, selection.width, selection.height);
        else this.actor.set_clip(0, 0, 0, 0);
    }

    _removeStale(annotations) {
        const ids = new Set(annotations.map((annotation) => annotation.id));
        for (const [id, entry] of this._entries) {
            if (!ids.has(id)) {
                entry.actor.destroy();
                this._entries.delete(id);
            }
        }
    }

    _entryFor(annotation) {
        let entry = this._entries.get(annotation.id);
        if (!entry) {
            entry = this._create(annotation);
            this._entries.set(annotation.id, entry);
        }
        return entry;
    }

    _entryKey(annotation, selection, numbers) {
        return JSON.stringify([
            annotation,
            annotation.type === 'pixelate' ? selection : null,
            annotation.type === 'circle' || annotation.type === 'marker' ? this._physicalScale : null,
            annotation.type === 'marker' ? numbers.get(annotation.id) : null,
        ]);
    }

    _syncOrder(annotations) {
        const order = JSON.stringify(annotations.map((annotation) => annotation.id));
        if (order === this._order) return;
        let previous = null;
        for (const annotation of annotations) {
            const actor = this._entries.get(annotation.id).actor;
            this.actor.set_child_above_sibling(actor, previous);
            previous = actor;
        }
        this._order = order;
    }

    update(annotations, selection, editingId = null) {
        this._physicalScale = this._monitorScale(selection);
        this._syncClip(selection);
        this._removeStale(annotations);
        const numbers = markerNumbers(annotations);
        for (const annotation of annotations) {
            const entry = this._entryFor(annotation);
            const key = this._entryKey(annotation, selection, numbers);
            if (entry.key !== key) {
                this._updateEntry(entry, annotation, selection, numbers.get(annotation.id));
                entry.key = key;
            }
            syncHidden(entry, annotation, editingId);
        }
        this._syncOrder(annotations);
    }

    prepareExport() {
        for (const entry of this._entries.values()) {
            if (entry.type === 'circle' || entry.type === 'pixelate') entry.actor.get_allocation_box();
            else if (entry.type === 'marker') entry.disc.get_allocation_box();
        }
    }
}
