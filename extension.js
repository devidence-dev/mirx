import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Editor} from './src/core/editor.js';
import {CaptureSession} from './src/application/captureSession.js';
import {ScreenCapture} from './src/platform/capture.js';
import {GpuImageOutput} from './src/platform/gpuExport.js';
import {Overlay} from './src/ui/overlay.js';
import {measureText} from './src/rendering/annotations.js';

export default class MirxExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._session = new CaptureSession({
            capture: new ScreenCapture(),
            createEditor: options => new Editor({...options,
                measureText: ({text, width}) => measureText(text, width)}),
            createView: options => new Overlay({...options,
                perfLog: () => this._settings.get_boolean('perf-log')}),
            output: new GpuImageOutput({notify: (title, body) => Main.notify(title, body)}),
            settings: () => ({
                color: this._settings.get_string('default-color'),
                width: this._settings.get_int('default-width'),
                folder: this._settings.get_string('folder'),
                format: this._settings.get_string('format'),
                enterAction: this._settings.get_string('enter-action'),
            }),
            notifyError: (title, body) => Main.notifyError(title, body),
        });
        // Keybinding names are global in GNOME Shell; Ubuntu Dock also registers 'shortcut' and removes it
        // when monitors change, so a generic name would silently drop ours.
        Main.wm.addKeybinding('capture-shortcut', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, Shell.ActionMode.NORMAL,
            () => this._session.open());
        this._monitorId = Main.layoutManager.connect('monitors-changed', () => this._session.close());
        this._sessionId = Main.sessionMode.connect('updated', () => this._session.close());
    }

    disable() {
        Main.wm.removeKeybinding('capture-shortcut');
        if (this._monitorId)
            Main.layoutManager.disconnect(this._monitorId);
        if (this._sessionId)
            Main.sessionMode.disconnect(this._sessionId);
        this._monitorId = this._sessionId = null;
        this._session?.destroy();
        this._session = null;
        this._settings = null;
    }
}
