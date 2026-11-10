import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MirxPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const signalIds = [];
        const watch = (signal, callback) => signalIds.push(settings.connect(signal, callback));
        window.connect('close-request', () => {
            for (const id of signalIds.splice(0)) settings.disconnect(id);
            return false;
        });
        const page = new Adw.PreferencesPage();
        const general = new Adw.PreferencesGroup({title: 'Captura'});
        page.add(general);
        window.add(page);

        const shortcut = new Adw.ActionRow({title: 'Atajo de teclado'});
        const shortcutButton = new Gtk.Button({valign: Gtk.Align.CENTER});
        const updateShortcut = () => {
            const value = settings.get_strv('shortcut')[0];
            const [valid, key, mods] = Gtk.accelerator_parse(value ?? '');
            shortcutButton.label = valid ? Gtk.accelerator_get_label(key, mods) : 'Sin asignar';
        };
        updateShortcut();
        watch('changed::shortcut', updateShortcut);
        shortcutButton.connect('clicked', () => {
            const dialog = new Gtk.Dialog({title: 'Cambiar atajo', transient_for: window, modal: true});
            dialog.add_button('Cancelar', Gtk.ResponseType.CANCEL);
            const label = new Gtk.Label({label: 'Pulsa una combinación con Ctrl, Alt o Super.', margin_top: 24, margin_bottom: 24, margin_start: 24, margin_end: 24});
            dialog.get_content_area().append(label);
            const controller = new Gtk.EventControllerKey({propagation_phase: Gtk.PropagationPhase.CAPTURE});
            controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
                if (keyval === Gdk.KEY_Escape) {
                    dialog.close();
                    return true;
                }
                const modifiers = state & Gtk.accelerator_get_default_mod_mask();
                const required = Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.ALT_MASK | Gdk.ModifierType.SUPER_MASK | Gdk.ModifierType.META_MASK;
                if ((modifiers & required) && Gtk.accelerator_valid(keyval, modifiers)) {
                    settings.set_strv('shortcut', [Gtk.accelerator_name(keyval, modifiers)]);
                    dialog.close();
                } else {
                    label.label = 'Combinación no válida. Usa Ctrl, Alt o Super con otra tecla.';
                }
                return true;
            });
            dialog.add_controller(controller);
            dialog.connect('response', () => dialog.close());
            dialog.present();
        });
        shortcut.add_suffix(shortcutButton);
        shortcut.activatable_widget = shortcutButton;
        general.add(shortcut);

        const addChoice = (title, key, values, labels) => {
            const row = new Adw.ComboRow({title, model: Gtk.StringList.new(labels)});
            const update = () => { row.selected = Math.max(0, values.indexOf(settings.get_string(key))); };
            update();
            watch(`changed::${key}`, update);
            row.connect('notify::selected', () => settings.set_string(key, values[row.selected]));
            general.add(row);
        };
        addChoice('Acción de Enter', 'enter-action', ['copy', 'save'], ['Copiar', 'Guardar']);
        addChoice('Formato de imagen', 'format', ['PNG', 'JPG'], ['PNG', 'JPG']);

        const folder = new Adw.EntryRow({title: 'Carpeta de capturas'});
        folder.text = settings.get_string('folder');
        folder.connect('changed', () => {
            if (folder.text.startsWith('/') || folder.text.startsWith('~/')) {
                folder.remove_css_class('error');
                settings.set_string('folder', folder.text);
            } else {
                folder.add_css_class('error');
            }
        });
        watch('changed::folder', () => { if (folder.text !== settings.get_string('folder')) folder.text = settings.get_string('folder'); });
        general.add(folder);

        const appearance = new Adw.PreferencesGroup({title: 'Anotaciones'});
        page.add(appearance);
        const color = new Adw.EntryRow({title: 'Color predeterminado (hexadecimal, por ejemplo #ff0000)'});
        color.text = settings.get_string('default-color');
        color.connect('changed', () => {
            if (/^#[0-9a-fA-F]{6}$/.test(color.text)) {
                settings.set_string('default-color', color.text);
                color.remove_css_class('error');
            } else {
                color.add_css_class('error');
            }
        });
        watch('changed::default-color', () => { if (color.text !== settings.get_string('default-color')) color.text = settings.get_string('default-color'); });
        appearance.add(color);
        const width = new Adw.SpinRow({title: 'Grosor predeterminado (px)', adjustment: new Gtk.Adjustment({lower: 1, upper: 30, step_increment: 1, page_increment: 5})});
        width.value = settings.get_int('default-width');
        width.connect('notify::value', () => settings.set_int('default-width', Math.round(width.value)));
        watch('changed::default-width', () => { width.value = settings.get_int('default-width'); });
        appearance.add(width);
    }
}
