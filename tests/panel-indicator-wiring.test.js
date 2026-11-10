import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const extension = readFileSync(new URL('../extension.js', import.meta.url), 'utf8');

test('panel wiring uses the extension role and disconnects before teardown', () => {
    assert.match(extension, /Main\.panel\.addToStatusArea\(this\.uuid, indicator\)/);
    assert.match(extension, /this\._panelSettingsId\s*=\s*this\._settings\.connect\('changed::show-panel-icon'/);
    assert.match(
        extension,
        /shortcutLabel: \(\) => formatAccelerator\(this\._settings\.get_strv\('capture-shortcut'\)\[0\]\)/,
    );
    assert.match(
        extension,
        /this\._shortcutSettingsId\s*=\s*this\._settings\.connect\('changed::capture-shortcut',\s*\(\) =>\s*this\._panelController\.syncShortcut\(\)/,
    );
    const disable = extension.slice(extension.indexOf('    disable()'));
    assert.match(disable, /this\._settings\.disconnect\(this\._panelSettingsId\)/);
    assert.ok(
        disable.indexOf('this._settings.disconnect(this._panelSettingsId)') <
            disable.indexOf('this._panelController?.destroy()'),
    );
    assert.match(disable, /this\._settings\.disconnect\(this\._shortcutSettingsId\)/);
    assert.ok(
        disable.indexOf('this._settings.disconnect(this._shortcutSettingsId)') <
            disable.indexOf('this._panelController?.destroy()'),
    );
    assert.ok(disable.indexOf('this._panelController?.destroy()') < disable.indexOf('this._session?.destroy()'));
    assert.match(extension, /Main\.wm\.addKeybinding\(\s*'capture-shortcut',[\s\S]*?\(\) => this\._session\.open\(\)/);
    const sync = extension.indexOf('this._panelController.sync();');
    const keybinding = extension.indexOf('Main.wm.addKeybinding(');
    assert.ok(sync < keybinding);
    assert.doesNotMatch(extension.slice(sync, keybinding), /if\s*\(/);
});
