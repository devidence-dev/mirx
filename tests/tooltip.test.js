import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Actor {
    constructor(props = {}) {
        Object.assign(this, props);
        this.signals = new Map();
        this.next = 0;
        this.clutter_text = {
            set_line_wrap: (value) => {
                this.wrap = value;
            },
        };
    }
    connect(name, fn) {
        const id = ++this.next;
        this.signals.set(id, { name, fn });
        return id;
    }
    disconnect(id) {
        this.signals.delete(id);
    }
    emit(name) {
        for (const signal of this.signals.values()) if (signal.name === name) signal.fn();
    }
    get_transformed_extents() {
        return this.extents ?? { origin: { x: 90, y: 2 }, size: { width: 10, height: 10 } };
    }
    get_preferred_width() {
        return [0, this.naturalWidth ?? 40];
    }
    get_preferred_height() {
        return [0, this.naturalHeight ?? 20];
    }
    set_size(width, height) {
        this.width = width;
        this.height = height;
    }
    set_width(width) {
        this.width = width;
    }
    set_height(height) {
        this.height = height;
    }
    set_clip_to_allocation(value) {
        this.clip = value;
    }
    set_position(x, y) {
        this.x = x;
        this.y = y;
    }
    show() {
        this.visible = true;
    }
    hide() {
        this.visible = false;
    }
    ease(props) {
        this.duration = props.duration;
        this.opacity = props.opacity;
        props.onComplete?.();
    }
    remove_all_transitions() {}
    destroy() {
        this.destroyed = true;
    }
}
test('tooltip delay, cancellation, flip, press and destruction', () => {
    let next = 0;
    const timers = new Map();
    const GLib = {
        PRIORITY_DEFAULT: 0,
        SOURCE_REMOVE: false,
        timeout_add: (_priority, delay, fn) => {
            assert.equal(delay, 300);
            timers.set(++next, fn);
            return next;
        },
        Source: { remove: (id) => timers.delete(id) },
    };
    const source = `${readFileSync(new URL('../src/ui/tooltip.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '')
        .replace('export class Tooltip', 'class Tooltip')}\nthis.Tooltip = Tooltip;`;
    const context = { GLib, St: { Label: Actor } };
    vm.runInNewContext(source, context);
    const tooltip = new context.Tooltip({ monitor: { x: 0, y: 0, width: 100, height: 100 } });
    const widget = new Actor();
    tooltip.attach(widget, 'Rectangle (R)', 'above');
    widget.hover = true;
    widget.emit('notify::hover');
    assert.equal(tooltip.actor.visible, false);
    widget.hover = false;
    widget.emit('notify::hover');
    assert.equal(timers.size, 0);
    widget.hover = true;
    widget.emit('notify::hover');
    const fn = [...timers.values()][0];
    timers.clear();
    assert.equal(fn(), GLib.SOURCE_REMOVE);
    assert.equal(tooltip.actor.visible, true);
    assert.equal(tooltip.actor.duration, 150);
    assert.equal(tooltip.actor.wrap, true);
    assert.equal(tooltip.actor.x, 60);
    assert.equal(tooltip.actor.y, 20);
    widget.hover = false;
    widget.emit('notify::hover');
    assert.equal(tooltip.actor.duration, 100);
    widget.hover = true;
    widget.emit('notify::hover');
    const second = [...timers.values()][0];
    timers.clear();
    second();
    widget.emit('button-press-event');
    assert.equal(tooltip.actor.visible, false);
    widget.emit('key-focus-in');
    assert.equal(timers.size, 0);
    widget.emit('key-focus-out');
    widget.emit('key-focus-in');
    assert.equal(timers.size, 1);
    tooltip.hideNow();
    const lower = new Actor();
    lower.extents = { origin: { x: -20, y: 85 }, size: { width: 10, height: 10 } };
    tooltip.attach(lower, 'Lower', 'below');
    lower.emit('key-focus-in');
    let callback = [...timers.values()][0];
    timers.clear();
    assert.equal(callback(), GLib.SOURCE_REMOVE);
    assert.equal(tooltip.actor.x, 0);
    assert.equal(tooltip.actor.y, 57);
    tooltip.actor.naturalWidth = 160;
    tooltip.actor.naturalHeight = 140;
    lower.emit('key-focus-in');
    callback = [...timers.values()][0];
    timers.clear();
    callback();
    assert.equal(tooltip.actor.width, 100);
    assert.equal(tooltip.actor.height, 100);
    assert.equal(tooltip.actor.x, 0);
    assert.equal(tooltip.actor.y, 0);
    assert.equal(tooltip.actor.clip, true);
    tooltip.actor.naturalWidth = 40;
    tooltip.actor.naturalHeight = 20;
    lower.emit('key-focus-in');
    callback = [...timers.values()][0];
    timers.clear();
    callback();
    assert.equal(tooltip.actor.width, -1);
    assert.equal(tooltip.actor.height, -1);
    lower.emit('key-focus-in');
    tooltip.destroy();
    tooltip.destroy();
    assert.equal(timers.size, 0);
    assert.equal(widget.signals.size, 0);
    assert.equal(lower.signals.size, 0);
});
