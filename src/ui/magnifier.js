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
        const c = SIZE / 2;
        this._marks = [];
        const mark = (geometry, style) => {
            const actor = new St.Widget({...geometry, style});
            this._marks.push({actor, geometry});
            viewport.add_child(actor);
        };
        const line = (x, y, width, height, color) => {
            mark({x, y, width, height}, `background-color: ${color};`);
        };
        const cross = (segments, outline, core) => {
            for (const [x, y, width, height] of segments) {
                if (width) {
                    line(x - 1.5, y - 1.5, width + 3, 3, outline);
                    line(x, y - 0.5, width, 1, core);
                } else {
                    line(x - 1.5, y - 1.5, 3, height + 3, outline);
                    line(x - 0.5, y, 1, height, core);
                }
            }
        };
        // Faint extensions from the ticks to the viewport edges; the centre pixel stays clear.
        cross([
            [0, c, c - 18, 0], [c + 18, c, c - 18, 0],
            [c, 0, 0, c - 18], [c, c + 18, 0, c - 18],
        ], 'rgba(0, 0, 0, 0.3)', 'rgba(255, 255, 255, 0.45)');
        cross([
            [c - 18, c, 12, 0], [c + 6, c, 12, 0],
            [c, c - 18, 0, 12], [c, c + 6, 0, 12],
        ], 'rgba(0, 0, 0, 0.8)', 'white');
        mark({x: c - 4.5, y: c - 4.5, width: 9, height: 9}, 'border: 1px solid white;');
        this._label = new St.Label({y: SIZE + 3, style_class: 'mirx-coordinates'});
        this.actor.add_child(this._label);
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
