import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Load the class without GNOME imports; these tests exercise its actor protocol only.
const source = readFileSync(new URL('../src/ui/overlay.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export class Overlay', 'class Overlay') + '\nthis.Overlay = Overlay;';
const Overlay = vm.runInNewContext(source, {
    Clutter: {CursorType: {TEXT: 1, CROSSHAIR: 2, DEFAULT: 3}, EVENT_STOP: 1, EVENT_PROPAGATE: 0},
    contains: () => true, physicalRect: rect => rect,
});

function actor(visible = true) {
    return {visible, hide() { this.visible = false; }, show() { this.visible = true; }};
}

for (const guidesVisible of [true, false]) test(`export hides alignment guides (initially ${guidesVisible ? 'visible' : 'hidden'}) and restores them on success and failure`, () => {
    const view = Object.create(Overlay.prototype);
    const marker = actor();
    const gradient = actor();
    Object.assign(view, {
        _shades: [actor(), actor(false)], _annotationDecorations: {actor: actor()}, _draft: {actor: actor()},
        _guides: {actor: actor(guidesVisible)},
        _frame: actor(), _handles: [actor()], _dimensions: actor(), _hint: actor(false),
        _error: actor(), _toolbar: {actor: actor()}, _magnifier: {actor: actor()},
        _textEdit: {actor: actor()}, _annotations: {actor: Object.assign(actor(), {children: [marker, gradient]}), prepareExport() {}},
    });
    const hidden = [...view._shades, view._annotationDecorations.actor, view._draft.actor, view._guides.actor,
        view._frame, ...view._handles, view._dimensions, view._hint, view._error, view._toolbar.actor,
        view._magnifier.actor, view._textEdit.actor];
    const before = hidden.map(item => item.visible);
    assert.equal(view._guides.actor.visible, guidesVisible);
    assert.throws(() => view.withExportContent(() => {
        assert.ok(hidden.every(item => !item.visible));
        assert.equal(view._annotations.actor.visible, true);
        assert.equal(marker.visible, true);
        assert.equal(gradient.visible, true);
        throw new Error('capture failed');
    }), /capture failed/);
    assert.deepEqual(hidden.map(item => item.visible), before);
    assert.equal(marker.visible, true);
    assert.equal(gradient.visible, true);
    assert.equal(view.withExportContent(() => {
        assert.equal(view._guides.actor.visible, false);
        assert.equal(marker.visible, true);
        assert.equal(gradient.visible, true);
        return 42;
    }), 42);
    assert.deepEqual(hidden.map(item => item.visible), before);
    assert.equal(marker.visible, true);
    assert.equal(gradient.visible, true);
});

test('export allocates committed annotations before capture', () => {
    const calls = [];
    const view = Object.create(Overlay.prototype);
    Object.assign(view, {_annotations: {prepareExport: () => calls.push('allocate')},
        _shades: [], _annotationDecorations: {actor: actor()}, _draft: {actor: actor()}, _frame: actor(),
        _handles: [], _dimensions: actor(), _hint: actor(), _error: actor(),
        _guides: {actor: actor()}, _toolbar: {actor: actor()}, _magnifier: {actor: actor()}});
    view.withExportContent(() => calls.push('capture'));
    assert.deepEqual(calls, ['allocate', 'capture']);
});

test('export commits text and refreshes before calling the export handler', () => {
    const calls = [];
    const view = Object.create(Overlay.prototype);
    Object.assign(view, {_busy: false, _finishText: commit => calls.push(['text', commit]),
        _refresh: () => calls.push(['refresh']), onExport: action => calls.push(['export', action])});
    view._export('copy');
    assert.deepEqual(calls, [['text', true], ['refresh'], ['export', 'copy']]);
});


test('rectangle motion routes changing drafts through the draft layer without canvas repaint', () => {
    const committed = [{id: 1, type: 'circle'}, {id: 2, type: 'pixelate'}];
    const selection = {x: 0, y: 0, width: 100, height: 100};
    const calls = [];
    const view = Object.create(Overlay.prototype);
    const editor = {annotations: committed, selection, monitor: {...selection, scale: 1},
        tool: 'rectangle', style: {}, selectedId: null, draft: null,
        pointerMove(point) { this.draft = {id: 3, type: 'rectangle', x1: 1, y1: 1, x2: point.x, y2: point.y}; }};
    Object.assign(view, {editor, perfLog: () => false, _busy: false, _dragging: true, _selectionDrag: false,
        _pointOf: event => event, _options: () => ({}), _isControl: () => false,
        snapshot: {monitors: [editor.monitor],
            ensurePixelation() { throw new Error('pixelation tiles requested'); },
            get pixbufReady() { throw new Error('full pixbuf requested'); }},
        actor: {set_cursor_type() {}}, _toolbar: {update() {}, place() {}},
        _dimensions: {show() {}, get_preferred_width: () => [0, 1],
            get_preferred_height: () => [0, 1], set_position() {}},
        _hint: {hide() {}}, _magnifier: {update() {}}, _guides: {update() {}}, _updateDecorations() {},
        _annotations: {update(items) { calls.push(['committed', items]); }},
        _draft: {update(items) { calls.push(['draft', items[0].x2]); }},
        _annotationDecorations: {update() {}}});
    view._motion({x: 10, y: 10});
    view._motion({x: 20, y: 20});
    assert.equal(calls[0][1], committed);
    assert.equal(calls[2][1], committed);
    assert.deepEqual(calls.filter(call => call[0] === 'draft').map(call => call[1]), [10, 20]);
});

test('moving a pixelation refreshes actors without preparing pixels', () => {
    const selection = {x: 0, y: 0, width: 100, height: 100};
    const annotation = {id: 1, type: 'pixelate', x1: 1, y1: 1, x2: 10, y2: 10};
    const positions = [];
    const editor = {annotations: [annotation], selection, monitor: {...selection, scale: 1},
        tool: null, style: {}, selectedId: 1, draft: null,
        pointerMove(point) { annotation.x1 = point.x; }};
    const view = Object.create(Overlay.prototype);
    Object.assign(view, {editor, perfLog: () => false, _busy: false, _dragging: true, _selectionDrag: false,
        _pointOf: event => event, _options: () => ({}), _isControl: () => false,
        snapshot: {monitors: [editor.monitor],
            ensurePixelation() { throw new Error('pixelation tiles requested'); },
            get pixbufReady() { throw new Error('full pixbuf requested'); }},
        actor: {set_cursor_type() {}}, _toolbar: {update() {}, place() {}},
        _dimensions: {show() {}, get_preferred_width: () => [0, 1],
            get_preferred_height: () => [0, 1], set_position() {}},
        _hint: {hide() {}}, _magnifier: {update() {}}, _guides: {update() {}}, _updateDecorations() {},
        _annotations: {update(items) { positions.push(items[0].x1); }},
        _draft: {update() {}}, _annotationDecorations: {update() {}}});
    view._motion({x: 20, y: 20});
    view._motion({x: 30, y: 30});
    assert.deepEqual(positions, [20, 30]);
});
