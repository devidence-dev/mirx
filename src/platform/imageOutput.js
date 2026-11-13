import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

// The glycin JPEG encoder behind gdk-pixbuf 2.44+ rejects RGBA, so drop the alpha channel first.
// The capture is opaque, so compositing over white changes no pixel.
function opaque(pixbuf) {
    if (!pixbuf.get_has_alpha()) return pixbuf;
    const width = pixbuf.get_width(),
        height = pixbuf.get_height();
    const rgb = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, false, 8, width, height);
    rgb.fill(0xffffffff);
    pixbuf.composite(rgb, 0, 0, width, height, 0, 0, 1, 1, GdkPixbuf.InterpType.NEAREST, 255);
    return rgb;
}

function resolveFolder(folder) {
    if (folder === '~') return GLib.get_home_dir();
    if (folder.startsWith('~/')) return GLib.build_filenamev([GLib.get_home_dir(), folder.slice(2)]);
    return folder;
}

function ensureDirectory(directory) {
    if (!GLib.path_is_absolute(directory)) throw new Error('The folder must be an absolute path or start with ~/');
    const dir = Gio.File.new_for_path(directory);
    try {
        dir.make_directory_with_parents(null);
    } catch (error) {
        if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) throw error;
    }
    return dir;
}

// Creates the first free Screenshot_<timestamp>[-n].<extension>; an existing file bumps the suffix.
function createUniqueFile(dir, timestamp, extension) {
    for (let n = 0; ; n++) {
        const suffix = n ? `-${n}` : '';
        const file = dir.get_child(`Screenshot_${timestamp}${suffix}.${extension}`);
        try {
            return { file, stream: file.create(Gio.FileCreateFlags.NONE, null) };
        } catch (error) {
            if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) throw error;
        }
    }
}

function discardFile(file, stream) {
    try {
        stream.close(null);
    } catch (_) {
        /* preserve original error */
    }
    try {
        file.delete(null);
    } catch (_) {
        /* preserve original error */
    }
}

export class ImageOutput {
    constructor({ notify = () => {}, perfLog = () => false } = {}) {
        this._notify = notify;
        this._perfLog = perfLog;
    }

    _time(phase, details = '') {
        if (!this._perfLog()) return () => {};
        const start = GLib.get_monotonic_time();
        return () => {
            const elapsed = (GLib.get_monotonic_time() - start) / 1000;
            console.log(`mirx-perf ${phase} ms=${elapsed}${details ? ` ${details}` : ''}`);
        };
    }

    async copy(snapshot, selection, annotations, monitor, operation = {}) {
        const { isCancelled = () => false } = operation;
        const { pngBytes } = await this.render(snapshot, selection, annotations, monitor, operation);
        if (isCancelled()) return;
        const delivered = this._time('export-clipboard');
        St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD, 'image/png', pngBytes);
        delivered();
        operation.onComplete?.();
        this._notify('Capture copied', 'The image was copied to the clipboard.');
    }

    async save(snapshot, selection, annotations, monitor, { folder, format = 'PNG' }, operation = {}) {
        const { isCancelled = () => false } = operation;
        // Validate the folder before rendering: render() may close the overlay, and a configuration
        // error must still leave the session open so the user can retry.
        const prepared = this._time('export-file-prepare');
        const dir = ensureDirectory(resolveFolder(folder));
        const jpeg = ['jpg', 'jpeg'].includes(format.toLowerCase());
        const extension = jpeg ? 'jpg' : 'png';
        const timestamp = snapshot.capturedAt ?? GLib.DateTime.new_now_local().format('%Y-%m-%d_%H-%M-%S');
        const { file, stream } = createUniqueFile(dir, timestamp, extension);
        prepared();
        try {
            const { pixbuf, pngBytes } = await this.render(snapshot, selection, annotations, monitor, operation);
            if (isCancelled()) {
                discardFile(file, stream);
                return null;
            }
            const written = this._time(jpeg ? 'export-jpeg-and-write' : 'export-png-write');
            if (jpeg) opaque(pixbuf).save_to_streamv(stream, 'jpeg', [], [], null);
            else stream.write_all(pngBytes.get_data(), null);
            stream.close(null);
            written();
        } catch (error) {
            discardFile(file, stream);
            throw error;
        }
        operation.onComplete?.();
        const path = file.get_path();
        this._notify('Capture saved', path);
        return path;
    }
}
