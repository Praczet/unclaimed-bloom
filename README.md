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

## Future Me Shortcut

If you came back after two weeks and already forgot where the colors live,
read:

```text
docs/from-me-to-my-old-me.md
```

It explains `wallset`, palettes, moods, blooms, recipes, templates, and where to
go when yazi, waybar, GTK, or anything else looks wrong in a way that feels
personal.

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
- **adart-matugener-gtk-theme**: sibling GTK theme repo, still provides the theme skeleton and widget/app CSS: <https://github.com/Praczet/adart-matugener-gtk-theme>
- **Ghostty**: terminal theme output.
- **Neovim**: generated Lua colors for my Matugen/TokyoNight setup.
- **AGS**: visual shell pieces using generated CSS.
- **swaync and waybar**: now first-class targets, no longer hiding behind AGS like suspicious cousins.
- **mycli / sqlit / yazi / rofi / wlogout / SDDM / Hyprland / potato / iced**: smaller but real target spores.

Old Bash and Python scripts are not shame. They are workers. If they already know how to do the dirty work, `spore` can call them and collect reports. Purity is how projects become beautiful and dead.

## Requirements

- Deno 2+
- Matugen, for wallpaper-based palettes
- zsh, if you want the completions

## Install

```bash
scripts/install
```

By default this installs:

```text
~/.local/bin/spore
~/.local/bin/unclaimed-bloom
~/.local/bin/wallset
~/.local/bin/wallset-backend
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
wallset → wallset-backend → spore sow desktop --wallpaper → spore grow desktop
```

`wallset` and `wallset-backend` are owned by this repository and installed by
`scripts/install`. The default profile is the `desktop` composition, which grows
GTK from `daily-gtk` first and then grows the rest from `daily`.
The old `walset` spelling is installed as a compatibility alias.

So the simple version is:

```bash
wallset
```

Pick a wallpaper. Matugen runs. Bloom grows. Spores scatter. Config files change. Some programs reload. The desktop pretends this was always planned.

Pass a wallpaper directly:

```bash
wallset ~/Pictures/wallpapers/something.png
```

Change the composition/profile used by the backend:

```bash
UB_WALLSET_PROFILE=daily-light wallset ~/Pictures/wallpapers/something.png
```

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

Deploy rendered files to their config destinations:

```bash
spore plant daily
```

Apply or plant one target only:

```bash
spore grow daily ghostty
spore plant daily ghostty
```

Check what has been generated:

```bash
spore status
```

## GTK Graphite Profile

GTK is intentionally split into its own profile so it can use a Graphite-style
neutral base without forcing the rest of the desktop to follow.

```bash
spore sow desktop
spore grow desktop
```

`profiles/desktop.json` is a composition profile. It runs `daily-gtk` for GTK,
then `daily` for the rest of the desktop, and leaves
`~/.cache/unclaimed-bloom/current-profile` set to `daily`.

The broad `daily` and `daily-light` profiles do not include GTK.

Important: Unclaimed Bloom has not fully swallowed the GTK sibling repo yet.
For now, UB owns the generated GTK colors and recipes, but the structural GTK
theme still comes from:

```text
https://github.com/Praczet/adart-matugener-gtk-theme
```

The GTK adapter writes generated color CSS into both the live theme install and
the sibling repo's `themes/ADArt-Unclaimed-Bloom/` tree. Do not delete that repo
until the GTK skeleton is moved into `targets/gtk/`.

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

- profile and target sidebar with current/active markers,
- overview with profile composition, target status, and per-target actions,
- bloom preview showing palette → source/mood → bloom derivation,
- target inspect view showing base/bloom/source/mix/result pipeline,
- read-only Recipe Workshop scoped to selected profile and target,
- recipe table with color badges and concrete path/context notes,
- recipe count per target so unused recipes are visible without becoming misleading previews,
- `sow` and `grow` buttons for all targets or one selected target,
- equivalent CLI snippets in the context panel,
- docs/help view with README opened first and generated live help,
- optional `Use Bloom palette` toggle with contrast guardrails and a small bloom preview.

Current Recipe Workshop rule:

```text
profile -> target -> recipe
```

Recipes are narrowed to the selected target. The profile-assigned recipe is active.
Other recipes for that same target may be shown as available but are not treated as
real previews until the workbench gets a dedicated read-only recipe preview API.

If the workbench is already running, `scripts/unclaimed-bloom` opens the existing
URL instead of starting a second server and losing a small argument with the port.

Use alternate ports when an old workbench is already squatting on the defaults:

```bash
UB_WORKBENCH_PORT=7866 UB_WORKBENCH_UI_PORT=5174 npm run workbench
```

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
├── profiles/       saved ecosystems
├── targets/        target modules: recipes, templates, target-local assets
├── scripts/        launchers and workers
└── src/            Deno core, CLI, server, workbench
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
├── profiles/
├── targets/
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
broot
```

Each target has:

- recipes under `targets/<name>/recipes/`,
- a template under `targets/<name>/templates/`,
- a plant hook under `targets/<name>/hooks/plant.json`,
- a rendered spore in cache after `grow`,
- a report after `plant`.

Some targets call existing workers. Icons still do icon things, because of course they do.

## Development

Run with repo data (avoids stale installed config):

```bash
deno task dev:local -- <command> [args]
```

Or set manually:

```bash
UB_DATA_DIR=$(pwd) deno task dev -- <command>
```

Run checks:

```bash
deno task check
deno task test
spore recipe validate
spore palette validate
```

Format and lint:

```bash
deno task fmt
deno task lint
```

Build and start the workbench:

```bash
deno task workbench
```

Refresh installed launchers and data:

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
