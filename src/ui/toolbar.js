import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';
import { ROW_GROUPS, TOOLS, tooltipText } from './toolbarModel.js';

export const GLASS_BLUR = true;
const SWATCH_SIZE = 28;
const COLORS = [
    ['#ff0000', 'Red'],
    ['#ffcc00', 'Yellow'],
    ['#00cc66', 'Green'],
    ['#0088ff', 'Blue'],
    ['#cc55ff', 'Violet'],
    ['#ffffff', 'White'],
    ['#000000', 'Black'],
];

export class Toolbar {
    constructor({ onTool, onStyle, onUndo, onRedo, onExport, onCancel, iconDir, tooltip, primaryAction }) {
        this._tooltip = tooltip;
        this._iconDir = iconDir;
        this._primaryAction = primaryAction ?? (() => 'copy');
        this.actor = new St.BoxLayout({
            style_class: 'mirx-toolbar',
            reactive: true,
            orientation: Clutter.Orientation.VERTICAL,
            visible: false,
        });
        this._scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._onTool = onTool;
        if (GLASS_BLUR) {
            const scale = this._scale;
            this.actor.add_effect(
                new Shell.BlurEffect({ mode: Shell.BlurMode.BACKGROUND, radius: 30 * scale, brightness: 0.75 }),
            );
        } else {
            this.actor.add_style_class_name('mirx-toolbar-solid');
        }
        this._tools = new Map();
        this._colors = new Map();
        const groups = {};
        for (const rowGroups of ROW_GROUPS) {
            const row = new St.BoxLayout({ style_class: 'mirx-row', x_align: Clutter.ActorAlign.CENTER });
            this.actor.add_child(row);
            rowGroups.forEach((name, index) => {
                if (index)
                    row.add_child(new St.Widget({ style_class: 'mirx-divider', y_align: Clutter.ActorAlign.CENTER }));
                groups[name] = new St.BoxLayout({ style_class: 'mirx-group' });
                row.add_child(groups[name]);
            });
        }
        for (const tool of TOOLS) {
            const button = this._button(
                tool.name,
                tool.icon,
                () => this._onTool(tool.id),
                tooltipText(tool.name, tool.key, tool.hint),
                'above',
            );
            groups.tools.add_child(button);
            this._tools.set(tool.id, button);
        }
        groups.history.add_child(
            this._button('Undo', 'undo-symbolic.svg', onUndo, tooltipText('Undo', 'Ctrl+Z'), 'above'),
        );
        groups.history.add_child(
            this._button('Redo', 'redo-symbolic.svg', onRedo, tooltipText('Redo', 'Ctrl+Shift+Z'), 'above'),
        );
        for (const [color, name] of COLORS) {
            const button = this._button(name, null, () => onStyle({ color }), name, 'below', 'mirx-swatch');
            // Explicit square size (not CSS) so border and fill-alignment cannot turn the circle into a pill.
            button.width = SWATCH_SIZE * this._scale;
            button.height = SWATCH_SIZE * this._scale;
            button.x_align = Clutter.ActorAlign.CENTER;
            button.y_align = Clutter.ActorAlign.CENTER;
            button.set_style(`background-color: ${color};`);
            groups.colors.add_child(button);
            this._colors.set(color, button);
        }
        this._decreaseWidth = this._button(
            'Decrease width',
            'minus-symbolic.svg',
            () => onStyle({ width: Math.max(1, this._width - 1) }),
            'Decrease width',
            'below',
        );
        groups.width.add_child(this._decreaseWidth);
        this._widthLabel = new St.Label({
            text: '3 px',
            style_class: 'mirx-width-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        groups.width.add_child(this._widthLabel);
        this._increaseWidth = this._button(
            'Increase width',
            'plus-symbolic.svg',
            () => onStyle({ width: Math.min(30, this._width + 1) }),
            'Increase width',
            'below',
        );
        groups.width.add_child(this._increaseWidth);
        this._gradient = this._button(
            'Gradient',
            'gradient-symbolic.svg',
            () => onStyle({ gradient: !this._gradientOn }),
            'Gradient',
            'below',
        );
        groups.gradient.add_child(this._gradient);
        this._copy = this._button(
            'Copy',
            'edit-copy-symbolic',
            () => onExport('copy'),
            () => tooltipText('Copy', `Ctrl+C${this._primaryAction() === 'copy' ? ', Enter' : ''}`),
            'below',
        );
        this._save = this._button(
            'Save',
            'document-save-symbolic',
            () => onExport('save'),
            () => tooltipText('Save', `Ctrl+S${this._primaryAction() === 'save' ? ', Enter' : ''}`),
            'below',
        );
        groups.actions.add_child(this._copy);
        groups.actions.add_child(this._save);
        groups.actions.add_child(
            this._button('Cancel', 'close-symbolic.svg', onCancel, tooltipText('Cancel', 'Esc'), 'below'),
        );
    }

    // `icon` is a bundled `*.svg` file name or a theme icon name; null leaves the button without a child.
    _button(name, icon, callback, text, side, styleClass = 'mirx-icon-button') {
        const button = new St.Button({
            accessible_name: name,
            style_class: `mirx-button ${styleClass}`,
            can_focus: true,
            track_hover: true,
        });
        if (icon) {
            const props = icon.endsWith('.svg')
                ? { gicon: Gio.icon_new_for_string(`${this._iconDir}/${icon}`) }
                : { icon_name: icon };
            button.set_child(new St.Icon({ ...props, icon_size: 18 }));
        }
        button.connect('clicked', callback);
        this._tooltip?.attach(button, text, side);
        return button;
    }

    _updateWidth(editor, selected) {
        const width =
            selected?.width ?? (editor.sizeTarget ? editor.style.width : (editor.fallbackWidth ?? editor.style.width));
        this._decreaseWidth.reactive = this._increaseWidth.reactive = Boolean(editor.sizeTarget);
        this._decreaseWidth.can_focus = this._increaseWidth.can_focus = Boolean(editor.sizeTarget);
        for (const button of [this._decreaseWidth, this._increaseWidth])
            button[editor.sizeTarget ? 'remove_style_pseudo_class' : 'add_style_pseudo_class']('disabled');
        this._width = width;
        this._widthLabel.text = `${width} px`;
    }

    update(editor) {
        const selected = editor.annotations.find((a) => a.id === editor.selectedId);
        const style = selected ?? editor.style;
        this._updateWidth(editor, selected);
        for (const [tool, button] of this._tools)
            button[tool === editor.tool ? 'add_style_pseudo_class' : 'remove_style_pseudo_class']('checked');
        for (const [color, button] of this._colors)
            button[color === style.color ? 'add_style_pseudo_class' : 'remove_style_pseudo_class']('checked');
        this._gradientOn = Boolean(editor.style.gradient);
        this._gradient[this._gradientOn ? 'add_style_pseudo_class' : 'remove_style_pseudo_class']('checked');
        const primary = this._primaryAction();
        this._copy[primary === 'copy' ? 'add_style_class_name' : 'remove_style_class_name']('mirx-primary');
        this._save[primary === 'save' ? 'add_style_class_name' : 'remove_style_class_name']('mirx-primary');
    }

    place(selection, monitor) {
        this.actor.show();
        const [, width] = this.actor.get_preferred_width(-1);
        const [, height] = this.actor.get_preferred_height(width);
        const scale = Math.min(1, (monitor.width - 12) / width, (monitor.height - 12) / height);
        this.actor.set_pivot_point(0, 0);
        this.actor.set_scale(scale, scale);
        const w = width * scale,
            h = height * scale;
        const x = Math.max(monitor.x + 6, Math.min(selection.x, monitor.x + monitor.width - w - 6));
        let y = selection.y + selection.height + 10;
        if (y + h > monitor.y + monitor.height - 6) y = selection.y - h - 10;
        if (y < monitor.y + 6)
            y = Math.max(monitor.y + 6, Math.min(selection.y + 10, monitor.y + monitor.height - h - 6));
        this.actor.set_position(x, y);
    }

    destroy() {
        if (!this.actor) return;
        this.actor.destroy();
        this.actor = null;
    }
}
