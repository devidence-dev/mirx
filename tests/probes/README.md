# GNOME 50 texture readback probe

`texture-readback.sh` runs a temporary GNOME Shell with a virtual monitor and a private D-Bus session. It generates a 2 × 2 synthetic texture with known RGBA pixels and compares two direct GJS readback APIs with the pixbuf returned by GNOME's existing screenshot helper. It does not capture the user's screen or modify the installed extension.

Run it on a GNOME Shell 50 machine as the logged-in user:

```sh
bash tests/probes/texture-readback.sh
```

The script uses a unique directory under `/tmp` for its mode and temporary extension, a unique Wayland display, and `GSETTINGS_BACKEND=memory`. It destroys the isolated Shell and temporary files when finished. The private D-Bus session may emit service-startup and shutdown messages. A graphical stack capable of running a headless GNOME Shell is required.

`MIRX_PROBE_RESULT` compares `Cogl.Texture.get_data()` against the known texture and against the native screenshot pixbuf. `MIRX_PROBE_STAGE` compares `Clutter.Stage.paint_to_buffer()` against a separate native screenshot of the same synthetic stage. `MIRX_PROBE_ERROR` or `MIRX_PROBE_STAGE_ERROR` means that part of the probe could not run. The result reports evidence; it does not modify or benchmark Mirx's production export path.
