import Clutter from 'gi://Clutter';
import St from 'gi://St';

const SIZE = 144;

/** Reuses the frozen texture; nearest filtering preserves individual pixels. */
export class Magnifier {
    constructor(snapshot, stageWidth, stageHeight) {
        this._scale = snapshot.scale;
        this.actor = new St.Widget({width: SIZE, height: SIZE + 26,
            style_class: 'mirx-magnifier', visible: false, clip_to_allocation: true});
        const viewport = new Clutter.Actor({width: SIZE, height: SIZE, clip_to_allocation: true});
        this.actor.add_child(viewport);
        this._image = new Clutter.Actor({content: snapshot.content,
            width: stageWidth, height: stageHeight});
        this._image.set_content_scaling_filters(Clutter.ScalingFilter.NEAREST, Clutter.ScalingFilter.NEAREST);
        viewport.add_child(this._image);
        const cross = new St.DrawingArea({width: SIZE, height: SIZE});
        cross.connect('repaint', area => {
            const cr = area.get_context();
            try {
                cr.setLineWidth(3);
                cr.setSourceRGBA(0, 0, 0, 0.8);
                this._cross(cr);
                cr.setLineWidth(1);
                cr.setSourceRGBA(1, 1, 1, 1);
                this._cross(cr);
                cr.rectangle(SIZE / 2 - 4, SIZE / 2 - 4, 8, 8);
                cr.stroke();
            } finally {
                cr.$dispose();
            }
        });
        viewport.add_child(cross);
        this._label = new St.Label({y: SIZE + 3, style_class: 'mirx-coordinates'});
        this.actor.add_child(this._label);
    }

    _cross(cr) {
        const c = SIZE / 2;
        cr.moveTo(c - 18, c); cr.lineTo(c - 6, c);
        cr.moveTo(c + 6, c); cr.lineTo(c + 18, c);
        cr.moveTo(c, c - 18); cr.lineTo(c, c - 6);
        cr.moveTo(c, c + 6); cr.lineTo(c, c + 18);
        cr.stroke();
    }

    update(point, monitor, visible) {
        if (!visible || !monitor) {
            this.actor.hide();
            return;
        }
        const zoom = 8 * this._scale;
        const actorScale = Math.min(1, monitor.width / SIZE, monitor.height / (SIZE + 26));
        const width = SIZE * actorScale, height = (SIZE + 26) * actorScale;
        this.actor.set_scale(actorScale, actorScale);
        const pixelX = (Math.floor(point.x * this._scale) + 0.5) / this._scale;
        const pixelY = (Math.floor(point.y * this._scale) + 0.5) / this._scale;
        this._image.set_scale(zoom, zoom);
        this._image.set_position(SIZE / 2 - pixelX * zoom, SIZE / 2 - pixelY * zoom);
        this._label.text = `${Math.floor(point.x)}, ${Math.floor(point.y)}`;
        let x = point.x + 24, y = point.y + 24;
        if (x + width > monitor.x + monitor.width)
            x = point.x - width - 24;
        if (y + height > monitor.y + monitor.height)
            y = point.y - height - 24;
        this.actor.set_position(Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - width)),
            Math.max(monitor.y, Math.min(y, monitor.y + monitor.height - height)));
        this.actor.show();
    }
}
