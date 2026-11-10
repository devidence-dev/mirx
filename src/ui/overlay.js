import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {contains} from '../core/geometry.js';
import {renderAnnotations} from '../rendering/annotations.js';
import {drawDecorations} from './decorations.js';
import {Magnifier} from './magnifier.js';
import {Toolbar} from './toolbar.js';

/** Translates Shell events into editor actions, and presents the frozen session. */
export class Overlay {
    constructor({snapshot, editor, onCancel, onExport, enterAction}) {
        Object.assign(this, {snapshot, editor, onCancel, onExport, enterAction});
        this._busy = false;
        this._dragging = false;
        this._selectionDrag = false;
        this._textEdit = null;
        this._grab = null;
        this._lastClick = null;
        const [x, y] = global.get_pointer();
        this._point = {x, y};
        const width = global.stage.width, height = global.stage.height;
        this.actor = new St.Widget({name: 'mirx-overlay', reactive: true, can_focus: true,
            width, height});
        this.actor.add_child(new Clutter.Actor({content: snapshot.content, width, height}));
        this._canvas = new St.DrawingArea({width, height});
        this._canvas.connect('repaint', area => this._paint(area));
        this.actor.add_child(this._canvas);

        this._dimensions = new St.Label({style_class: 'mirx-dimensions', visible: false});
        this.actor.add_child(this._dimensions);
        this._hint = new St.Label({text: 'Arrastra un área · Clic: ventana · Ctrl+A: monitor · Esc: cancelar',
            style_class: 'mirx-hint'});
        this.actor.add_child(this._hint);
        this._error = new St.Label({style_class: 'mirx-error', visible: false});
        this._error.clutter_text.set_line_wrap(true);
        this.actor.add_child(this._error);
        const change = callback => {
            if (this._busy)
                return;
            this._finishText(true);
            callback();
            this.actor.grab_key_focus();
            this._refresh();
        };
        this._toolbar = new Toolbar({
            onTool: tool => change(() => editor.setTool(tool)),
            onStyle: style => change(() => editor.setStyle(style)),
            onUndo: () => change(() => editor.undo()),
            onRedo: () => change(() => editor.redo()),
            onExport: action => this._export(action),
            onCancel: () => { if (!this._busy) onCancel(); },
        });
        this.actor.add_child(this._toolbar.actor);
        this._magnifier = new Magnifier(snapshot, width, height);
        this.actor.add_child(this._magnifier.actor);
        this.actor.connect('button-press-event', (_actor, event) => this._press(event));
        this.actor.connect('button-release-event', (_actor, event) => this._release(event));
        this.actor.connect('motion-event', (_actor, event) => this._motion(event));
        this.actor.connect('captured-event', (_actor, event) => {
            if (event.type() === Clutter.EventType.KEY_PRESS)
                return this._key(event);
            if (this._dragging && event.type() === Clutter.EventType.MOTION)
                return this._motion(event);
            if (this._dragging && event.type() === Clutter.EventType.BUTTON_RELEASE)
                return this._release(event);
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
        this._grab = Main.pushModal(this.actor, {actionMode: Shell.ActionMode.SYSTEM_MODAL});
        if (this._grab.is_revoked())
            throw new Error('No se pudo obtener el control del teclado y el ratón');
        global.focus_manager.add_group(this.actor);
        this._focusGroup = true;
        this.editor.pointerMove(this._point);
        this._refresh();
    }

    _pointOf(event) {
        const [x, y] = event.get_coords();
        return {x: Math.round(x), y: Math.round(y)};
    }

    _options(event) {
        return {shift: Boolean(event.get_state() & Clutter.ModifierType.SHIFT_MASK)};
    }

    _isControl(event) {
        const source = global.stage.get_event_actor(event);
        return this._toolbar.actor.contains(source) ||
            (this._textEdit && this._textEdit.actor.contains(source));
    }

    _press(event) {
        if (this._busy)
            return Clutter.EVENT_STOP;
        if (event.get_button() !== Clutter.BUTTON_PRIMARY || this._isControl(event))
            return Clutter.EVENT_PROPAGATE;
        this._finishText(true);
        this.actor.grab_key_focus();
        this._point = this._pointOf(event);
        const time = event.get_time();
        const previous = this._lastClick;
        const doubleClick = previous && time >= previous.time && time - previous.time < 400 &&
            Math.hypot(previous.x - this._point.x, previous.y - this._point.y) < 5;
        this._lastClick = {...this._point, time};
        const result = this.editor.pointerDown(this._point,
            {...this._options(event), clickCount: doubleClick ? 2 : 1});
        this._selectionDrag = ['select', 'selection-resize'].includes(this.editor.interaction);
        this._dragging = !result;
        if (result?.newText)
            this._startText(result.newText);
        else if (result?.editText !== undefined)
            this._startText(null, result.editText);
        this._refresh();
        return Clutter.EVENT_STOP;
    }

    _release(event) {
        if (!this._dragging || event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;
        this._point = this._pointOf(event);
        this.editor.pointerUp(this._point, this._options(event));
        this._dragging = this._selectionDrag = false;
        this._refresh();
        return Clutter.EVENT_STOP;
    }

    _motion(event) {
        if (this._busy)
            return Clutter.EVENT_STOP;
        this._point = this._pointOf(event);
        if (!this._isControl(event) || this._dragging)
            this.editor.pointerMove(this._point, this._options(event));
        this._refresh();
        return this._dragging ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
    }

    _key(event) {
        if (this._busy)
            return Clutter.EVENT_STOP;
        const symbol = event.get_key_symbol();
        const ctrl = Boolean(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
        const shift = this._options(event).shift;
        const enter = [Clutter.KEY_Return, Clutter.KEY_KP_Enter].includes(symbol);
        if (this._dragging && symbol !== Clutter.KEY_Escape)
            return Clutter.EVENT_STOP;
        if (this._textEdit) {
            if (symbol === Clutter.KEY_Escape || (enter && !shift)) {
                this._finishText(symbol !== Clutter.KEY_Escape);
                this._refresh();
                return Clutter.EVENT_STOP;
            }
            // Native Clutter.Text handles input methods, selection, clipboard and Shift+Enter.
            return Clutter.EVENT_PROPAGATE;
        }
        if (symbol === Clutter.KEY_Escape) {
            if (this.editor.escape() === 'close') {
                this.onCancel();
                return Clutter.EVENT_STOP;
            }
        } else if (ctrl && [Clutter.KEY_c, Clutter.KEY_C].includes(symbol)) {
            this._export('copy');
        } else if (ctrl && [Clutter.KEY_s, Clutter.KEY_S].includes(symbol)) {
            this._export('save');
        } else if (ctrl && [Clutter.KEY_a, Clutter.KEY_A].includes(symbol)) {
            this.editor.selectMonitor(this._point);
        } else if (ctrl && [Clutter.KEY_z, Clutter.KEY_Z].includes(symbol)) {
            this.editor[shift ? 'redo' : 'undo']();
        } else if (symbol === Clutter.KEY_Delete) {
            this.editor.deleteSelected();
        } else if (enter) {
            this._export(this.enterAction());
        } else {
            const arrows = new Map([
                [Clutter.KEY_Left, [-1, 0]], [Clutter.KEY_Right, [1, 0]],
                [Clutter.KEY_Up, [0, -1]], [Clutter.KEY_Down, [0, 1]],
            ]);
            const delta = arrows.get(symbol);
            if (!delta) {
                if (global.focus_manager.navigate_from_event(event))
                    return Clutter.EVENT_STOP;
                return Clutter.EVENT_PROPAGATE;
            }
            this.editor.nudge(...delta, shift);
        }
        this._refresh();
        return Clutter.EVENT_STOP;
    }

    _startText(point, id = null) {
        const annotation = this.editor.annotations.find(a => a.id === id);
        const style = annotation ?? this.editor.style;
        const position = annotation ? {x: annotation.x1, y: annotation.y1} : point;
        const text = new Clutter.Text({text: annotation?.text ?? '',
            editable: true, selectable: true, reactive: true,
            single_line_mode: false, activatable: false});
        const font = Pango.FontDescription.from_string('Sans');
        font.set_absolute_size(Math.max(14, style.width * 5) * Pango.SCALE);
        text.set_font_description(font);
        const container = new St.Bin({style_class: 'mirx-text-editor', child: text,
            x: position.x, y: position.y, reactive: true});
        const selection = this.editor.selection;
        container.set_clip(0, 0, Math.max(1, selection.x + selection.width - position.x),
            Math.max(1, selection.y + selection.height - position.y));
        this._textEdit = {actor: container, text, point: position, id};
        this.actor.add_child(container);
        text.grab_key_focus();
        text.set_cursor_position(-1);
    }

    _finishText(commit) {
        const edit = this._textEdit;
        if (!edit)
            return;
        if (commit) {
            const text = edit.text.get_text();
            if (edit.id === null)
                this.editor.addText(edit.point, text);
            else
                this.editor.updateText(edit.id, text);
        }
        this._textEdit = null;
        edit.actor.destroy();
        this.actor.grab_key_focus();
    }

    _export(action) {
        if (this._busy)
            return;
        this._finishText(true);
        this.onExport(action);
    }

    _paint(area) {
        const cr = area.get_context();
        try {
            const selection = this.editor.selection;
            if (selection) {
                cr.save();
                cr.rectangle(selection.x, selection.y, selection.width, selection.height);
                cr.clip();
                const annotations = this.editor.annotations.filter(a => a.id !== this._textEdit?.id);
                if (this.editor.draft?.type)
                    annotations.push(this.editor.draft);
                renderAnnotations(cr, annotations, this.snapshot);
                cr.restore();
            }
            drawDecorations(cr, this.editor, this.actor.width, this.actor.height);
        } finally {
            cr.$dispose();
        }
    }

    _refresh() {
        const {selection, monitor} = this.editor;
        if (selection) {
            this._toolbar.update(this.editor);
            this._toolbar.place(selection, monitor);
            this._dimensions.text = `${Math.round(selection.width * monitor.scale)} × ${Math.round(selection.height * monitor.scale)}`;
            this._dimensions.show();
            const [, w] = this._dimensions.get_preferred_width(-1);
            const [, h] = this._dimensions.get_preferred_height(w);
            this._dimensions.set_position(Math.max(monitor.x, Math.min(selection.x, monitor.x + monitor.width - w)),
                Math.max(monitor.y, selection.y - h - 4));
            this._hint.hide();
        } else {
            const m = this.snapshot.monitors.find(item => contains(item, this._point)) ?? this.snapshot.monitors[0];
            this._hint.set_position(m.x + 20, m.y + 20);
        }
        const pointerMonitor = this.snapshot.monitors.find(item => contains(item, this._point));
        this._magnifier.update(this._point, pointerMonitor,
            !this._busy && !this._textEdit && (!this.editor.tool || this._selectionDrag) &&
            (!selection || this._selectionDrag));
        this.actor.set_cursor_type(this.editor.tool === 'text' ? Clutter.CursorType.TEXT :
            this.editor.tool || !selection ? Clutter.CursorType.CROSSHAIR : Clutter.CursorType.DEFAULT);
        this._canvas.queue_repaint();
    }

    setBusy(busy) {
        this._busy = busy;
        this._refresh();
    }

    showError(message) {
        const monitor = this.editor.monitor ?? this.snapshot.monitors[0];
        this._error.text = `No se pudo exportar: ${message}`;
        this._error.width = Math.min(600, monitor.width - 40);
        this._error.set_position(monitor.x + 20, monitor.y + 20);
        this._error.show();
    }

    destroy() {
        if (this._focusGroup) {
            global.focus_manager.remove_group(this.actor);
            this._focusGroup = false;
        }
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        this.actor.destroy();
        const parent = this._group?.get_parent();
        if (parent && (!this._previousSibling || this._previousSibling.get_parent() === parent))
            parent.set_child_above_sibling(this._group, this._previousSibling);
        this.snapshot = null;
        this.editor = null;
    }
}
