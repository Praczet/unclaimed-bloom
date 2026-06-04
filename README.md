# Unclaimed Bloom

> Unclaimed Bloom grows from ash, borrowed soil, and unclaimed hope.

Unclaimed Bloom is my recipe-driven theming system for a Linux desktop that has already lived too many lives.

It is not one more theme. It is the thing that tries to keep several half-wild theming projects from wandering into separate forests and pretending they never met.

It takes:

- a wallpaper-driven Matugen palette,
- a base palette such as TokyoNight Moon,
- a mood,
- a profile,
- target-specific recipes,

and grows one shared **bloom**. Then it scatters target-specific **spores** into Ghostty, GTK, icons, Neovim, AGS, swaync, waybar, Rofi, Hyprland, mycli, sqlit, SDDM, yazi, wlogout, and whatever else gets invited later.

Matugen is a source, not the god. TokyoNight Moon is a palette, not a prison. GTK is invited under supervision.

## The Shape

```text
wallpaper / Matugen / base palette
        ↓
source colors + mood + weights
        ↓
bloom
        ↓
target recipes
        ↓
spores
        ↓
adapters
        ↓
workers / templates / post-hooks
        ↓
Ghostty / GTK / icons / AGS / swaync / waybar / Neovim / …
```

A **bloom** is the shared semantic palette:

```text
surface.base
text.primary
accent.primary
state.danger
selection.background
```

A **spore** is what a specific target actually needs:

```text
Ghostty: background, foreground, palette_0...
GTK: accent_color, window_bg_color...
waybar: primary, surface, on_surface...
icons: __ADART_ICON_ACCENT_1__...
```

Recipes usually read from the bloom:

```json
"selected": { "bloom": "accent.primary" }
```

They can add a little extra Matugen pull:

```json
"primary": { "bloom": "accent.primary", "source": "primary", "mix": 0.15 }
```

And they can pin a token to the pure base palette when a target should stay calm:

```json
"background": { "base": "background" }
```

That last one is for cases like “Ghostty background should be pure TokyoNight, please stop being clever.”

## Related Ashes

Unclaimed Bloom grew out of existing theming work:

- **Matugen**: wallpaper color source and wallpaper setter.
- **TokyoNight Moon**: the main dark base palette and taste memory.
- **adart-matugener-icons**: Papirus-based recoloring, now called through the icons adapter.
- **adart-matugener-gtk-theme**: GTK theme output, still watched carefully.
- **Ghostty**: terminal theme output.
- **Neovim**: generated Lua colors for my Matugen/TokyoNight setup.
- **AGS**: visual shell pieces using generated CSS.
- **swaync and waybar**: now first-class targets, no longer hiding behind AGS like suspicious cousins.
- **mycli / sqlit / yazi / rofi / wlogout / SDDM / Hyprland / potato / iced**: smaller but real target spores.

Old Bash and Python scripts are not shame. They are workers. If they already know how to do the dirty work, `spore` can call them and collect reports. Purity is how projects become beautiful and dead.

## Requirements

- Node.js 20+
- npm
- Matugen, for wallpaper-based palettes
- zsh, if you want the completions

Install dependencies:

```bash
npm install
```

## Install

```bash
scripts/install
```

By default this installs:

```text
~/.local/bin/spore
~/.local/bin/unclaimed-bloom
~/.config/unclaimed-bloom/
~/.config/zsh/completions/
```

The installed `spore` launcher runs code from this repo, but reads data from:

```text
~/.config/unclaimed-bloom
```

Refresh installed data after changing recipes/palettes/profiles:

```bash
scripts/install --force
```

Make sure this is on your `PATH`:

```bash
~/.local/bin
```

## Usual Wallpaper Flow

The normal desktop flow goes through:

```text
walset → walset-backend → spore sow --wallpaper → spore grow
```

`walset-backend` reads the last used profile from:

```text
~/.cache/unclaimed-bloom/current-profile
```

If that file does not exist, it falls back to:

```text
daily
```

So the simple version is:

```bash
walset
```

Pick a wallpaper. Matugen runs. Bloom grows. Spores scatter. Config files change. Some programs reload. The desktop pretends this was always planned.

## Manual Use

Generate bloom and spores into cache:

```bash
spore sow daily
```

Generate from a wallpaper first:

```bash
spore sow daily --wallpaper ~/Pictures/wallpapers/something.png
```

Inspect before applying:

```bash
spore inspect daily ghostty
spore inspect daily waybar
```

Apply cached spores to real config files:

```bash
spore grow daily
```

Apply one target only:

```bash
spore grow daily ghostty
```

Check what has been generated:

```bash
spore status
```

## Discovery Commands

```bash
spore profile list
spore palette list
spore palette validate
spore mood list
spore recipe list
spore recipe list ghostty
spore recipe validate
spore recipe validate ghostty
```

`recipe validate` checks bloom paths, pure base tokens, mix ranges, required target tokens, and old direct mix shapes that should not sneak into shipped recipes.

## Workbench

Start the visual workbench:

```bash
unclaimed-bloom
```

or from the repo:

```bash
scripts/unclaimed-bloom
```

It opens:

```text
http://localhost:5173
```

The workbench shows:

- bloom swatches,
- profile tabs,
- target inspector,
- bloom token → source tint → result color,
- recipe/token count per target.

Start without opening a browser:

```bash
UB_OPEN_BROWSER=0 unclaimed-bloom
```

## Data Layout

Repo data:

```text
unclaimed-bloom/
├── palettes/       base palettes
├── moods/          mood weight presets
├── recipes/        target recipes
├── profiles/       saved ecosystems
├── templates/      target output templates
├── scripts/        launchers and workers
└── src/            TypeScript core, CLI, adapters, workbench
```

Runtime cache:

```text
~/.cache/unclaimed-bloom/
├── matugen-colors.json
├── current-profile
├── current-wallpaper
├── blooms/
├── spores/
├── reports/
├── ini/
└── icons-runtime.json
```

Installed data:

```text
~/.config/unclaimed-bloom/
├── palettes/
├── moods/
├── recipes/
├── profiles/
├── templates/
└── scripts/
```

## Current Targets

The useful ones:

```text
ghostty
gtk
icons
nvim
ags
swaync
waybar
hyprland
rofi
yazi
wlogout
iced
sddm
mycli
sqlit
potato
```

Each target has:

- a recipe,
- a generated spore,
- an adapter or worker path,
- a report after `grow`.

Some targets write directly to config files. Some call existing workers. Icons still do icon things, because of course they do.

## Development

Use the repo wrapper while developing:

```bash
scripts/spore <command> [args]
```

It sets:

```text
UB_DATA_DIR=<repo root>
UB_CACHE_DIR=~/.cache/unclaimed-bloom
```

Run checks:

```bash
npm run typecheck
spore recipe validate
spore palette validate
```

Build the CLI:

```bash
npm run build:cli
```

Then refresh the installed launchers/data:

```bash
scripts/install --force
```

## Commit Style

Use Conventional Commits:

```text
feat: add recipe validation command
fix: handle missing recipe token
docs: update project capsule
```

Do not add `Co-authored-by` trailers.

## Project Memory

The longer memory lives in:

```text
docs/PROJECT-CAPSULE.md
AGENTS.md
```

Read those before making architectural decisions. This repository has a sense of humor, but it also has load-bearing decisions hiding inside that humor.

Final operating principle:

```text
one bloom,
many spores,
borrowed soil,
old ash,
and enough hope to make the desktop feel less accidental.
```
