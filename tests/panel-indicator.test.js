import assert from 'node:assert/strict';
import test from 'node:test';
import { PanelIndicatorController } from '../src/application/panelIndicator.js';

function fixture() {
    let visible = true;
    let shortcut = 'Alt+Shift+X';
    const hints = [];
    let callbacks;
    let created = 0;
    let destroyed = 0;
    let captures = 0;
    let preferences = 0;
    const pending = new Set();
    const controller = new PanelIndicatorController({
        isVisible: () => visible,
        shortcutLabel: () => shortcut,
        create: (actions) => {
            callbacks = actions;
            created++;
            return { destroy: () => destroyed++, setShortcut: (text) => hints.push(text) };
        },
        defer: (fn) => {
            pending.add(fn);
            return () => pending.delete(fn);
        },
        openCapture: () => captures++,
        openPreferences: () => preferences++,
    });
    return {
        controller,
        setVisible: (value) => {
            visible = value;
        },
        callbacks: () => callbacks,
        hints,
        setShortcut: (value) => {
            shortcut = value;
        },
        counts: () => ({ created, destroyed, captures, preferences, pending: pending.size }),
        flush: () => {
            for (const fn of [...pending]) {
                pending.delete(fn);
                fn();
            }
        },
    };
}

test('sync follows visibility idempotently and stops after destruction', () => {
    const f = fixture();
    f.controller.sync();
    f.controller.sync();
    assert.equal(f.counts().created, 1);
    f.setVisible(false);
    f.controller.sync();
    f.controller.sync();
    assert.equal(f.counts().destroyed, 1);
    f.setVisible(true);
    f.controller.sync();
    assert.equal(f.counts().created, 2);
    f.controller.destroy();
    f.controller.destroy();
    f.controller.sync();
    assert.equal(f.counts().created, 2);
    assert.equal(f.counts().destroyed, 2);
});

test('actions defer capture, replace pending requests and cancel on destroy', () => {
    const f = fixture();
    f.controller.sync();
    const actions = f.callbacks();
    actions.onPreferences();
    assert.equal(f.counts().preferences, 1);
    actions.onScreenshot();
    assert.equal(f.counts().captures, 0);
    actions.onScreenshot();
    assert.equal(f.counts().pending, 1);
    f.flush();
    assert.equal(f.counts().captures, 1);
    actions.onScreenshot();
    f.controller.destroy();
    f.controller.destroy();
    f.flush();
    actions.onPreferences();
    assert.deepEqual(f.counts(), { created: 1, destroyed: 1, captures: 1, preferences: 1, pending: 0 });
});

test('the shortcut hint is given on creation, follows changes and stops after destroy', () => {
    const f = fixture();
    f.controller.syncShortcut();
    assert.deepEqual(f.hints, []);
    f.controller.sync();
    assert.equal(f.callbacks().shortcut, 'Alt+Shift+X');
    f.setShortcut('Ctrl+S');
    f.controller.syncShortcut();
    f.setShortcut('');
    f.controller.syncShortcut();
    assert.deepEqual(f.hints, ['Ctrl+S', '']);
    assert.equal(f.counts().created, 1);
    f.controller.destroy();
    f.controller.syncShortcut();
    assert.deepEqual(f.hints, ['Ctrl+S', '']);
});
