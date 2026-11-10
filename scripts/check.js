import {readdirSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {schemaCompiler} from './tools.js';

const metadata = JSON.parse(readFileSync('metadata.json', 'utf8'));
if (metadata.uuid !== 'mirx@mirx.local' || metadata['settings-schema'] !== 'org.gnome.shell.extensions.mirx' || !metadata['shell-version']?.includes('50'))
    throw new Error('Invalid extension metadata');
function javascriptFiles(path) {
    return readdirSync(path, {withFileTypes: true}).flatMap(entry => {
        if (['.git', 'node_modules', 'dist'].includes(entry.name)) return [];
        const name = join(path, entry.name);
        return entry.isDirectory() ? javascriptFiles(name) : name.endsWith('.js') ? [name] : [];
    });
}
for (const file of javascriptFiles('.')) {
    const result = spawnSync(process.execPath, ['--check', file], {stdio: 'inherit'});
    if (result.status !== 0) process.exit(result.status ?? 1);
}
const schema = spawnSync(schemaCompiler(), ['--strict', '--dry-run', 'schemas'], {stdio: 'inherit'});
if (schema.error?.code === 'ENOENT') console.log('glib-compile-schemas unavailable; schema validation skipped.');
else if (schema.status !== 0) process.exit(schema.status ?? 1);
console.log('Metadata and JavaScript syntax checks passed.' +
    (schema.error?.code === 'ENOENT' ? ' Schema was not validated.' : ' Schema validation passed.')); 
