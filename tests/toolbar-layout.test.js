import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ROW_GROUPS, TOOLS, tooltipText } from '../src/ui/toolbarModel.js';

class Actor {
    constructor(props = {}) {
        Object.assign(this, props);
        this.children = [];
        this.classes = new Set((props.style_class ?? '').split(' '));
        this.pseudo = new Set();
    }
    add_child(child) {
        this.children.push(child);
    }
    set_child(child) {
        this.child = child;
    }
    connect(name, callback) {
        this.handlers = { ...this.handlers, [name]: callback };
    }
    add_effect(effect) {
        this.effect = effect;
    }
    add_style_class_name(name) {
        this.classes.add(name);
    }
    remove_style_class_name(name) {
        this.classes.delete(name);
    }
    add_style_pseudo_class(name) {
        this.pseudo.add(name);
    }
    remove_style_pseudo_class(name) {
        this.pseudo.delete(name);
    }
    set_style() {}
    destroy() {
        this.destroyed = true;
    }
}
function load(blur = true) {
    const source = `${readFileSync(new URL('../src/ui/toolbar.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '')
        .replace('export const GLASS_BLUR = true', `const GLASS_BLUR = ${blur}`)
        .replace('export class Toolbar', 'class Toolbar')}\nthis.Toolbar = Toolbar;`;
    const context = {
        ROW_GROUPS,
        TOOLS,
        tooltipText,
        global: { stage: {} },
        Clutter: { Orientation: { VERTICAL: 1 }, ActorAlign: { CENTER: 1 } },
        Gio: { icon_new_for_string: (value) => value },
        St: {
            BoxLayout: Actor,
            Widget: Actor,
            Button: Actor,
            Label: Actor,
            Icon: Actor,
            ThemeContext: { get_for_stage: () => ({ scale_factor: 2 }) },
        },
        Shell: {
            BlurMode: { BACKGROUND: 1 },
            BlurEffect: class {
                constructor(props) {
                    Object.assign(this, props);
                }
            },
        },
    };
    vm.runInNewContext(source, context);
    return context.Toolbar;
}
function make(blur = true) {
    const Toolbar = load(blur);
    let primary = 'copy';
    const tips = [];
    const tools = [];
    const noop = () => {};
    const toolbar = new Toolbar({
        onTool: (id) => tools.push(id),
        onStyle: noop,
        onUndo: noop,
        onRedo: noop,
        onExport: noop,
        onCancel: noop,
        iconDir: '/icons',
        tooltip: { attach: (...args) => tips.push(args) },
        primaryAction: () => primary,
    });
    return {
        toolbar,
        tips,
        tools,
        setPrimary: (value) => {
            primary = value;
        },
    };
}
test('toolbar groups, names, primary action and blur', () => {
    const { toolbar, tips, setPrimary } = make();
    const rows = toolbar.actor.children;
    assert.deepEqual(
        rows.map((row) => row.children.length),
        [3, 7],
    );
    assert.ok(rows.every((row) => row.x_align === 1));
    assert.ok(
        rows.every((row) => row.children.filter((_, index) => index % 2).every((divider) => divider.y_align === 1)),
    );
    assert.equal(rows[0].children[0].children.length, 8);
    assert.equal(rows[0].children[2].children.length, 2);
    assert.deepEqual(
        rows[1].children.filter((_, i) => i % 2 === 0).map((group) => group.children.length),
        [7, 3, 1, 3],
    );
    for (const row of rows)
        for (const [i, child] of row.children.entries())
            assert.ok(child.classes.has(i % 2 ? 'mirx-divider' : 'mirx-group'));
    assert.equal(tips.length, 23);
    assert.ok(tips.every(([button]) => button.accessible_name));
    assert.equal(toolbar.actor.effect.radius, 60);
    const editor = { annotations: [], style: { width: 3, color: '#ff0000' }, tool: null };
    toolbar.update(editor);
    assert.ok(toolbar._copy.classes.has('mirx-primary'));
    assert.ok(!toolbar._save.classes.has('mirx-primary'));
    setPrimary('save');
    toolbar.update(editor);
    assert.ok(!toolbar._copy.classes.has('mirx-primary'));
    assert.ok(toolbar._save.classes.has('mirx-primary'));
    toolbar.destroy();
    toolbar.destroy();
    const solid = make(false).toolbar;
    assert.equal(solid.actor.effect, undefined);
    assert.ok(solid.actor.classes.has('mirx-toolbar-solid'));
});

const checked = (toolbar) => [...toolbar._tools].filter(([, button]) => button.pseudo.has('checked')).map(([id]) => id);

test('colour swatches are exact squares so the circle radius holds', () => {
    const { toolbar } = make();
    const size = Number(/const SWATCH_SIZE = (\d+);/.exec(readFileSync('src/ui/toolbar.js', 'utf8'))[1]);
    assert.equal(toolbar._colors.size, 7);
    for (const swatch of toolbar._colors.values()) {
        assert.equal(swatch.width, swatch.height);
        assert.equal(swatch.width, size * 2, 'scaled by the stubbed scale factor of 2');
        assert.ok(swatch.classes.has('mirx-swatch'));
        assert.ok(!swatch.classes.has('mirx-icon-button'));
        assert.equal(swatch.child, undefined);
        assert.equal(swatch.label, undefined);
        assert.equal(swatch.x_align, 1);
        assert.equal(swatch.y_align, 1);
    }
});

test('Copy and Save are icon buttons that keep names, tooltips and the suggested style', () => {
    const { toolbar, tips, setPrimary } = make();
    for (const [button, icon, name] of [
        [toolbar._copy, 'edit-copy-symbolic', 'Copy'],
        [toolbar._save, 'document-save-symbolic', 'Save'],
    ]) {
        assert.equal(button.child.icon_name, icon);
        assert.equal(button.child.icon_size, 18);
        assert.equal(button.accessible_name, name);
        assert.equal(button.label, undefined);
        assert.ok(button.classes.has('mirx-icon-button'));
        assert.ok(!button.classes.has('mirx-label-button'));
    }
    const text = (button) => tips.find(([target]) => target === button)[1]();
    assert.equal(text(toolbar._copy), 'Copy (Ctrl+C, Enter)');
    assert.equal(text(toolbar._save), 'Save (Ctrl+S)');
    setPrimary('save');
    assert.equal(text(toolbar._copy), 'Copy (Ctrl+C)');
    assert.equal(text(toolbar._save), 'Save (Ctrl+S, Enter)');
    assert.equal(toolbar._tools.get('arrow').child.gicon, '/icons/arrow-symbolic.svg');
});

test('no tool is highlighted on open; select and every tool highlight by editor.tool alone', () => {
    const { toolbar, tools } = make();
    const editor = { annotations: [], style: { width: 3, color: '#ff0000' }, tool: null };
    toolbar.update(editor);
    assert.deepEqual(checked(toolbar), []);
    // Click on select and move: the editor gets the explicit tool.
    toolbar._tools.get('select').handlers.clicked();
    assert.deepEqual(tools, ['select']);
    editor.tool = 'select';
    toolbar.update(editor);
    assert.deepEqual(checked(toolbar), ['select']);
    // Choose Arrow: select unchecks.
    toolbar._tools.get('arrow').handlers.clicked();
    editor.tool = 'arrow';
    toolbar.update(editor);
    assert.deepEqual(checked(toolbar), ['arrow']);
    // Back to idle: nothing is highlighted.
    editor.tool = null;
    toolbar.update(editor);
    assert.deepEqual(checked(toolbar), []);
    // Hotkey path: V sets the same editor tool, so the highlight follows it with no toolbar state.
    editor.tool = 'select';
    toolbar.update(editor);
    assert.deepEqual(checked(toolbar), ['select']);
    toolbar.update({ ...editor, tool: 'text' });
    assert.deepEqual(checked(toolbar), ['text']);
    const fresh = make().toolbar;
    fresh.update({ ...editor, tool: null });
    assert.deepEqual(checked(fresh), []);
});

test('size controls follow target and show selected width while gradient remains shared', () => {
    const { toolbar } = make();
    const editor = {
        annotations: [],
        selectedId: null,
        tool: null,
        sizeTarget: null,
        fallbackWidth: 6,
        style: { color: '#0088ff', width: 6, gradient: true },
    };
    toolbar.update(editor);
    assert.equal(toolbar._widthLabel.text, '6 px');
    assert.equal(toolbar._decreaseWidth.reactive, false);
    assert.equal(toolbar._increaseWidth.can_focus, false);
    assert.ok(toolbar._decreaseWidth.pseudo.has('disabled'));
    assert.ok(toolbar._gradient.pseudo.has('checked'));
    editor.tool = 'marker';
    editor.sizeTarget = 'marker';
    editor.style.width = 5;
    toolbar.update(editor);
    assert.equal(toolbar._widthLabel.text, '5 px');
    assert.equal(toolbar._increaseWidth.reactive, true);
    editor.tool = 'select';
    editor.selectedId = 1;
    editor.annotations = [{ id: 1, width: 9, color: '#ff0000' }];
    toolbar.update(editor);
    assert.equal(toolbar._widthLabel.text, '9 px');
    assert.ok(toolbar._colors.get('#ff0000').pseudo.has('checked'));
    assert.ok(toolbar._gradient.pseudo.has('checked'));
});
