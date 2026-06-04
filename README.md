# Unclaimed Bloom

> Unclaimed Bloom grows from ash, borrowed soil, and unclaimed hope.

A recipe-driven theming system for Linux desktops. Takes color sources (Matugen, wallpaper) and blends them with selectable base palettes and moods, then scatters target-specific spores into tools like Ghostty, mycli, sqlit, icons, GTK, and Neovim.

Each target decides how much it borrows from the dynamic source palette and how much it keeps from the base palette. Existing Python/Bash scripts stay as workers behind adapters.

## Requirements

- Node.js 20+
- [tsx](https://github.com/privatenumber/tsx) (installed via `npm install`)
- Matugen (for wallpaper-based source palettes)

## Setup

```bash
npm install
```

## Install

```bash
scripts/install
```

By default this installs a `spore` launcher to `~/.local/bin/spore`, copies first-run data
files to `~/.config/unclaimed-bloom/`, and installs zsh completions to
`~/.config/zsh/completions/`.

## Usage

### Dev (via wrapper script)

```bash
scripts/spore <command> [args]
```

The wrapper sets `UB_DATA_DIR` to the repo root and `UB_CACHE_DIR` to `~/.cache/unclaimed-bloom` automatically.

### Dev (via npm)

```bash
UB_DATA_DIR=$(pwd) npm run spore -- <command> [args]
```

### Commands

```bash
# Scatter spores into cache (no side effects on config files)
scripts/spore sow <profile> [target]

# Scatter spores and call Matugen first to update the source palette
scripts/spore sow <profile> [target] --wallpaper <path/to/wallpaper.png>

# Grow cached spores into their final destinations (~/.config/, ~/.myclirc, etc.)
scripts/spore grow <profile> [target]

# Show sow/grow status for all profiles (or a specific one)
scripts/spore status [profile] [target]

# Print bloom and spore colors to stdout without writing anything
scripts/spore inspect <profile> [target]

# List available data files
scripts/spore palette list
scripts/spore mood list
scripts/spore recipe list [target]
scripts/spore recipe validate [target]
scripts/spore profile list

# Launch the Vite workbench (live swatch preview in the browser)
npm run workbench
```

### Example

```bash
# 1. Sow spores (Matugen runs automatically from wallpaper)
scripts/spore sow daily --wallpaper ~/.config/backgrounds/my-wallpaper.png

# 2. Eyeball the result before committing
scripts/spore inspect daily ghostty

# 3. Grow into config files
scripts/spore grow daily
```

### Wallpaper integration

`walset-backend` calls `spore sow <profile> --wallpaper <image>` followed by `spore grow <profile>`.
Matugen runs as part of `sow` (full template run + wallpaper set, then a dry-run to extract
the colors JSON). All UB-owned targets update automatically when you pick a wallpaper.

The last-used profile is written to `~/.cache/unclaimed-bloom/current-profile` on every `sow`
and read by `walset-backend` so it follows whichever profile you last ran.

## Data layout

```
unclaimed-bloom/          ← UB_DATA_DIR (repo root in dev)
├── palettes/             base palettes (tokyonight-moon, gruvbox-light, …)
├── moods/                mood weight presets (moonish, …)
├── recipes/              per-target token recipes
│   ├── ags/        ghostty/        gtk/        hyprland/
│   ├── iced/       icons/          mycli/      nvim/
│   ├── potato/     rofi/           sddm/       sqlit/
│   ├── swaync/     waybar/         wlogout/    yazi/
├── profiles/             saved ecosystems (daily, daily-light, …)
└── templates/            plain-text output templates
    └── gtk/

~/.cache/unclaimed-bloom/   ← UB_CACHE_DIR
├── matugen-colors.json     raw Matugen output (dark/light/default variants per token)
├── current-profile         name of the last profile passed to sow
├── current-wallpaper       path of the last wallpaper passed to sow (read by RofiAdapter)
├── icons-runtime.json      resolved icon token aliases (written by IconsAdapter)
├── blooms/                 generated shared semantic palettes
├── spores/                 generated target-specific color sets (namespaced by profile)
├── ini/                    intermediate INI files (mycli)
└── reports/                adapter run reports (namespaced by profile)
```

## Zsh completions

```bash
# Add to ~/.zshrc or source from your completions directory
source /path/to/unclaimed-bloom/completions/_spore
```

## Workbench

```bash
npm run workbench
```

Opens a Vite dev server at `http://localhost:5173` with a live swatch preview of all
cached bloom profiles. Swatches refresh automatically when you run `sow`.

To start the workbench and open it in a browser:

```bash
scripts/unclaimed-bloom
```

Set `UB_OPEN_BROWSER=0` to start it without opening a browser.

## Architecture

```
wallpaper / Matugen / base palette
        ↓
source colors + mood + weights
        ↓
bloom  (shared semantic palette)
        ↓
target recipes
        ↓
spores  (target-specific resolved colors)
        ↓
adapters
        ↓
workers / templates / post-hooks
        ↓
Ghostty / mycli / sqlit / icons / GTK / Neovim / …
```

All shipped recipes use the bloom directly for shared semantic roles:

```json
"background": { "bloom": "surface.base" },
"selected": { "bloom": "accent.primary", "source": "primary", "mix": 0.15 }
```

The engine still supports direct base/source mixing as an escape hatch for future target-specific behavior:

```json
"cursor_color": { "base": "blue", "source": "primary", "mix": 0.55 }
```

See `docs/PROJECT-CAPSULE.md` for full architecture and roadmap.
