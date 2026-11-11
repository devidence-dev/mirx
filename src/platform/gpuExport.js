import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';

import { ImageOutput } from './imageOutput.js';
import { alignedPaintRect, physicalRect } from '../core/geometry.js';

export class GpuImageOutput extends ImageOutput {
    async render(snapshot, selection, _annotations, monitor, operation = {}) {
        const scale = monitor?.scale ?? monitor?.scaleFactor ?? snapshot.scale ?? 1;
        const physical = physicalRect(selection, scale);
        const width = physical.width,
            height = physical.height;
        if (width <= 0 || height <= 0) throw new Error('The selection is empty');
        if (typeof global.stage?.paint_to_content !== 'function' || typeof operation.withExportContent !== 'function')
            throw new Error('GPU export requires Clutter.Stage.paint_to_content and an active overlay');
        // GNOME 50 Clutter-18.gir:20685: rect, scale, nullable color_state, flags.
        // Mtk-18.gir:86 declares Rectangle.new; Clutter-18.gir:18641 declares NO_CURSORS.
        // An aligned rectangle makes the stage render 1:1 on the physical grid; the texture is cropped below.
        const aligned = alignedPaintRect(physical, scale);
        const paint = aligned?.rect ?? selection;
        const painted = this._time('export-paint', `pixels=${width}x${height} scale=${scale}`);
        const content = operation.withExportContent(() =>
            global.stage.paint_to_content(
                Mtk.Rectangle.new(paint.x, paint.y, paint.width, paint.height),
                scale,
                null,
                Clutter.PaintFlag.NO_CURSORS,
            ),
        );
        painted();
        const texture = content?.get_texture();
        if (!texture) throw new Error('Clutter.Stage.paint_to_content did not return a usable texture');
        const stream = Gio.MemoryOutputStream.new_resizable();
        let pixbuf, pngBytes;
        try {
            // Shell-18.gir:1698,1744: composite only the already cropped texture.
            pixbuf = await new Promise((resolve, reject) => {
                // Shell performs GPU readback and pixbuf conversion before this call returns;
                // PNG encoding completes asynchronously. Separate call time from callback wait.
                const submitted = this._time('export-composite-sync');
                let encoded = () => {};
                Shell.Screenshot.composite_to_stream(
                    texture,
                    aligned?.offsetX ?? 0,
                    aligned?.offsetY ?? 0,
                    aligned ? width : -1,
                    aligned ? height : -1,
                    1,
                    null,
                    0,
                    0,
                    1,
                    stream,
                    (_source, result) => {
                        encoded();
                        try {
                            resolve(Shell.Screenshot.composite_to_stream_finish(result));
                        } catch (error) {
                            reject(error);
                        }
                    },
                );
                submitted();
                encoded = this._time('export-png-wait');
                // The pixels now live in CPU memory; the caller may close its UI while the PNG encodes.
                operation.onCaptured?.();
            });
            stream.close(null);
            pngBytes = stream.steal_as_bytes();
        } finally {
            if (!stream.is_closed()) stream.close(null);
        }
        const expectedWidth = aligned ? width : texture.get_width();
        const expectedHeight = aligned ? height : texture.get_height();
        if (pixbuf.get_width() !== expectedWidth || pixbuf.get_height() !== expectedHeight)
            throw new Error(
                `GPU export dimensions ${pixbuf.get_width()}x${pixbuf.get_height()} differ from expected ${expectedWidth}x${expectedHeight}`,
            );
        return { pixbuf, pngBytes };
    }
}
