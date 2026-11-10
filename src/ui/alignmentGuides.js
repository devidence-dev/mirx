import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import { alignmentGuideGeometry } from '../rendering/alignmentGuideGeometry.js';
import { setUniforms, textureUniforms } from './annotationActors.js';
import { GUIDE_CODE, GUIDE_DECLARATIONS, RING_CODE, RING_DECLARATIONS } from './shaders.js';

const GuideEffect = GObject.registerClass(
    class MirxGuideEffect extends Shell.GLSLEffect {
        vfunc_build_pipeline() {
            this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, GUIDE_DECLARATIONS, GUIDE_CODE, true);
        }

        vfunc_paint_target(node, paintContext) {
            const { textureSize, contentOffset } = textureUniforms(this);
            const { vertical, scale, core } = this.guide;
            setUniforms(this, {
                textureSize,
                contentOffset,
                // Texture pixels per monitor physical pixel; the resource scale is rounded up.
                guidePixel: [this.get_actor().get_resource_scale() / scale],
                guideVertical: [vertical ? 1 : 0],
                guideCore: [core],
            });
            super.vfunc_paint_target(node, paintContext);
        }
    },
);

const RingEffect = GObject.registerClass(
    class MirxRingEffect extends Shell.GLSLEffect {
        vfunc_build_pipeline() {
            this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, RING_DECLARATIONS, RING_CODE, true);
        }

        vfunc_paint_target(node, paintContext) {
            const { textureSize, contentOffset } = textureUniforms(this);
            const { scale, half, radius, inner, outer } = this.ring;
            setUniforms(this, {
                textureSize,
                contentOffset,
                // Texture pixels per monitor physical pixel; the resource scale is rounded up.
                ringPixel: [this.get_actor().get_resource_scale() / scale],
                ringHalf: [half],
                ringRadius: [radius],
                ringInner: [inner],
                ringOuter: [outer],
            });
            super.vfunc_paint_target(node, paintContext);
        }
    },
);

/** Solid cursor guides, a centre mark and coordinates: GPU strips, one ring and a label in one inert, clipped container. Presentation only. */
export class AlignmentGuides {
    constructor(snapshot) {
        this._scale = snapshot.scale;
        this.actor = new St.Widget({
            name: 'mirx-alignment-guides',
            reactive: false,
            can_focus: false,
            visible: false,
            clip_to_allocation: true,
        });
        const [, white] = Cogl.Color.from_string('#ffffff');
        this._strips = ['horizontal', 'vertical'].map((name) => {
            const actor = new Clutter.Actor({ reactive: false, background_color: white });
            const effect = new GuideEffect();
            actor.add_effect(effect);
            this.actor.add_child(actor);
            return { name, actor, effect, key: null };
        });
        // Last child: drawn above both strips.
        const ringActor = new Clutter.Actor({ reactive: false, background_color: white });
        const ringEffect = new RingEffect();
        ringActor.add_effect(ringEffect);
        this.actor.add_child(ringActor);
        this._ring = { actor: ringActor, effect: ringEffect };
        // Last child: coordinates beside the cursor, drawn above the mark.
        this._label = new St.Label({ style_class: 'mirx-cursor-coordinates', reactive: false });
        this.actor.add_child(this._label);
        this._key = null;
    }

    update(point, monitor, visible) {
        if (!visible || !monitor) {
            this.actor.hide();
            return;
        }
        const geometry = alignmentGuideGeometry(point, monitor, this._scale);
        const key = JSON.stringify([monitor.x, monitor.y, monitor.width, monitor.height, geometry]);
        if (key !== this._key) {
            this._key = key;
            this.actor.set_position(monitor.x, monitor.y);
            this.actor.set_size(monitor.width, monitor.height);
            for (const strip of this._strips) {
                const { x, y, width, height, core } = geometry[strip.name];
                strip.actor.set_position(x, y);
                strip.actor.set_size(width, height);
                strip.effect.guide = { vertical: strip.name === 'vertical', scale: geometry.scale, core };
                strip.actor.queue_redraw();
            }
            const { ring } = geometry;
            this._ring.actor.set_position(ring.x, ring.y);
            this._ring.actor.set_size(ring.size, ring.size);
            this._ring.effect.ring = { ...ring, scale: geometry.scale };
            this._ring.actor.queue_redraw();
            this._label.text = `x: ${Math.floor(point.x)}\ny: ${Math.floor(point.y)}`;
            const width = this._label.get_preferred_width(-1)[1],
                height = this._label.get_preferred_height(-1)[1];
            const px = point.x - monitor.x,
                py = point.y - monitor.y;
            const snap = (value) => Math.round(value * geometry.scale) / geometry.scale;
            this._label.set_position(
                snap(px + 14 + width > monitor.width ? px - 14 - width : px + 14),
                snap(py + 12 + height > monitor.height ? py - 12 - height : py + 12),
            );
        }
        this.actor.show();
    }
}
