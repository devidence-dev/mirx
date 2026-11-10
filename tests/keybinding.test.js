import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Keybinding names are global in GNOME Shell: Ubuntu Dock registers 'shortcut' and removes it whenever the
// monitors change, which silently dropped a binding with the same name until the next login.
test('the capture keybinding has a namespaced name that is a schema key', () => {
    const extension = read('extension.js');
    const added = [...extension.matchAll(/Main\.wm\.addKeybinding\(\s*'([^']+)'/g)].map((m) => m[1]);
    const removed = [...extension.matchAll(/Main\.wm\.removeKeybinding\(\s*'([^']+)'\)/g)].map((m) => m[1]);
    assert.deepEqual(added, ['capture-shortcut']);
    assert.deepEqual(removed, added);
    assert.match(
        read('schemas/org.gnome.shell.extensions.mirx.gschema.xml'),
        /<key name="capture-shortcut" type="as">/,
    );
    assert.doesNotMatch(read('prefs.js'), /'(changed::)?shortcut'/);
});
