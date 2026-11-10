import GLib from 'gi://GLib';
import St from 'gi://St';

export class Tooltip {
    constructor({ monitor }) {
        this.actor = new St.Label({ style_class: 'mirx-tooltip', reactive: false, visible: false, opacity: 0 });
        this.actor.clutter_text.set_line_wrap(true);
        this.actor.set_clip_to_allocation(true);
        this._monitor = monitor;
        this._signals = new Map();
        this._timer = 0;
        this._destroyed = false;
    }

    attach(widget, text, side) {
        let pressed = false;
        const show = () => {
            if (!pressed) this._schedule(widget, text, side);
        };
        const hide = () => {
            pressed = false;
            this._hide();
        };
        const ids = [
            widget.connect('notify::hover', () => (widget.hover ? show() : hide())),
            widget.connect('key-focus-in', show),
            widget.connect('key-focus-out', hide),
            widget.connect('button-press-event', () => {
                pressed = true;
                this.hideNow();
                return false;
            }),
            widget.connect('destroy', () => {
                this.hideNow();
                this._signals.delete(widget);
            }),
        ];
        this._signals.set(widget, ids);
    }

    _cancelTimer() {
        if (this._timer) GLib.Source.remove(this._timer);
        this._timer = 0;
    }

    _schedule(widget, text, side) {
        this.hideNow();
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this._timer = 0;
            if (this._destroyed) return GLib.SOURCE_REMOVE;
            this._show(widget, text, side);
            return GLib.SOURCE_REMOVE;
        });
    }

    _show(widget, text, side) {
        this.actor.text = typeof text === 'function' ? text() : text;
        const extents = widget.get_transformed_extents();
        const monitor = typeof this._monitor === 'function' ? this._monitor() : this._monitor;
        this.actor.set_size(-1, -1);
        const [, naturalWidth] = this.actor.get_preferred_width(-1);
        const width = Math.min(naturalWidth, monitor.width);
        if (width < naturalWidth) this.actor.set_width(width);
        const [, naturalHeight] = this.actor.get_preferred_height(width);
        const height = Math.min(naturalHeight, monitor.height);
        if (height < naturalHeight) this.actor.set_height(height);
        const x1 = extents.origin.x,
            y1 = extents.origin.y;
        const x2 = x1 + extents.size.width,
            y2 = y1 + extents.size.height;
        let x = (x1 + x2 - width) / 2;
        let y = side === 'above' ? y1 - height - 8 : y2 + 8;
        if (side === 'above' && y < monitor.y) y = y2 + 8;
        if (side !== 'above' && y + height > monitor.y + monitor.height) y = y1 - height - 8;
        x = Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - width));
        y = Math.max(monitor.y, Math.min(y, monitor.y + monitor.height - height));
        this.actor.set_position(x, y);
        this.actor.show();
        this.actor.ease({ opacity: 255, duration: 150 });
    }

    _hide() {
        this._cancelTimer();
        this.actor.remove_all_transitions();
        this.actor.ease({ opacity: 0, duration: 100, onComplete: () => this.actor?.hide() });
    }

    hideNow() {
        this._cancelTimer();
        if (!this.actor) return;
        this.actor.remove_all_transitions();
        this.actor.opacity = 0;
        this.actor.hide();
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this.hideNow();
        for (const [widget, ids] of this._signals) for (const id of ids) widget.disconnect(id);
        this._signals.clear();
        this.actor.destroy();
        this.actor = null;
    }
}
