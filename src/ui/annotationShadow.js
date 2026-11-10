import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Shell from 'gi://Shell';

import { annotationShadowGeometry } from '../rendering/annotationShadowGeometry.js';

export class AnnotationShadow {
    constructor(source) {
        this.source = source;
        this.actor = new Clutter.Actor({ reactive: false, opacity: 115 }); // ~45%: 25% was invisible on dark content
        this.clone = new Clutter.Clone({ source, reactive: false });
        const [, black] = Cogl.Color.from_string('#000000');
        this.clone.add_effect(new Clutter.ColorizeEffect({ tint: black }));
        this.actor.add_child(this.clone);
        this.blur = new Shell.BlurEffect({ mode: Shell.BlurMode.ACTOR });
        this.actor.add_effect(this.blur);
        this._geometry = null;
        this._visible = true;
        this._destroyed = false;
    }

    update(rect, physicalScale) {
        const geometry = annotationShadowGeometry(rect, physicalScale);
        const key = JSON.stringify(geometry);
        if (key === this._geometry) return;
        this._geometry = key;
        const { wrapper, clone, radius } = geometry;
        this.actor.set_position(wrapper.x, wrapper.y);
        this.actor.set_size(wrapper.width, wrapper.height);
        this.clone.set_position(clone.x, clone.y);
        this.clone.set_size(clone.width, clone.height);
        this.blur.set_radius(radius);
    }

    setVisible(visible) {
        if (visible === this._visible) return;
        this._visible = visible;
        if (visible) this.actor.show();
        else this.actor.hide();
    }

    prepareExport() {
        this.source.get_allocation_box();
        this.clone.get_allocation_box();
        this.actor.get_allocation_box();
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this.actor.destroy();
    }
}
