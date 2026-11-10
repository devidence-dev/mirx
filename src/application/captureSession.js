/** Coordinates one editor session through injected capture, view and output ports. */
export class CaptureSession {
    constructor({capture, createEditor, createView, output, settings, notifyError}) {
        Object.assign(this, {capture, createEditor, createView, output, settings, notifyError});
        this._generation = 0;
        this._active = false;
        this._exporting = false;
        this._disposed = false;
        this._view = null;
    }

    async open() {
        if (this._active || this._disposed)
            return;
        this._active = true;
        const generation = ++this._generation;
        try {
            const snapshot = await this.capture.capture();
            if (generation !== this._generation)
                return;
            const config = this.settings();
            const editor = this.createEditor({
                monitors: snapshot.monitors, windows: snapshot.windows,
                color: config.color, width: config.width,
            });
            this._view = this.createView({snapshot, editor,
                onCancel: () => this.close(),
                onExport: action => this.export(action, snapshot, editor),
                enterAction: () => this.settings().enterAction,
            });
            this._view.open();
        } catch (error) {
            if (generation === this._generation) {
                this.close();
                this.notifyError('No se pudo capturar la pantalla', error.message);
            }
        }
    }

    async export(action, snapshot, editor) {
        if (!this._active || !editor.selection || this._exporting)
            return;
        const generation = this._generation;
        const operation = {isCancelled: () => generation !== this._generation};
        this._exporting = true;
        this._view?.setBusy(true);
        try {
            if (action === 'save')
                await this.output.save(snapshot, editor.selection, editor.annotations,
                    editor.monitor, this.settings(), operation);
            else if (action === 'copy')
                await this.output.copy(snapshot, editor.selection, editor.annotations, editor.monitor, operation);
            else
                throw new Error(`Acción desconocida: ${action}`);
            if (generation === this._generation)
                this.close();
        } catch (error) {
            if (generation === this._generation) {
                this._view?.showError?.(error.message);
                this.notifyError('No se pudo exportar la captura', error.message);
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
        this._view?.destroy();
        this._view = null;
        this._active = false;
        this._exporting = false;
    }

    destroy() {
        this._disposed = true;
        this.close();
    }
}
