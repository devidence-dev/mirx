import test from 'node:test';
import assert from 'node:assert/strict';
import { cursorFor } from '../src/ui/cursorModel.js';

test('cursor follows gestures, controls, handles and canvas regions', () => {
    const cursor = (options) => cursorFor({ target: { kind: 'outside' }, ...options });
    for (const [handle, expected] of Object.entries({
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
    })) {
        assert.equal(cursor({ target: { kind: 'selection-handle', handle } }), expected);
        assert.equal(
            cursor({ interaction: 'annotation-resize', interactionHandle: handle, control: 'button' }),
            expected,
        );
    }
    // Select and move: moving cursors over annotations and the selection interior.
    for (const kind of ['annotation', 'selection']) assert.equal(cursor({ target: { kind }, tool: 'select' }), 'move');
    // Idle: the interior is inert, so the cursor is the plain arrow; handles still show resize cursors.
    assert.equal(cursor({ target: { kind: 'inert' }, tool: null }), 'default');
    assert.equal(cursor({ target: { kind: 'selection-handle', handle: 'se' }, tool: null }), 'nwse-resize');
    assert.equal(cursor({ target: { kind: 'none' } }), 'crosshair');
    assert.equal(cursor({ target: { kind: 'canvas' }, tool: 'arrow' }), 'crosshair');
    assert.equal(cursor({ target: { kind: 'canvas' }, tool: 'text' }), 'text');
    assert.equal(cursor({ tool: 'arrow' }), 'default');
    assert.equal(cursor({ control: 'button' }), 'pointer');
    assert.equal(cursor({ control: 'button', editingText: true }), 'pointer');
    assert.equal(cursor({ control: 'toolbar' }), 'default');
    assert.equal(cursor({ control: 'text' }), 'text');
    assert.equal(cursor({ interaction: 'selection-move', control: 'button' }), 'move');
    assert.equal(cursor({ interaction: 'draw', control: 'button' }), 'crosshair');
});
