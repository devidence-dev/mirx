import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import St from 'gi://St';

const TOOLS = [
    [null, '↖', 'Seleccionar y mover'], ['arrow', '↗', 'Flecha'],
    ['rectangle', '□', 'Rectángulo'], ['circle', '○', 'Elipse (Shift: círculo)'],
    ['highlighter', '▰', 'Resaltador'], ['pixelate', '▦', 'Pixelar'], ['text', 'T', 'Texto'],
];
const COLORS = [
    ['#ff0000', 'Rojo'], ['#ffcc00', 'Amarillo'], ['#00cc66', 'Verde'],
    ['#0088ff', 'Azul'], ['#cc55ff', 'Violeta'], ['#ffffff', 'Blanco'], ['#000000', 'Negro'],
];

export class Toolbar {
    constructor({onTool, onStyle, onUndo, onRedo, onExport, onCancel}) {
        this.actor = new St.BoxLayout({style_class: 'mirx-toolbar', reactive: true,
            orientation: Clutter.Orientation.VERTICAL, visible: false});
        // shortcut: the blur is a rectangle and ignores border-radius, use a rounded-clip shader if the corners show.
        this.actor.add_effect(new Shell.BlurEffect({mode: Shell.BlurMode.BACKGROUND,
            radius: 30, brightness: 0.75}));
        this._tools = new Map();
        this._colors = new Map();
        const tools = new St.BoxLayout({style_class: 'mirx-row'});
        this.actor.add_child(tools);
        this._toolLabel = new St.Label({style_class: 'mirx-tool-label'});
        for (const [tool, label, name] of TOOLS) {
            const button = this._button(label, name, () => onTool(tool));
            button.connect('enter-event', () => {
                this._toolLabel.text = name;
                return Clutter.EVENT_PROPAGATE;
            });
            tools.add_child(button);
            this._tools.set(tool, button);
        }
        tools.add_child(this._button('↶', 'Deshacer (Ctrl+Z)', onUndo));
        tools.add_child(this._button('↷', 'Rehacer (Ctrl+Shift+Z)', onRedo));
        this.actor.add_child(this._toolLabel);

        const style = new St.BoxLayout({style_class: 'mirx-row'});
        this.actor.add_child(style);
        for (const [color, name] of COLORS) {
            const button = this._button(' ', name, () => onStyle({color}));
            button.add_style_class_name('mirx-swatch');
            button.set_style(`background-color: ${color};`);
            style.add_child(button);
            this._colors.set(color, button);
        }
        style.add_child(this._button('−', 'Reducir grosor', () => onStyle({width: Math.max(1, this._width - 1)})));
        this._widthLabel = new St.Label({text: '3 px', y_align: Clutter.ActorAlign.CENTER});
        style.add_child(this._widthLabel);
        style.add_child(this._button('+', 'Aumentar grosor', () => onStyle({width: Math.min(30, this._width + 1)})));

        const actions = new St.BoxLayout({style_class: 'mirx-row'});
        this.actor.add_child(actions);
        actions.add_child(this._button('Copiar', 'Copiar (Ctrl+C)', () => onExport('copy')));
        actions.add_child(this._button('Guardar', 'Guardar (Ctrl+S)', () => onExport('save')));
        actions.add_child(this._button('Cancelar', 'Cancelar (Esc)', onCancel));
    }

    _button(label, name, callback) {
        const button = new St.Button({label, accessible_name: name,
            style_class: 'mirx-button', can_focus: true});
        button.connect('clicked', callback);
        return button;
    }

    update(editor) {
        const selected = editor.annotations.find(a => a.id === editor.selectedId);
        const style = selected ?? editor.style;
        this._toolLabel.text = TOOLS.find(([tool]) => tool === editor.tool)?.[2] ?? '';
        this._width = style.width;
        this._widthLabel.text = `${style.width} px`;
        for (const [tool, button] of this._tools)
            button[tool === editor.tool ? 'add_style_pseudo_class' : 'remove_style_pseudo_class']('checked');
        for (const [color, button] of this._colors)
            button[color === style.color ? 'add_style_pseudo_class' : 'remove_style_pseudo_class']('checked');
    }

    place(selection, monitor) {
        this.actor.show();
        const [, width] = this.actor.get_preferred_width(-1);
        const [, height] = this.actor.get_preferred_height(width);
        const scale = Math.min(1, (monitor.width - 12) / width, (monitor.height - 12) / height);
        this.actor.set_pivot_point(0, 0);
        this.actor.set_scale(scale, scale);
        const w = width * scale, h = height * scale;
        const x = Math.max(monitor.x + 6,
            Math.min(selection.x, monitor.x + monitor.width - w - 6));
        let y = selection.y + selection.height + 10;
        if (y + h > monitor.y + monitor.height - 6)
            y = selection.y - h - 10;
        if (y < monitor.y + 6)
            y = Math.max(monitor.y + 6, Math.min(selection.y + 10, monitor.y + monitor.height - h - 6));
        this.actor.set_position(x, y);
    }
}
