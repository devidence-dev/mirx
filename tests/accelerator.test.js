import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAccelerator } from '../src/core/accelerator.js';

test('formats GTK accelerators for display', () => {
    const cases = {
        '<Alt><Shift>x': 'Alt+Shift+X',
        '<Control><Super>s': 'Ctrl+Super+S',
        '<Primary>a': 'Ctrl+A',
        '<primary><ctrl>a': 'Ctrl+A',
        '<Mod1>Print': 'Alt+Print',
        Print: 'Print',
        '<Control>space': 'Ctrl+Space',
        '<Shift>F5': 'Shift+F5',
        F12: 'F12',
        '<Alt>Page_Up': 'Alt+Page Up',
        '<Alt>1': 'Alt+1',
    };
    for (const [input, expected] of Object.entries(cases)) assert.equal(formatAccelerator(input), expected, input);
});

test('empty or invalid accelerators give an empty string', () => {
    for (const input of [
        '',
        '  ',
        undefined,
        null,
        5,
        '<Alt>',
        '<Primary>',
        '<Foo>x',
        '<Alt',
        'Alt>x',
        '<Alt>x y',
        '<Alt><x',
    ])
        assert.equal(formatAccelerator(input), '', String(input));
});
