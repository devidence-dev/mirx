/** Coordinates one editor session through injected capture, view and output ports. */
export class CaptureSession {
    constructor({
        capture,
        createEditor,
        createView,
        output,
        settings,
        writePreferences = () => {},
        notifyError,
        time = () => () => {},
    }) {
        Object.assign(this, {
            capture,
            createEditor,
            createView,
            output,
            settings,
            writePreferences,
            notifyError,
            time,
        });
        this._generation = 0;
        this._active = false;
        this._exporting = false;
        this._copies = 0;
        this._disposed = false;
        this._view = null;
    }

    async open() {
        if (this._active || this._disposed) return;
        this._active = true;
        const generation = ++this._generation;
        let preferenceFailureReported = false;
        const opened = this.time('open');
        try {
            const captured = this.time('open-capture');
            const snapshot = await this.capture.capture();
            captured();
            if (generation !== this._generation) return;
            const built = this.time('open-view');
            const config = this.settings();
            const editor = this.createEditor({
                monitors: snapshot.monitors,
                windows: snapshot.windows,
                color: config.color,
                width: config.width,
                gradient: config.gradient,
                toolWidths: config.toolWidths,
                onPreferenceChange: (patch) => {
                    if (generation !== this._generation || !this._active || this._disposed) return;
                    try {
                        this.writePreferences(patch);
                    } catch (error) {
                        if (!preferenceFailureReported) {
                            preferenceFailureReported = true;
                            this.notifyError('Could not save annotation preferences', error.message);
                        }
                    }
                },
            });
            this._view = this.createView({
                snapshot,
                editor,
                onCancel: () => this.close(),
                onExport: (action, onComplete) => this.export(action, snapshot, editor, onComplete),
                enterAction: () => this.settings().enterAction,
            });
            this._view.open();
            built();
            opened();
        } catch (error) {
            if (generation === this._generation) {
                this.close();
                this.notifyError('Could not capture the screen', error.message);
            }
        }
    }

    async export(action, snapshot, editor, onComplete) {
        if (!this._active || !editor.selection || this._exporting) return;
        const generation = this._generation;
        const view = this._view;
        const config = this.settings();
        // A slower, older copy must not overwrite the clipboard after a newer one; saves are never superseded.
        const copy = action === 'copy' ? ++this._copies : 0;
        // Once the output holds the pixels the overlay closes; encoding and delivery finish in the background.
        let captured = false;
        const operation = {
            onComplete,
            onCaptured: () => {
                if (generation !== this._generation) return;
                captured = true;
                this.close();
                closing();
            },
            isCancelled: () => (!captured && generation !== this._generation) || (copy > 0 && copy !== this._copies),
            withExportContent: (callback) => view.withExportContent(callback),
        };
        const total = this.time('session-export');
        const closing = this.time('export-to-close');
        this._exporting = true;
        this._view?.setBusy(true);
        try {
            if (action === 'save')
                await this.output.save(
                    snapshot,
                    editor.selection,
                    editor.annotations,
                    editor.monitor,
                    config,
                    operation,
                );
            else if (action === 'copy')
                await this.output.copy(snapshot, editor.selection, editor.annotations, editor.monitor, operation);
            else throw new Error(`Unknown action: ${action}`);
            total();
            if (generation === this._generation) this.close();
        } catch (error) {
            if (captured && !operation.isCancelled()) this.notifyError('Could not export the capture', error.message);
            else if (generation === this._generation) {
                this._view?.showError?.(error.message);
                this.notifyError('Could not export the capture', error.message);
            }
        } finally {
            if (generation === this._generation) {
                this._exporting = false;
                this._view?.setBusy(false);
            }
        }
    }

    close() {
        ++this._generation;
        const destroyed = this._view ? this.time('close-view') : null;
        this._view?.destroy();
        destroyed?.();
        this._view = null;
        this._active = false;
        this._exporting = false;
    }

    destroy() {
        this._disposed = true;
        this.close();
    }
}
