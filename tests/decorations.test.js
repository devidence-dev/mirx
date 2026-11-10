import test from 'node:test';
import assert from 'node:assert/strict';
import {decorationRect} from '../src/ui/decorations.js';

test('decorationRect prefers the selection, then an untyped draft, then the hover', () => {
    const selection = {x: 1, y: 2, width: 3, height: 4};
    const draft = {x: 5, y: 6, width: 7, height: 8};
    const hover = {x: 9, y: 10, width: 11, height: 12};
    assert.equal(decorationRect({selection, draft: null, hover}), selection);
    assert.equal(decorationRect({selection: null, draft, hover}), draft);
    assert.equal(decorationRect({selection: null, draft: {...draft, type: 'rect'}, hover}), hover);
    assert.equal(decorationRect({selection: null, draft: null, hover: null}), null);
});
