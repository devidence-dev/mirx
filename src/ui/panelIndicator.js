import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const PanelIndicator = GObject.registerClass(
    class PanelIndicator extends PanelMenu.Button {
        _init({ icon, shortcut, onScreenshot, onPreferences }) {
            super._init(0.0, 'mirx');
            this.add_child(new St.Icon({ gicon: Gio.icon_new_for_string(icon), style_class: 'system-status-icon' }));
            // PopupMenuItem has no accelerator API in Shell 50: the hint is a dimmed label pushed to the right.
            const screenshot = new PopupMenu.PopupMenuItem('Take screenshot');
            this._shortcut = new St.Label({
                style_class: 'popup-inactive-menu-item',
                x_expand: true,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
            });
            screenshot.add_child(this._shortcut);
            screenshot.connect('activate', () => {
                this.menu.close(BoxPointer.PopupAnimation.NONE);
                onScreenshot();
            });
            this.menu.addMenuItem(screenshot);
            this.setShortcut(shortcut);
            this.menu.addAction('Preferences', onPreferences);
        }

        setShortcut(text) {
            this._shortcut.text = text;
            this._shortcut.visible = text !== '';
        }
    },
);

export function createPanelIndicator(options) {
    return new PanelIndicator(options);
}
