import {cpSync, existsSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {schemaCompiler} from './tools.js';

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {stdio: 'inherit', ...options});
    if (result.error) throw new Error(`${command} is required: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
const stage = mkdtempSync(join(tmpdir(), 'mirx-package-'));
try {
    for (const name of ['extension.js', 'prefs.js', 'metadata.json', 'stylesheet.css', 'src', 'schemas']) {
        if (!existsSync(name)) throw new Error(`Required package file missing: ${name}`);
        cpSync(name, join(stage, name), {recursive: true, filter: source => !source.endsWith('gschemas.compiled')});
    }
    if (existsSync('LICENSE')) cpSync('LICENSE', join(stage, 'LICENSE'));
    run(schemaCompiler(), ['--strict', join(stage, 'schemas')]);
    mkdirSync('dist', {recursive: true});
    const archive = resolve('dist/mirx@mirx.local.shell-extension.zip');
    rmSync(archive, {force: true});
    const zip = spawnSync('zip', ['-qr', archive, '.'], {cwd: stage, stdio: 'inherit'});
    if (zip.error?.code === 'ENOENT') {
        run('python3', ['-c', `import os, sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as archive:
    for root, dirs, files in os.walk('.'):
        dirs.sort()
        for name in sorted(files):
            path = os.path.join(root, name)
            archive.write(path, path[2:])`, archive], {cwd: stage});
    } else if (zip.error || zip.status !== 0) {
        throw new Error(`zip failed: ${zip.error?.message ?? zip.status}`);
    }
    console.log(`Created ${archive}. Install it manually; no installation was performed.`);
} finally {
    rmSync(stage, {recursive: true, force: true});
}
