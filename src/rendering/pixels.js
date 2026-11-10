// Build opaque pixel blocks from an immutable RGB or RGBA screenshot. Coordinates
// are logical desktop units; scale maps them to pixels in the screenshot.
export function pixelBlocks({pixels, stride, channels, width, height, scale = 1}, bounds, block) {
    const left = Math.max(0, bounds.x), top = Math.max(0, bounds.y);
    const right = Math.min(width / scale, bounds.x + bounds.width);
    const bottom = Math.min(height / scale, bounds.y + bounds.height);
    const blocks = [];
    for (let y = top; y < bottom; y += block) {
        for (let x = left; x < right; x += block) {
            const x0 = Math.max(0, Math.floor(x * scale));
            const y0 = Math.max(0, Math.floor(y * scale));
            const x2 = Math.min(width, Math.ceil(Math.min(x + block, right) * scale));
            const y2 = Math.min(height, Math.ceil(Math.min(y + block, bottom) * scale));
            const dx = Math.max(1, Math.ceil((x2 - x0) / 8));
            const dy = Math.max(1, Math.ceil((y2 - y0) / 8));
            let r = 0, g = 0, blue = 0, count = 0;
            for (let py = y0; py < y2; py += dy) {
                for (let px = x0; px < x2; px += dx) {
                    const i = py * stride + px * channels;
                    r += pixels[i]; g += pixels[i + 1]; blue += pixels[i + 2]; count++;
                }
            }
            if (count)
                blocks.push([x, y, Math.min(block, right - x), Math.min(block, bottom - y),
                    r / count / 255, g / count / 255, blue / count / 255]);
        }
    }
    return blocks;
}
