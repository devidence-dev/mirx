import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';

export function textFont(width, size = Math.max(14, (width || 3) * 5)) {
    const font = Pango.FontDescription.from_string('Sans');
    font.set_absolute_size(size * Pango.SCALE);
    return font;
}

export function measureText(text, width) {
    const context = PangoCairo.FontMap.get_default().create_context();
    const layout = Pango.Layout.new(context);
    layout.set_font_description(textFont(width));
    layout.set_text(text ?? '', -1);
    const [w, h] = layout.get_pixel_size();
    return { width: Math.max(1, w), height: Math.max(1, h) };
}
