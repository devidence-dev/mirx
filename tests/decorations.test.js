import test from 'node:test';
import assert from 'node:assert/strict';
import { decorationRect, DecorationActors } from '../src/ui/decorations.js';

test('decorationRect prefers the selection, then an untyped draft, then the hover', () => {
    const selection = { x: 1, y: 2, width: 3, height: 4 };
    const draft = { x: 5, y: 6, width: 7, height: 8 };
    const hover = { x: 9, y: 10, width: 11, height: 12 };
    assert.equal(decorationRect({ selection, draft: null, hover }), selection);
    assert.equal(decorationRect({ selection: null, draft, hover }), draft);
    assert.equal(decorationRect({ selection: null, draft: { ...draft, type: 'rect' }, hover }), hover);
    assert.equal(decorationRect({ selection: null, draft: null, hover: null }), null);
});

test('annotation decorations reuse actors and hide unused handles', () => {
    let writes = 0;
    const createActor = (options) => ({
        ...options,
        children: [],
        add_child(child) {
            this.children.push(child);
        },
        set_position(x, y) {
            this.position = [x, y];
            writes++;
        },
        set_size(width, height) {
            this.size = [width, height];
            writes++;
        },
        show() {
            this.visible = true;
            writes++;
        },
        hide() {
            this.visible = false;
            writes++;
        },
    });
    const decorations = new DecorationActors({ width: 500, height: 400, createActor });
    const arrow = { id: 1, type: 'arrow', x1: 10, y1: 20, x2: 40, y2: 50, width: 3 };
    decorations.update({ annotations: [arrow], selectedId: 1 });
    assert.deepEqual(
        decorations._handles.filter((handle) => handle.visible).map((handle) => handle.position),
        [
            [5, 15],
            [35, 45],
        ],
    );
    assert.deepEqual(decorations._box.position, [10, 20]);
    assert.deepEqual(decorations._box.size, [30, 30]);
    assert.ok(decorations._handles.every((handle) => handle.width === 10 && handle.height === 10));
    const unchanged = writes;
    decorations.update({ annotations: [{ ...arrow }], selectedId: 1 });
    assert.equal(writes, unchanged);
    const box = decorations._box;
    decorations.update({ annotations: [{ ...arrow, x2: 60 }], selectedId: 1 });
    assert.equal(decorations._box, box);
    decorations.update({ annotations: [arrow], selectedId: null });
    assert.equal(box.visible, false);
    assert.ok(decorations._handles.every((handle) => !handle.visible));
});

test('a selected marker shows a blue ring 4 px outside its bounds, with no handles', () => {
    const createActor = (options) => ({
        ...options,
        children: [],
        add_child(child) {
            this.children.push(child);
        },
        set_position(x, y) {
            this.position = [x, y];
        },
        set_size(width, height) {
            this.size = [width, height];
        },
        set_style(style) {
            this.style = style;
        },
        show() {
            this.visible = true;
        },
        hide() {
            this.visible = false;
        },
    });
    const decorations = new DecorationActors({ width: 500, height: 400, createActor });
    const marker = { id: 1, type: 'marker', x1: 50, y1: 60, x2: 50, y2: 60, width: 3, color: '#ff0000' };
    decorations.update({ annotations: [marker], selectedId: 1 });
    assert.equal(decorations._box.visible, true);
    assert.deepEqual(decorations._box.position, [34, 44]);
    assert.deepEqual(decorations._box.size, [32, 32]);
    assert.match(decorations._box.style, /border-radius: 16px/);
    assert.match(decorations._box.style, /rgb\(26, 115, 255\)/);
    assert.ok(decorations._handles.every((handle) => !handle.visible));
    const arrow = { id: 2, type: 'arrow', x1: 10, y1: 20, x2: 40, y2: 50, width: 3 };
    decorations.update({ annotations: [marker, arrow], selectedId: 2 });
    assert.equal(decorations._box.style, null);
});
