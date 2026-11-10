const HANDLE_CURSORS = {
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    start: 'move',
    end: 'move',
};

function gestureCursor(interaction, handle) {
    if (interaction === 'selection-resize' || interaction === 'annotation-resize')
        return HANDLE_CURSORS[handle] ?? 'default';
    if (interaction === 'selection-move' || interaction === 'annotation-move') return 'move';
    return 'crosshair';
}

export function cursorFor({ target, tool, interaction, interactionHandle, control }) {
    if (interaction) return gestureCursor(interaction, interactionHandle);
    if (control === 'text') return 'text';
    if (control === 'button') return 'pointer';
    if (control === 'toolbar') return 'default';
    switch (target?.kind) {
        case 'selection-handle':
        case 'annotation-handle':
            return HANDLE_CURSORS[target.handle] ?? 'default';
        case 'annotation':
        case 'selection':
            return 'move';
        case 'canvas':
            return tool === 'text' ? 'text' : 'crosshair';
        case 'none':
            return 'crosshair';
        case 'inert':
            return 'default';
        default:
            return 'default';
    }
}
