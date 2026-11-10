import test from 'node:test';
import assert from 'node:assert/strict';
import { RESERVED_SHORTCUTS, TOOLS, toolForKey, tooltipText } from '../src/ui/toolbarModel.js';

test('tool keys are unique, case insensitive, and coexist with modified shortcuts', () => {
    assert.equal(TOOLS.map((tool) => tool.key).join(''), 'VARENHPT');
    assert.equal(new Set(TOOLS.map((tool) => tool.key)).size, 8);
    for (const tool of TOOLS) {
        assert.equal(toolForKey(tool.key.toLowerCase()), tool);
        assert.equal(toolForKey(tool.key), tool);
    }
    assert.deepEqual(RESERVED_SHORTCUTS.slice(0, 5), ['Ctrl+A', 'Ctrl+C', 'Ctrl+S', 'Ctrl+Z', 'Ctrl+Shift+Z']);
    for (const shortcut of RESERVED_SHORTCUTS) assert.equal(toolForKey(shortcut), undefined);
    assert.equal(toolForKey('A').id, 'arrow');
    assert.ok(RESERVED_SHORTCUTS.includes('Ctrl+A'));
    assert.equal(toolForKey(' '), undefined);
    assert.equal(toolForKey(''), undefined);
});

test('tooltip text includes optional shortcut and hint', () => {
    assert.equal(tooltipText('Rectangle', 'R'), 'Rectangle (R)');
    assert.equal(tooltipText('Undo', 'Ctrl+Z'), 'Undo (Ctrl+Z)');
    assert.equal(tooltipText('Red'), 'Red');
    assert.equal(tooltipText('Ellipse', 'E', 'Shift for a circle'), 'Ellipse (E) · Shift for a circle');
    assert.equal(tooltipText('Copy', 'Ctrl+C, Enter'), 'Copy (Ctrl+C, Enter)');
});
