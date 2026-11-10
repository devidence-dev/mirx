import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('capture retains the stage content without reading back pixels', async () => {
    const source = (await readFile(new URL('../src/platform/capture.js', import.meta.url), 'utf8'))
        .replace(/^import .*;\n/gm, '').replace('export class ScreenCapture', 'class ScreenCapture');
    const content = {};
    const events = [];
    class Screenshot {
        screenshot_stage_to_content(callback) { events.push('capture'); callback(this, 'result'); }
        screenshot_stage_to_content_finish(result) { events.push(result); return [content, 2]; }
        static composite_to_stream() { throw new Error('unexpected pixel readback'); }
    }
    const context = {
        Shell: {Screenshot}, Meta: {WindowType: {DESKTOP: 1, DOCK: 2}},
        GLib: {DateTime: {new_now_local: () => ({format: () => 'date'})}},
        Main: {layoutManager: {monitors: [{x: 0, y: 0, width: 800, height: 600}]}},
        global: {display: {get_monitor_scale: () => 2, sort_windows_by_stacking: windows => windows},
            workspace_manager: {get_active_workspace: () => ({list_windows: () => []})}},
    };
    vm.runInNewContext(`${source}\nthis.ScreenCapture = ScreenCapture;`, context);
    const snapshot = await new context.ScreenCapture().capture();
    assert.equal(snapshot.content, content);
    assert.equal(snapshot.scale, 2);
    assert.deepEqual(events, ['capture', 'result']);
    assert.deepEqual(Object.keys(snapshot).sort(), ['capturedAt', 'content', 'monitors', 'scale', 'windows']);
});
