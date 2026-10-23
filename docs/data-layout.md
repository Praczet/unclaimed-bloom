# Data Layout

## Repo

```text
unclaimed-bloom/
├── palettes/            base palettes
├── moods/               mood weight presets
├── profiles/            profiles and compositions
├── targets/<target>/    recipes/, templates/, hooks/plant.json
├── scripts/             launchers, workers, hook helpers
├── config/              small app configs (gummy-spore's voice)
├── docs/                this
└── src/
    ├── deno/            spore: core, CLI, workbench server
    └── claimed-bloom/   the terminal UI (Bun + OpenTUI)
```

## Installed config

`scripts/install` creates it; `spore sync` keeps it up to date.

```text
~/.config/unclaimed-bloom/
├── palettes/
├── moods/
├── profiles/
├── targets/
├── scripts/
└── notify.json          command for the bloom OSD
```

## Cache

```text
~/.cache/unclaimed-bloom/
├── matugen-colors.json     the wallpaper's colours (source)
├── current-profile         set by `spore profile use`
├── current-wallpaper       set by wallset
├── blooms/                 ← sow
├── spores/<profile>/       ← sow
├── rendered/<profile>/     ← grow; consumed by plant
├── reports/                timestamped JSON per run (accumulates — see maintenance.md)
├── events.jsonl            append-only run log (accumulates)
├── state.json              current run snapshot
├── state-{sow,grow,plant}.json   last run of each stage
├── ini/, icons-runtime.json      target helpers
└── walset.log, workbench.log
```

## claimed-bloom

```text
~/.config/claimed-bloom/
├── themes/theme-*.json   your themes; spore plants theme-unclaimed-bloom.json here
├── settings.json         the selected theme
└── quotes.json           the Complain screen's quotes
```
