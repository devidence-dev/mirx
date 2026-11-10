import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {alignmentGuideGeometry} from '../rendering/alignmentGuideGeometry.js';
import {setUniforms, textureUniforms} from './annotationActors.js';
import {GUIDE_CODE, GUIDE_DECLARATIONS} from './shaders.js';

const GuideEffect = GObject.registerClass(class MirxGuideEffect extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, GUIDE_DECLARATIONS, GUIDE_CODE, true);
    }

    vfunc_paint_target(node, paintContext) {
        const {textureSize, contentOffset} = textureUniforms(this);
        const {vertical, scale, core, dash, period} = this.guide;
        setUniforms(this, {textureSize, contentOffset,
            // Texture pixels per monitor physical pixel; the resource scale is rounded up.
            guidePixel: [this.get_actor().get_resource_scale() / scale],
            guideVertical: [vertical ? 1 : 0], guideCore: [core], guideDash: [dash], guidePeriod: [period]});
        super.vfunc_paint_target(node, paintContext);
    }
});

/** Dotted cursor guides: two reusable GPU strips in one inert container. Presentation only. */
export class AlignmentGuides {
    constructor(snapshot) {
        this._scale = snapshot.scale;
        this.actor = new St.Widget({name: 'mirx-alignment-guides', reactive: false, can_focus: false, visible: false});
        const [, white] = Cogl.Color.from_string('#ffffff');
        this._strips = ['horizontal', 'vertical'].map(name => {
            const actor = new Clutter.Actor({reactive: false, background_color: white});
            const effect = new GuideEffect();
            actor.add_effect(effect);
            this.actor.add_child(actor);
            return {name, actor, effect, key: null};
        });
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
                const {x, y, width, height, core} = geometry[strip.name];
                strip.actor.set_position(x, y);
                strip.actor.set_size(width, height);
                strip.effect.guide = {vertical: strip.name === 'vertical', scale: geometry.scale,
                    core, dash: geometry.dash, period: geometry.period};
                strip.actor.queue_redraw();
            }
        }
        this.actor.show();
    }
}
