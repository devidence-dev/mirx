import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('panel icon preference is a boolean enabled by default', () => {
    const schema = read('schemas/org.gnome.shell.extensions.mirx.gschema.xml');
    assert.match(schema, /<key name="show-panel-icon" type="b">\s*<default>true<\/default>/);
});

test('preferences read, write and watch the panel icon setting', () => {
    const prefs = read('prefs.js');
    assert.match(prefs, /new Adw\.SwitchRow\(\{ title: 'Show icon in top bar' \}\)/);
    assert.match(prefs, /settings\.get_boolean\('show-panel-icon'\)/);
    assert.match(prefs, /settings\.set_boolean\('show-panel-icon', panelIcon\.active\)/);
    assert.match(prefs, /watch\('changed::show-panel-icon'/);
    assert.ok(prefs.indexOf('general.add(folder)') < prefs.indexOf('general.add(panelIcon)'));
});
