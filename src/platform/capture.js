import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/** Shell-only adapter: no portal, subprocess, cursor, or remote service. */
export class ScreenCapture {
    constructor({preparePixelation} = {}) {
        this._preparePixelation = preparePixelation;
    }

    async capture() {
        const monitors = Main.layoutManager.monitors.map((monitor, index) => ({
            x: monitor.x, y: monitor.y,
            width: monitor.width, height: monitor.height,
            scale: global.display.get_monitor_scale(index),
        }));
        if (!monitors.length)
            throw new Error('No monitors available');
        const workspace = global.workspace_manager.get_active_workspace();
        const windows = global.display.sort_windows_by_stacking(workspace.list_windows())
            .reverse()
            .filter(window => !window.minimized && window.showing_on_its_workspace() &&
                ![Meta.WindowType.DESKTOP, Meta.WindowType.DOCK].includes(window.get_window_type()))
            .map(window => {
                const frame = window.get_frame_rect();
                return {x: frame.x, y: frame.y, width: frame.width, height: frame.height};
            });
        const shooter = new Shell.Screenshot();
        const capturedAt = GLib.DateTime.new_now_local().format('%Y-%m-%d_%H-%M-%S');
        const [content, scale] = await new Promise((resolve, reject) => {
            shooter.screenshot_stage_to_content((source, result) => {
                try {
                    resolve(source.screenshot_stage_to_content_finish(result));
                } catch (error) {
                    reject(error);
                }
            });
        });
        const snapshot = {content, pixbuf: null, scale, monitors, windows, capturedAt};
        let pixbufReady;
        snapshot.ensurePixbuf = () => {
            if (pixbufReady)
                return pixbufReady;
            const stream = Gio.MemoryOutputStream.new_resizable();
            pixbufReady = new Promise((resolve, reject) => {
                Shell.Screenshot.composite_to_stream(content.get_texture(),
                    0, 0, -1, -1, 1, null, 0, 0, 1, stream,
                    (_source, result) => {
                        try {
                            resolve(Shell.Screenshot.composite_to_stream_finish(result));
                        } catch (error) {
                            reject(error);
                        }
                    });
            }).then(pixbuf => {
                snapshot.pixbuf = pixbuf;
                return pixbuf;
            }).finally(() => stream.close(null));
            pixbufReady.catch(() => {});
            return pixbufReady;
        };
        snapshot.ensurePixelation = annotations => this._preparePixelation
            ? this._preparePixelation(snapshot, annotations) : snapshot.ensurePixbuf();
        Object.defineProperty(snapshot, 'pixbufReady', {get: () => snapshot.ensurePixbuf()});
        return snapshot;
    }
}
