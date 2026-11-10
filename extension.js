import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { formatAccelerator } from './src/core/accelerator.js';
import { Editor } from './src/core/editor.js';
import { CaptureSession } from './src/application/captureSession.js';
import { PanelIndicatorController } from './src/application/panelIndicator.js';
import { readAppearance, writeAppearance } from './src/platform/appearanceSettings.js';
import { ScreenCapture } from './src/platform/capture.js';
import { GpuImageOutput } from './src/platform/gpuExport.js';
import { Overlay } from './src/ui/overlay.js';
import { createPanelIndicator } from './src/ui/panelIndicator.js';
import { measureText } from './src/rendering/annotations.js';

export default class MirxExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._session = new CaptureSession({
            capture: new ScreenCapture(),
            createEditor: (options) =>
                new Editor({ ...options, measureText: ({ text, width }) => measureText(text, width) }),
            createView: (options) =>
                new Overlay({
                    ...options,
                    iconDir: `${this.path}/icons/tools`,
                    perfLog: () => this._settings.get_boolean('perf-log'),
                }),
            output: new GpuImageOutput({ notify: (title, body) => Main.notify(title, body) }),
            settings: () => ({
                ...readAppearance(this._settings),
                folder: this._settings.get_string('folder'),
                format: this._settings.get_string('format'),
                enterAction: this._settings.get_string('enter-action'),
            }),
            writePreferences: (patch) =>
                writeAppearance(this._settings, (type, value) => new GLib.Variant(type, value), patch),
            notifyError: (title, body) => Main.notifyError(title, body),
        });
        this._panelController = new PanelIndicatorController({
            isVisible: () => this._settings.get_boolean('show-panel-icon'),
            shortcutLabel: () => formatAccelerator(this._settings.get_strv('capture-shortcut')[0]),
            create: (actions) => {
                const indicator = createPanelIndicator({ icon: `${this.path}/icons/mirx-symbolic.svg`, ...actions });
                try {
                    Main.panel.addToStatusArea(this.uuid, indicator);
                } catch (error) {
                    indicator.destroy();
                    throw error;
                }
                return indicator;
            },
            defer: (callback) => {
                let id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    id = 0;
                    callback();
                    return GLib.SOURCE_REMOVE;
                });
                return () => {
                    if (id) GLib.Source.remove(id);
                    id = 0;
                };
            },
            openCapture: () => this._session.open(),
            openPreferences: () => this.openPreferences(),
        });
        this._panelController.sync();
        this._panelSettingsId = this._settings.connect('changed::show-panel-icon', () => this._panelController.sync());
        this._shortcutSettingsId = this._settings.connect('changed::capture-shortcut', () =>
            this._panelController.syncShortcut(),
        );
        // Keybinding names are global in GNOME Shell; Ubuntu Dock also registers 'shortcut' and removes it
        // when monitors change, so a generic name would silently drop ours.
        Main.wm.addKeybinding(
            'capture-shortcut',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => this._session.open(),
        );
        this._monitorId = Main.layoutManager.connect('monitors-changed', () => this._session.close());
        this._sessionId = Main.sessionMode.connect('updated', () => this._session.close());
    }

    disable() {
        if (this._panelSettingsId) this._settings.disconnect(this._panelSettingsId);
        this._panelSettingsId = null;
        if (this._shortcutSettingsId) this._settings.disconnect(this._shortcutSettingsId);
        this._shortcutSettingsId = null;
        this._panelController?.destroy();
        this._panelController = null;
        Main.wm.removeKeybinding('capture-shortcut');
        if (this._monitorId) Main.layoutManager.disconnect(this._monitorId);
        if (this._sessionId) Main.sessionMode.disconnect(this._sessionId);
        this._monitorId = this._sessionId = null;
        this._session?.destroy();
        this._session = null;
        this._settings = null;
    }
}
