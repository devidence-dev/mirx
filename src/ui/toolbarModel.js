export const TOOLS = [
    { id: 'select', name: 'Select and move', key: 'V', icon: 'select-move-symbolic.svg', hint: '' },
    { id: 'arrow', name: 'Arrow', key: 'A', icon: 'arrow-symbolic.svg', hint: '' },
    { id: 'rectangle', name: 'Rectangle', key: 'R', icon: 'rectangle-symbolic.svg', hint: '' },
    { id: 'circle', name: 'Ellipse', key: 'E', icon: 'ellipse-symbolic.svg', hint: 'Shift for a circle' },
    { id: 'marker', name: 'Numbered marker', key: 'N', icon: 'marker-symbolic.svg', hint: '' },
    { id: 'highlighter', name: 'Highlighter', key: 'H', icon: 'highlighter-symbolic.svg', hint: '' },
    { id: 'pixelate', name: 'Pixelate', key: 'P', icon: 'pixelate-symbolic.svg', hint: '' },
    { id: 'text', name: 'Text', key: 'T', icon: 'text-symbolic.svg', hint: '' },
];

export const RESERVED_SHORTCUTS = [
    'Ctrl+A',
    'Ctrl+C',
    'Ctrl+S',
    'Ctrl+Z',
    'Ctrl+Shift+Z',
    'Delete',
    'Enter',
    'Escape',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
];

export const ROW_GROUPS = [
    ['tools', 'history'],
    ['colors', 'width', 'gradient', 'actions'],
];
export const ICON_FILES = [
    ...TOOLS.map((tool) => tool.icon),
    ...['gradient', 'undo', 'redo', 'minus', 'plus', 'close'].map((name) => `${name}-symbolic.svg`),
];

export function toolForKey(char) {
    if (typeof char !== 'string' || char.length !== 1) return undefined;
    return TOOLS.find((tool) => tool.key === char.toUpperCase());
}

export function tooltipText(name, shortcut, hint) {
    return `${name}${shortcut ? ` (${shortcut})` : ''}${hint ? ` · ${hint}` : ''}`;
}
