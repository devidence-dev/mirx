import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { contains, handles, physicalRect } from '../core/geometry.js';
import { textFont } from '../rendering/annotations.js';
import { AlignmentGuides } from './alignmentGuides.js';
import { AnnotationActors } from './annotationActors.js';
import { cursorFor } from './cursorModel.js';
import { decorationRect, DecorationActors } from './decorations.js';
import { Magnifier } from './magnifier.js';
import { Toolbar } from './toolbar.js';
import { toolForKey } from './toolbarModel.js';
import { Tooltip } from './tooltip.js';

function cursorType(name) {
    const cursors = Clutter.CursorType;
    return {
        pointer: cursors.POINTER,
        move: cursors.MOVE,
        crosshair: cursors.CROSSHAIR,
        text: cursors.TEXT,
        default: cursors.DEFAULT,
        'ns-resize': cursors.NS_RESIZE ?? cursors.N_RESIZE,
        'ew-resize': cursors.EW_RESIZE ?? cursors.E_RESIZE,
        'nwse-resize': cursors.NWSE_RESIZE ?? cursors.NW_RESIZE,
        'nesw-resize': cursors.NESW_RESIZE ?? cursors.NE_RESIZE,
    }[name];
}

function arrowDelta(symbol) {
    switch (symbol) {
        case Clutter.KEY_Left:
            return [-1, 0];
        case Clutter.KEY_Right:
            return [1, 0];
        case Clutter.KEY_Up:
            return [0, -1];
        case Clutter.KEY_Down:
            return [0, 1];
        default:
            return undefined;
    }
}

/** Translates Shell events into editor actions, and presents the frozen session. */
export class Overlay {
    constructor({ snapshot, editor, onCancel, onExport, enterAction, iconDir, perfLog = () => false }) {
        Object.assign(this, { snapshot, editor, onCancel, onExport, enterAction, perfLog });
        this._busy = false;
        this._dragging = false;
        this._selectionDrag = false;
        this._textEdit = null;
        this._grab = null;
        this._lastClick = null;
        this._control = null;
        const [x, y] = global.get_pointer();
        this._point = { x, y };
        const width = global.stage.width,
            height = global.stage.height;
        this.actor = new St.Widget({ name: 'mirx-overlay', reactive: true, can_focus: true, width, height });
        this.actor.add_child(new Clutter.Actor({ content: snapshot.content, width, height }));
        this._shades = [0, 1, 2, 3].map(() => new St.Widget({ style_class: 'mirx-shade' }));
        this._shades.forEach((shade) => {
            this.actor.add_child(shade);
        });
        this._annotations = new AnnotationActors({ snapshot, width, height });
        this.actor.add_child(this._annotations.actor);
        this._draft = new AnnotationActors({ snapshot, width, height });
        this.actor.add_child(this._draft.actor);
        this._annotationDecorations = new DecorationActors({
            width,
            height,
            createActor: (options) => new St.Widget(options),
        });
        this.actor.add_child(this._annotationDecorations.actor);
        this._guides = new AlignmentGuides(snapshot);
        this.actor.add_child(this._guides.actor);
        // St draws box-shadow as a filled copy of the box, which would darken the whole selection,
        // so the dark outer ring is its own 1 px bordered widget just outside the blue frame.
        this._frameRing = new St.Widget({ style_class: 'mirx-frame-ring', visible: false });
        this.actor.add_child(this._frameRing);
        this._frame = new St.Widget({ style_class: 'mirx-frame', visible: false });
        this.actor.add_child(this._frame);
        this._handles = [0, 1, 2, 3, 4, 5, 6, 7].map(
            () => new St.Widget({ style_class: 'mirx-handle', width: 10, height: 10, visible: false }),
        );
        this._handles.forEach((handle) => {
            this.actor.add_child(handle);
        });

        this._dimensions = new St.Label({ style_class: 'mirx-dimensions', visible: false });
        this.actor.add_child(this._dimensions);
        this._hint = new St.Label({
            text: 'Drag an area · Click: window or monitor · Ctrl+A: monitor · Esc: cancel',
            style_class: 'mirx-hint',
        });
        this.actor.add_child(this._hint);
        this._error = new St.Label({ style_class: 'mirx-error', visible: false });
        this._error.clutter_text.set_line_wrap(true);
        this.actor.add_child(this._error);
        const change = (callback) => {
            if (this._busy) return;
            this._finishText(true);
            callback();
            this.actor.grab_key_focus();
            this._refresh();
        };
        this._tooltip = new Tooltip({ monitor: () => this.editor.monitor });
        this._toolbar = new Toolbar({
            iconDir,
            tooltip: this._tooltip,
            primaryAction: () => this.enterAction(),
            onTool: (tool) => change(() => editor.setTool(tool)),
            onStyle: (style) => change(() => editor.setStyle(style)),
            onUndo: () => change(() => editor.undo()),
            onRedo: () => change(() => editor.redo()),
            onExport: (action) => this._export(action),
            onCancel: () => {
                if (!this._busy) onCancel();
            },
        });
        this.actor.add_child(this._toolbar.actor);
        this.actor.add_child(this._tooltip.actor);
        this._magnifier = new Magnifier(snapshot, width, height);
        this.actor.add_child(this._magnifier.actor);
        this.actor.connect('button-press-event', (_actor, event) => this._press(event));
        this.actor.connect('button-release-event', (_actor, event) => this._release(event));
        this.actor.connect('motion-event', (_actor, event) => this._motion(event));
        this.actor.connect('captured-event', (_actor, event) => {
            if (event.type() === Clutter.EventType.KEY_PRESS) return this._key(event);
            if (this._dragging && event.type() === Clutter.EventType.MOTION) return this._motion(event);
            if (this._dragging && event.type() === Clutter.EventType.BUTTON_RELEASE) return this._release(event);
            return Clutter.EVENT_PROPAGATE;
        });
    }

    open() {
        const group = Main.layoutManager.screenshotUIGroup;
        this._group = group;
        this._previousSibling = group.get_previous_sibling();
        group.get_parent().set_child_above_sibling(group, null);
        group.add_child(this.actor);
        Main.layoutManager.emit('system-modal-opened');
        this._grab = Main.pushModal(this.actor, { actionMode: Shell.ActionMode.SYSTEM_MODAL });
        if (this._grab.is_revoked()) throw new Error('Could not get control of the keyboard and mouse');
        global.focus_manager.add_group(this.actor);
        this._focusGroup = true;
        this.editor.pointerMove(this._point);
        this._refresh();
    }

    _pointOf(event) {
        const [x, y] = event.get_coords();
        // The magnifier needs the fractional position to address physical pixels on HiDPI.
        this._pointer = { x, y };
        return { x: Math.floor(x), y: Math.floor(y) };
    }

    _options(event) {
        return { shift: Boolean(event.get_state() & Clutter.ModifierType.SHIFT_MASK) };
    }

    _isControl(event) {
        const source = global.stage.get_event_actor(event);
        return this._toolbar.actor.contains(source) || this._textEdit?.actor.contains(source);
    }

    _controlAt(source) {
        if (this._textEdit?.actor.contains(source)) return 'text';
        if (!this._toolbar.actor.contains(source)) return null;
        for (let actor = source; actor && actor !== this._toolbar.actor; actor = actor.get_parent()) {
            if (actor instanceof St.Button && actor.reactive && !actor.has_style_pseudo_class('insensitive'))
                return 'button';
        }
        return 'toolbar';
    }

    _press(event) {
        if (this._busy) return Clutter.EVENT_STOP;
        if (event.get_button() !== Clutter.BUTTON_PRIMARY || this._isControl(event)) return Clutter.EVENT_PROPAGATE;
        this._finishText(true);
        this.actor.grab_key_focus();
        this._point = this._pointOf(event);
        const time = event.get_time();
        const previous = this._lastClick;
        const doubleClick =
            previous &&
            time >= previous.time &&
            time - previous.time < 400 &&
            Math.hypot(previous.x - this._point.x, previous.y - this._point.y) < 5;
        this._lastClick = { ...this._point, time };
        const result = this.editor.pointerDown(this._point, {
            ...this._options(event),
            clickCount: doubleClick ? 2 : 1,
        });
        this._selectionDrag = ['select', 'selection-resize'].includes(this.editor.interaction);
        this._dragging = Boolean(this.editor.interaction);
        if (result?.newText) this._startText(result.newText);
        else if (result?.editText !== undefined) this._startText(null, result.editText);
        this._refresh();
        return Clutter.EVENT_STOP;
    }

    _release(event) {
        if (!this._dragging || event.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
        this._point = this._pointOf(event);
        this._control = this._controlAt(global.stage.get_event_actor(event));
        this.editor.pointerUp(this._point, this._options(event));
        this._dragging = this._selectionDrag = false;
        this._refresh();
        return Clutter.EVENT_STOP;
    }

    _motion(event) {
        if (this._busy) return Clutter.EVENT_STOP;
        const timed = this.perfLog();
        const start = timed ? GLib.get_monotonic_time() : 0;
        this._point = this._pointOf(event);
        this._control = this._controlAt(global.stage.get_event_actor(event));
        if (!this._isControl(event) || this._dragging) this.editor.pointerMove(this._point, this._options(event));
        this._refresh();
        if (timed) console.log(`mirx-perf motion ms=${(GLib.get_monotonic_time() - start) / 1000}`);
        return this._dragging ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
    }

    _key(event) {
        this._tooltip.hideNow();
        if (this._busy) return Clutter.EVENT_STOP;
        const start = this.perfLog?.() ? GLib.get_monotonic_time() : null;
        const symbol = event.get_key_symbol();
        const ctrl = Boolean(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
        const alt = Boolean(
            event.get_state() &
                (Clutter.ModifierType.MOD1_MASK | Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.META_MASK),
        );
        const shift = this._options(event).shift;
        const enter = [Clutter.KEY_Return, Clutter.KEY_KP_Enter].includes(symbol);
        if (this._dragging && symbol !== Clutter.KEY_Escape) return Clutter.EVENT_STOP;
        if (this._textEdit) return this._textKey(symbol, enter, shift);
        if (symbol === Clutter.KEY_Escape) {
            if (this.editor.escape() === 'close') {
                this.onCancel();
                return Clutter.EVENT_STOP;
            }
        } else if (!this._runShortcut(symbol, { ctrl, alt, shift, enter }, start)) {
            if (global.focus_manager.navigate_from_event(event)) return Clutter.EVENT_STOP;
            return Clutter.EVENT_PROPAGATE;
        }
        // An export shortcut may close the overlay before it returns.
        if (!this._destroyed) this._refresh();
        return Clutter.EVENT_STOP;
    }

    _textKey(symbol, enter, shift) {
        if (symbol === Clutter.KEY_Escape || (enter && !shift)) {
            this._finishText(symbol !== Clutter.KEY_Escape);
            this._refresh();
            return Clutter.EVENT_STOP;
        }
        // Native Clutter.Text handles input methods, selection, clipboard and Shift+Enter.
        return Clutter.EVENT_PROPAGATE;
    }

    // Returns false when the key is not an editor shortcut, so the caller can fall back to focus navigation.
    _runShortcut(symbol, { ctrl, alt, shift, enter }, start) {
        if (ctrl && this._runCtrlShortcut(symbol, shift, start)) return true;
        if (symbol === Clutter.KEY_Delete) {
            this.editor.deleteSelected();
            return true;
        }
        if (enter) {
            this._export(this.enterAction(), start);
            return true;
        }
        const delta = arrowDelta(symbol);
        if (delta) {
            this.editor.nudge(...delta, shift);
            return true;
        }
        if (!ctrl && !alt && this.editor.selection && !this._textEdit && !this._dragging && !this._busy) {
            const tool = toolForKey(String.fromCodePoint(Clutter.keysym_to_unicode(symbol)));
            if (tool !== undefined) {
                this.editor.setTool(tool.id);
                this.actor.grab_key_focus();
                return true;
            }
        }
        return false;
    }

    _runCtrlShortcut(symbol, shift, start) {
        switch (symbol) {
            case Clutter.KEY_c:
            case Clutter.KEY_C:
                this._export('copy', start);
                return true;
            case Clutter.KEY_s:
            case Clutter.KEY_S:
                this._export('save', start);
                return true;
            case Clutter.KEY_a:
            case Clutter.KEY_A:
                this.editor.selectMonitor(this._point);
                return true;
            case Clutter.KEY_z:
            case Clutter.KEY_Z:
                this.editor[shift ? 'redo' : 'undo']();
                return true;
            default:
                return false;
        }
    }

    _startText(point, id = null) {
        const annotation = this.editor.annotations.find((a) => a.id === id);
        const style = annotation ?? this.editor.style;
        const position = annotation ? { x: annotation.x1, y: annotation.y1 } : point;
        const text = new Clutter.Text({
            text: annotation?.text ?? '',
            editable: true,
            selectable: true,
            reactive: true,
            single_line_mode: false,
            activatable: false,
        });
        text.set_font_description(textFont(style.width));
        const container = new St.Bin({ style_class: 'mirx-text-editor', child: text, reactive: true });
        const selection = this.editor.selection;
        this._textEdit = { actor: container, text, point: position, id };
        this.actor.add_child(container);
        const node = container.get_theme_node();
        const insetX = node.get_border_width(St.Side.LEFT) + node.get_padding(St.Side.LEFT);
        const insetY = node.get_border_width(St.Side.TOP) + node.get_padding(St.Side.TOP);
        container.set_position(position.x - insetX, position.y - insetY);
        container.set_clip(
            0,
            0,
            Math.max(1, selection.x + selection.width - position.x + insetX),
            Math.max(1, selection.y + selection.height - position.y + insetY),
        );
        // Clutter.Text ignores CSS colour, so copy it from the theme node.
        text.set_color(node.get_foreground_color());
        text.grab_key_focus();
        text.set_cursor_position(-1);
    }

    _finishText(commit) {
        const edit = this._textEdit;
        if (!edit) return;
        if (commit) {
            const text = edit.text.get_text();
            if (edit.id === null) this.editor.addText(edit.point, text);
            else this.editor.updateText(edit.id, text);
        }
        this._textEdit = null;
        edit.actor.destroy();
        this.actor.grab_key_focus();
    }

    _export(action, start) {
        if (this._busy) return;
        if (start === undefined) start = this.perfLog?.() ? GLib.get_monotonic_time() : null;
        this._finishText(true);
        this._refresh();
        this.onExport(
            action,
            start === null
                ? undefined
                : () => {
                      console.log(`mirx-perf export ms=${(GLib.get_monotonic_time() - start) / 1000}`);
                  },
        );
    }

    _updateDecorations() {
        const rect = decorationRect(this.editor);
        const W = this.actor.width,
            H = this.actor.height;
        if (rect) {
            const { x, y, width, height } = rect;
            const bands = [
                [0, 0, W, y],
                [0, y + height, W, H - y - height],
                [0, y, x, height],
                [x + width, y, W - x - width, height],
            ];
            this._shades.forEach((shade, i) => {
                const [sx, sy, sw, sh] = bands[i];
                shade.set_position(sx, sy);
                shade.set_size(Math.max(0, sw), Math.max(0, sh));
                shade.show();
            });
            this._frame.set_position(x, y);
            this._frame.set_size(width, height);
            this._frame.show();
            this._frameRing.set_position(x - 1, y - 1);
            this._frameRing.set_size(width + 2, height + 2);
            this._frameRing.show();
        } else {
            this._shades[0].set_position(0, 0);
            this._shades[0].set_size(W, H);
            this._shades[0].show();
            this._shades.slice(1).forEach((shade) => {
                shade.hide();
            });
            this._frame.hide();
            this._frameRing.hide();
        }
        const selection = this.editor.selection;
        if (selection) {
            handles(selection).forEach(({ x, y }, i) => {
                this._handles[i].set_position(x - 5, y - 5);
                this._handles[i].show();
            });
        } else {
            this._handles.forEach((handle) => {
                handle.hide();
            });
        }
    }

    _refresh() {
        const { selection, monitor } = this.editor;
        if (selection) {
            this._toolbar.update(this.editor);
            // The toolbar size follows the tool and style labels, so those also trigger a new placement.
            const placement = JSON.stringify([selection, this.editor.tool, this.editor.style, this.editor.selectedId]);
            if (placement !== this._placedFor) {
                this._toolbar.place(selection, monitor);
                this._placedFor = placement;
            }
            const physical = physicalRect(selection, monitor.scale);
            this._dimensions.text = `${physical.width} × ${physical.height}`;
            this._dimensions.show();
            const [, w] = this._dimensions.get_preferred_width(-1);
            const [, h] = this._dimensions.get_preferred_height(w);
            this._dimensions.set_position(
                Math.max(monitor.x, Math.min(selection.x, monitor.x + monitor.width - w)),
                Math.max(monitor.y, selection.y - h - 4),
            );
            this._hint.hide();
        } else {
            this._placedFor = null;
            this._toolbar.actor.hide();
            this._tooltip.hideNow();
            const m = this.snapshot.monitors.find((item) => contains(item, this._point)) ?? this.snapshot.monitors[0];
            this._hint.set_position(m.x + 20, m.y + 20);
        }
        const pointerMonitor = this.snapshot.monitors.find((item) => contains(item, this._point));
        // The guides and the magnifier share one point, monitor and visibility condition.
        const aidPoint = this._pointer ?? this._point;
        const aidVisible =
            !this._busy &&
            !this._textEdit &&
            (!this.editor.tool || this.editor.tool === 'select' || this._selectionDrag) &&
            (!selection || this._selectionDrag);
        this._magnifier.update(aidPoint, pointerMonitor, aidVisible);
        this._guides.update(aidPoint, pointerMonitor, aidVisible);
        // Re-pick after placement and key changes, even if the pointer has not moved.
        const source = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, this._point.x, this._point.y);
        this._control = this._controlAt(source);
        const cursor = cursorFor({
            target: this.editor.hitTarget(this._point),
            tool: this.editor.tool,
            interaction: this.editor.interaction,
            interactionHandle: this.editor.interactionHandle,
            control: this._control,
        });
        // The GPU mark supplies the capture crosshair; keep normal control and gesture cursors.
        const customCrosshair = cursor === 'crosshair' && aidVisible && pointerMonitor;
        this.actor.set_cursor_type(customCrosshair ? Clutter.CursorType.NONE : cursorType(cursor));
        this._updateDecorations();
        // Each repaint is a software render plus a GPU upload of the whole canvas, so the canvases
        // cover only what they draw and the committed layer repaints only when its content changes.
        const { annotations, draft } = this.editor;
        this._annotations.update(annotations, selection, this._textEdit?.id ?? null);
        // The arrow head and the stroke reach past the draft's corner points.
        this._draft.update(draft?.type ? [draft] : [], selection);
        this._annotationDecorations.update(this.editor);
    }

    // Capture is synchronous: restore the exact UI state even when capture fails.
    withExportContent(callback) {
        // A newly shown or resized canvas may still need allocation. Asking for
        // its allocation forces pending stage layout and any allocation repaint.
        this._annotations.prepareExport();
        const actors = [
            ...this._shades,
            this._annotationDecorations.actor,
            this._draft.actor,
            this._guides.actor,
            this._frameRing,
            this._frame,
            ...this._handles,
            this._dimensions,
            this._hint,
            this._error,
            this._toolbar.actor,
            this._tooltip.actor,
            this._magnifier.actor,
            this._textEdit?.actor,
        ].filter(Boolean);
        const visibility = actors.map((actor) => actor.visible);
        const tooltipOpacity = this._tooltip.actor.opacity;
        this._tooltip.hideNow();
        try {
            actors.forEach((actor) => {
                actor.hide();
            });
            return callback();
        } finally {
            this._tooltip.actor.opacity = tooltipOpacity;
            actors.forEach((actor, i) => {
                if (visibility[i]) actor.show();
                else actor.hide();
            });
        }
    }

    setBusy(busy) {
        this._busy = busy;
        if (busy) this._tooltip.hideNow();
        this._refresh();
    }

    showError(message) {
        const monitor = this.editor.monitor ?? this.snapshot.monitors[0];
        this._error.text = `Could not export: ${message}`;
        this._error.width = Math.min(600, monitor.width - 40);
        this._error.set_position(monitor.x + 20, monitor.y + 20);
        this._error.show();
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        if (this._focusGroup) {
            global.focus_manager.remove_group(this.actor);
            this._focusGroup = false;
        }
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        this._tooltip.destroy();
        this._toolbar.destroy();
        this.actor.destroy();
        const parent = this._group?.get_parent();
        if (parent && (!this._previousSibling || this._previousSibling.get_parent() === parent))
            parent.set_child_above_sibling(this._group, this._previousSibling);
        this.snapshot = null;
        this.editor = null;
    }
}
