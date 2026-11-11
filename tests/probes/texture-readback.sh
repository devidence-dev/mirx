#!/usr/bin/env bash
set -euo pipefail
probe_root=$(mktemp -d /tmp/mirx-isolated-readback.XXXXXXXX)
cleanup() { rm -rf -- "$probe_root"; }
trap cleanup EXIT
export XDG_DATA_HOME="$probe_root/data"
export XDG_CONFIG_HOME="$probe_root/config"
export XDG_DATA_DIRS="$probe_root/system:/usr/local/share:/usr/share"
export GSETTINGS_BACKEND=memory
export MIRX_PROBE_ROOT="$probe_root"
mkdir -p "$probe_root/system/gnome-shell/extensions/readback-probe@mirx.test" "$probe_root/system/gnome-shell/modes" "$XDG_CONFIG_HOME"
extension="$probe_root/system/gnome-shell/extensions/readback-probe@mirx.test"
cat > "$probe_root/system/gnome-shell/modes/mirx-probe.json" <<'EOF'
{"parentMode":"user","enabledExtensions":["readback-probe@mirx.test"]}
EOF
cat > "$extension/metadata.json" <<'EOF'
{"uuid":"readback-probe@mirx.test","name":"Mirx isolated readback probe","description":"Temporary synthetic GPU readback test","shell-version":["50"],"session-modes":["mirx-probe"]}
EOF
cat > "$extension/extension.js" <<'EOF'
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Gio from 'gi://Gio';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class Probe extends Extension {
    enable() {
        try {
            const input = new Uint8Array([
                255, 0, 0, 255, 0, 255, 0, 255,
                0, 0, 255, 255, 255, 255, 255, 255,
            ]);
            const context = Clutter.get_default_backend().get_cogl_context();
            const texture = Cogl.Texture2D.new_from_data(context, 2, 2, Cogl.PixelFormat.RGBA_8888, 8, input);
            const size = texture.get_data(Cogl.PixelFormat.RGBA_8888, 8, null);
            const output = new Uint8Array(size).fill(17);
            const returned = texture.get_data(Cogl.PixelFormat.RGBA_8888, 8, output);
            let pending = 1;
            const done = () => { if (--pending === 0) console.log('MIRX_PROBE_DONE'); };
            try {
                const stageOutput = new Uint8Array(16).fill(17);
                const rect = Mtk.Rectangle.new(0, 0, 2, 2);
                const success = global.stage.paint_to_buffer(
                    rect, 1, stageOutput, 8,
                    Cogl.PixelFormat.RGBA_8888, null, Clutter.PaintFlag.NO_CURSORS);
                const stageTexture = global.stage.paint_to_content(rect, 1, null, Clutter.PaintFlag.NO_CURSORS).get_texture();
                const stageStream = Gio.MemoryOutputStream.new_resizable();
                pending++;
                Shell.Screenshot.composite_to_stream(stageTexture, 0, 0, -1, -1, 1, null, 0, 0, 1, stageStream, (_source, result) => {
                    try {
                        const reference = Shell.Screenshot.composite_to_stream_finish(result).get_pixels();
                        console.log(`MIRX_PROBE_STAGE success=${success} output_changed=${stageOutput.some(v => v !== 17)} reference_changed=${reference.some(v => v !== 17)} actual=${Array.from(stageOutput)} reference=${Array.from(reference)}`);
                    } catch (error) { console.error(`MIRX_PROBE_STAGE_ERROR reference ${error.message}`); }
                    finally { stageStream.close(null); done(); }
                });
            } catch (error) { console.log(`MIRX_PROBE_STAGE_ERROR ${error.message}`); }
            const stream = Gio.MemoryOutputStream.new_resizable();
            Shell.Screenshot.composite_to_stream(texture, 0, 0, -1, -1, 1, null, 0, 0, 1, stream, (_source, result) => {
                try {
                    const pixbuf = Shell.Screenshot.composite_to_stream_finish(result);
                    const reference = pixbuf.get_pixels();
                    const directMatches = output.length === input.length && input.every((v, i) => output[i] === v);
                    const nativeMatches = reference.length >= input.length && input.every((v, i) => reference[i] === v);
                    console.log(`MIRX_PROBE_RESULT size=${size} returned=${returned} direct_matches=${directMatches} native_matches=${nativeMatches} actual=${Array.from(output)}`);
                } catch (error) { console.error(`MIRX_PROBE_ERROR callback ${error.message}`); }
                finally { stream.close(null); done(); }
            });
        } catch (error) { console.error(`MIRX_PROBE_ERROR setup ${error.stack}`); console.log('MIRX_PROBE_DONE'); }
    }
    disable() {}
}
EOF
dbus-run-session -- bash -c '
  set -u
  shell_log="$MIRX_PROBE_ROOT/shell.log"
  gnome-shell --headless --no-x11 --virtual-monitor=640x480 --wayland-display="mirx-probe-$$" --mode=mirx-probe >"$shell_log" 2>&1 &
  shell_pid=$!
  trap '\''kill -KILL "$shell_pid" 2>/dev/null || true; wait "$shell_pid" 2>/dev/null || true'\'' EXIT
  for ((attempt=0; attempt<30; attempt++)); do
    if grep -q MIRX_PROBE_DONE "$shell_log"; then
      grep MIRX_PROBE_ "$shell_log"
      exit 0
    fi
    if ! kill -0 "$shell_pid" 2>/dev/null; then
      tail -n 40 "$shell_log"
      exit 1
    fi
    sleep 1
  done
  tail -n 40 "$shell_log"
  exit 1
'
