import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAWING_TOOLS, Editor, normalizeAppearance } from '../src/core/editor.js';
import { readAppearance, writeAppearance } from '../src/platform/appearanceSettings.js';

const monitors = [{ x: 0, y: 0, width: 800, height: 600 }];

test('appearance normalization isolates invalid fields and retains valid overrides', () => {
    assert.deepEqual(
        normalizeAppearance({
            color: '#bad',
            width: 6,
            gradient: 'yes',
            toolWidths: { arrow: 0, marker: 5, text: 31, circle: 2.5, unknown: 4 },
        }),
        { color: '#ff0000', width: 6, gradient: false, toolWidths: { marker: 5 } },
    );
    assert.equal(normalizeAppearance({ width: 3.5 }).width, 3);
});

test('tool sizes restore independently and selected edits do not change history preferences', () => {
    const patches = [];
    const e = new Editor({ monitors, width: 3, onPreferenceChange: (patch) => patches.push(patch) });
    e.setStyle({ width: 9 });
    assert.equal(patches.length, 0);
    e.selectMonitor({ x: 10, y: 10 });
    for (const [index, tool] of DRAWING_TOOLS.entries()) {
        e.setTool(tool);
        e.setStyle({ width: index + 4 });
    }
    for (const [index, tool] of DRAWING_TOOLS.entries()) {
        e.setTool(tool);
        assert.equal(e.style.width, index + 4);
    }
    const reopened = new Editor({ monitors, width: 7, toolWidths: { marker: 5 } });
    reopened.setTool('marker');
    assert.equal(reopened.style.width, 5);
    reopened.setTool('rectangle');
    assert.equal(reopened.style.width, 7);
    e.setTool('arrow');
    e.setStyle({ width: 3 });
    e.setTool('marker');
    e.setStyle({ width: 5 });
    e.pointerDown({ x: 50, y: 50 });
    e.setTool('select');
    e.pointerDown({ x: 50, y: 50 });
    e.pointerUp({ x: 50, y: 50 });
    const count = patches.length;
    e.pointerDown({ x: 50, y: 50 });
    e.pointerUp({ x: 55, y: 55 });
    e.setStyle({ width: 5, color: '#ff0000', gradient: false });
    assert.equal(patches.length, count);
    e.setStyle({ width: 9, color: '#0088ff', gradient: true });
    assert.deepEqual(patches.at(-1), { color: '#0088ff', gradient: true, toolWidth: { tool: 'marker', width: 9 } });
    e.undo();
    assert.equal(e.annotations[0].width, 5);
    e.redo();
    assert.equal(patches.length, count + 1);
    e.setTool('arrow');
    assert.equal(e.style.width, 3);
    e.setTool('marker');
    assert.equal(e.style.width, 9);
    for (const tool of ['highlighter', 'pixelate', 'text', 'arrow']) {
        e.setTool(tool);
        assert.equal(e.style.gradient, true);
    }
    e.setTool('select');
    assert.equal(e.sizeTarget, null);
    const saved = patches.length;
    e.setStyle({ width: 10 });
    assert.equal(patches.length, saved);
});

test('settings adapter merges dictionary and detects rejected setters', () => {
    const values = {
        'default-color': '#ff0000',
        'default-width': 6,
        'annotation-gradient': false,
        'tool-widths': { arrow: 3 },
    };
    const settings = {
        get_string: (key) => values[key],
        get_int: (key) => values[key],
        get_boolean: (key) => values[key],
        get_value: (key) => ({ deep_unpack: () => ({ ...values[key] }) }),
        set_string: (key, value) => {
            values[key] = value;
            return true;
        },
        set_boolean: (key, value) => {
            values[key] = value;
            return true;
        },
        set_value: (key, value) => {
            values[key] = value.value;
            return true;
        },
    };
    const variant = (type, value) => ({ type, value });
    writeAppearance(settings, variant, { toolWidth: { tool: 'marker', width: 5 }, gradient: true });
    assert.deepEqual(readAppearance(settings), {
        color: '#ff0000',
        width: 6,
        gradient: true,
        toolWidths: { arrow: 3, marker: 5 },
    });
    settings.set_string = () => false;
    assert.throws(() => writeAppearance(settings, variant, { color: '#0088ff' }), /rejected/);
});
