import Cairo from 'cairo';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import St from 'gi://St';

import {physicalRect} from '../core/geometry.js';
import {renderAnnotations} from '../rendering/annotations.js';
import {cropRect} from '../rendering/pixels.js';

// GJS exposes Cairo's PNG interface as filenames. Use a private temporary file
// for the bridge between Cairo and GdkPixbuf, and always remove it afterwards.
function withTemporaryPng(callback) {
    const [file, stream] = Gio.File.new_tmp('mirx-XXXXXX');
    const path = file.get_path();
    try {
        stream.close(null);
        return callback(path);
    } finally {
        try { file.delete(null); } catch (_) { /* already removed */ }
    }
}

export class ImageOutput {
    constructor({notify = () => {}} = {}) {
        this._notify = notify;
    }

    async render({pixbuf, scale = 1}, selection, annotations, monitor) {
        const outputScale = monitor?.scale ?? monitor?.scaleFactor ?? scale;
        const physical = physicalRect(selection, outputScale);
        const width = physical.width, height = physical.height;
        if (width <= 0 || height <= 0)
            throw new Error('The selection is empty');
        // Same grid: crop exactly and paint 1:1, so no resampling and no margin are needed.
        const exact = Math.abs(scale - outputScale) < 1e-6 && physical.x + physical.width <= pixbuf.get_width() &&
            physical.y + physical.height <= pixbuf.get_height();
        // Margin keeps the pixels cairo's scaling filter samples around the selection edges.
        const crop = exact ? physical : cropRect({width: pixbuf.get_width(), height: pixbuf.get_height()}, scale, selection,
            Math.ceil(scale / outputScale) + 1);
        if (crop.width <= 0 || crop.height <= 0)
            throw new Error('The selection is empty');
        return withTemporaryPng(path => {
            pixbuf.new_subpixbuf(crop.x, crop.y, crop.width, crop.height).savev(path, 'png', [], []);
            const source = Cairo.ImageSurface.createFromPNG(path);
            let surface = null;
            let cr = null;
            try {
                surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
                cr = new Cairo.Context(surface);
                if (exact) {
                    cr.setSourceSurface(source, 0, 0);
                    cr.paint();
                    cr.scale(outputScale, outputScale);
                    cr.translate(-physical.x / outputScale, -physical.y / outputScale);
                } else {
                    cr.scale(outputScale, outputScale);
                    cr.translate(-selection.x, -selection.y);
                    cr.save();
                    cr.scale(1 / scale, 1 / scale);
                    cr.setSourceSurface(source, crop.x, crop.y);
                    cr.paint();
                    cr.restore();
                }
                renderAnnotations(cr, annotations, {pixbuf, scale});
                surface.writeToPNG(path);
                return GdkPixbuf.Pixbuf.new_from_file(path);
            } finally {
                cr?.$dispose();
                surface?.finish();
                source.finish();
            }
        });
    }

    async copy(snapshot, selection, annotations, monitor, {isCancelled = () => false} = {}) {
        const pixbuf = await this.render(snapshot, selection, annotations, monitor);
        if (isCancelled())
            return;
        const [success, bytes] = pixbuf.save_to_bufferv('png', [], []);
        if (!success)
            throw new Error('Could not encode screenshot');
        St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD,
            'image/png', GLib.Bytes.new(bytes));
        this._notify('Capture copied', 'The image was copied to the clipboard.');
    }

    async save(snapshot, selection, annotations, monitor, {folder, format = 'PNG'},
        {isCancelled = () => false} = {}) {
        const pixbuf = await this.render(snapshot, selection, annotations, monitor);
        if (isCancelled())
            return null;
        const directory = folder === '~' ? GLib.get_home_dir() :
            folder.startsWith('~/') ? GLib.build_filenamev([GLib.get_home_dir(), folder.slice(2)]) : folder;
        if (!GLib.path_is_absolute(directory))
            throw new Error('The folder must be an absolute path or start with ~/');
        const dir = Gio.File.new_for_path(directory);
        try {
            dir.make_directory_with_parents(null);
        } catch (error) {
            if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                throw error;
        }
        const jpeg = ['jpg', 'jpeg'].includes(format.toLowerCase());
        const extension = jpeg ? 'jpg' : 'png';
        const timestamp = snapshot.capturedAt ?? GLib.DateTime.new_now_local().format('%Y-%m-%d_%H-%M-%S');
        for (let n = 0; ; n++) {
            const suffix = n ? `-${n}` : '';
            const file = dir.get_child(`Screenshot_${timestamp}${suffix}.${extension}`);
            let stream;
            try {
                stream = file.create(Gio.FileCreateFlags.PRIVATE, null);
            } catch (error) {
                if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                    continue;
                throw error;
            }
            try {
                pixbuf.save_to_streamv(stream, jpeg ? 'jpeg' : 'png', [], [], null);
                stream.close(null);
            } catch (error) {
                try { stream.close(null); } catch (_) { /* preserve original error */ }
                try { file.delete(null); } catch (_) { /* preserve original error */ }
                throw error;
            }
            const path = file.get_path();
            this._notify('Capture saved', path);
            return path;
        }
    }
}
