# Bloom OSD

While a wallpaper run is sowing and planting, a progress overlay can show what
is happening. It used to live in AGS; it now lives in Qreep, the quickshell
shell.

![The bloom OSD: sow and grow done, plant at 12 of 33 targets, recolouring icons](images/bloom-osd.webp)

Enable it with `--bloom-osd`:

```bash
spore sow desktop-graphite-blooming --wallpaper ~/Pictures/thing.png --bloom-osd
spore plant desktop-graphite-blooming --bloom-osd
```

`wallset-backend` passes `--bloom-osd` automatically.

## How it works

spore does not know about Qreep. It runs whatever command is configured in
`~/.config/unclaimed-bloom/notify.json`, with a subcommand appended:

```json
{ "cmd": ["/home/you/Development/Hyprland/quickshell/Qreep/scripts/qreep-bloom-notify"] }
```

Use an absolute path; `~` is not expanded here.

- `sow --bloom-osd` sends `bloom-show <profile> [--wallpaper <path>]` before the run starts.
- `plant --bloom-osd` sends `bloom-done` when the run finishes successfully. If
  the run fails, `bloom-done` is not sent, so the overlay stays visible and you
  know something went wrong.

`qreep-bloom-notify` turns those into Qreep IPC calls (`quickshell ipc … call qreep-bloom …`).

While running, sow, grow and plant also write:

```text
~/.cache/unclaimed-bloom/state.json            current run snapshot, atomically replaced
~/.cache/unclaimed-bloom/state-{sow,grow,plant}.json   last run of each stage
~/.cache/unclaimed-bloom/events.jsonl          append-only log of every event
```

Any consumer can read them; `spore status` and claimed-bloom do.
