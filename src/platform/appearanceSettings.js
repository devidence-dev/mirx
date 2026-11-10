/** Reads and writes appearance fields without overwriting unrelated settings. */
export function readAppearance(settings) {
    return {
        color: settings.get_string('default-color'),
        width: settings.get_int('default-width'),
        gradient: settings.get_boolean('annotation-gradient'),
        toolWidths: settings.get_value('tool-widths').deep_unpack(),
    };
}

export function writeAppearance(settings, makeVariant, patch) {
    const write = (success) => {
        if (!success) throw new Error('Settings rejected the appearance change');
    };
    if (patch.color !== undefined) write(settings.set_string('default-color', patch.color));
    if (patch.gradient !== undefined) write(settings.set_boolean('annotation-gradient', patch.gradient));
    if (patch.toolWidth !== undefined) {
        const widths = settings.get_value('tool-widths').deep_unpack();
        widths[patch.toolWidth.tool] = patch.toolWidth.width;
        write(settings.set_value('tool-widths', makeVariant('a{si}', widths)));
    }
}
