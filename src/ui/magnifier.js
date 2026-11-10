import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {setUniforms, textureUniforms} from './annotationActors.js';
import {MASK_CODE, MASK_DECLARATIONS} from './shaders.js';

const SIZE = 144;
const RADIUS = 10;

const MaskEffect = GObject.registerClass(class MirxMaskEffect extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        // Samples its texture explicitly, the same way GNOME Shell's own effects do.
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, MASK_DECLARATIONS, MASK_CODE, true);
    }

    vfunc_paint_target(node, paintContext) {
        const {textureSize, contentOffset} = textureUniforms(this);
        const rs = this.get_actor().get_resource_scale();
        setUniforms(this, {textureSize, contentOffset, extent: [SIZE * rs, SIZE * rs], radius: [RADIUS * rs]});
        super.vfunc_paint_target(node, paintContext);
    }
});

/** Reuses the frozen texture; nearest filtering preserves individual pixels. */
export class Magnifier {
    constructor(snapshot, stageWidth, stageHeight) {
        this._scale = snapshot.scale;
        this.actor = new St.Widget({width: SIZE, height: SIZE,
            style_class: 'mirx-magnifier', visible: false, clip_to_allocation: true});
        const viewport = new Clutter.Actor({width: SIZE, height: SIZE, clip_to_allocation: true});
        viewport.add_effect(new MaskEffect());
        this.actor.add_child(viewport);
        this._image = new Clutter.Actor({content: snapshot.content,
            width: stageWidth, height: stageHeight});
        this._image.set_content_scaling_filters(Clutter.ScalingFilter.NEAREST, Clutter.ScalingFilter.NEAREST);
        viewport.add_child(this._image);
        const c = SIZE / 2;
        this._marks = [];
        const mark = (geometry, style) => {
            const actor = new St.Widget({...geometry, style});
            this._marks.push({actor, geometry});
            viewport.add_child(actor);
        };
        // Translucent bands framing the target pixel; the pixel itself stays uncovered.
        const band = 'background-color: rgba(40, 40, 40, 0.35); border: 1px solid rgba(255, 255, 255, 0.3);';
        mark({x: 0, y: c - 4, width: c - 4, height: 8}, band);
        mark({x: c + 4, y: c - 4, width: SIZE - (c + 4), height: 8}, band);
        mark({x: c - 4, y: 0, width: 8, height: c - 4}, band);
        mark({x: c - 4, y: c + 4, width: 8, height: SIZE - (c + 4)}, band);
        // Last child: draws the border over the image edges and follows the rounded corners.
        this.actor.add_child(new St.Widget({style_class: 'mirx-magnifier-frame', reactive: false,
            width: SIZE, height: SIZE}));
    }

    update(point, monitor, visible) {
        if (!visible || !monitor) {
            this.actor.hide();
            return;
        }
        const zoom = 8 * this._scale;
        const actorScale = Math.min(1, monitor.width / SIZE, monitor.height / SIZE);
        const width = SIZE * actorScale, height = SIZE * actorScale;
        this.actor.set_scale(actorScale, actorScale);
        const pixelX = (Math.floor(point.x * this._scale) + 0.5) / this._scale;
        const pixelY = (Math.floor(point.y * this._scale) + 0.5) / this._scale;
        this._image.set_scale(zoom, zoom);
        this._image.set_position(SIZE / 2 - pixelX * zoom, SIZE / 2 - pixelY * zoom);
        let x = point.x + 24, y = point.y + 52;
        if (x + width > monitor.x + monitor.width)
            x = point.x - width - 24;
        if (y + height > monitor.y + monitor.height)
            y = point.y - height - 52;
        x = Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - width));
        y = Math.max(monitor.y, Math.min(y, monitor.y + monitor.height - height));
        this.actor.set_position(x, y);
        const scale = monitor.scale ?? monitor.scaleFactor ?? this._scale;
        const snap = (value, origin, monitorOrigin) =>
            (Math.round((origin + value * actorScale - monitorOrigin) * scale) / scale + monitorOrigin - origin) / actorScale;
        const phase = value => ((value % 1) + 1) % 1;
        const grid = [phase((x - monitor.x) * scale).toFixed(8),
            phase((y - monitor.y) * scale).toFixed(8), scale, actorScale].join(',');
        if (grid !== this._markGrid) {
            for (const {actor, geometry: g} of this._marks) {
                const left = snap(g.x, x, monitor.x), top = snap(g.y, y, monitor.y);
                const right = snap(g.x + g.width, x, monitor.x), bottom = snap(g.y + g.height, y, monitor.y);
                actor.set_position(left, top);
                actor.set_size(Math.max(right - left, 1 / (scale * actorScale)),
                    Math.max(bottom - top, 1 / (scale * actorScale)));
            }
            this._markGrid = grid;
        }
        this.actor.show();
    }
}
