export class PanelIndicatorController {
    constructor({ isVisible, shortcutLabel, create, defer, openCapture, openPreferences }) {
        this._isVisible = isVisible;
        this._shortcutLabel = shortcutLabel;
        this._create = create;
        this._defer = defer;
        this._openCapture = openCapture;
        this._openPreferences = openPreferences;
        this._indicator = null;
        this._cancelCapture = null;
        this._disposed = false;
    }

    sync() {
        if (this._disposed) return;
        if (this._isVisible()) {
            if (!this._indicator) {
                this._indicator = this._create({
                    shortcut: this._shortcutLabel(),
                    onScreenshot: () => this.screenshot(),
                    onPreferences: () => {
                        if (!this._disposed) this._openPreferences();
                    },
                });
            }
        } else if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    syncShortcut() {
        if (!this._disposed) this._indicator?.setShortcut(this._shortcutLabel());
    }

    screenshot() {
        if (this._disposed) return;
        this._cancelCapture?.();
        this._cancelCapture = this._defer(() => {
            this._cancelCapture = null;
            if (!this._disposed) this._openCapture();
        });
    }

    destroy() {
        if (this._disposed) return;
        this._disposed = true;
        this._cancelCapture?.();
        this._cancelCapture = null;
        this._indicator?.destroy();
        this._indicator = null;
    }
}
