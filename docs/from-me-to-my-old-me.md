type:: note
tags:: [[unclaimed-bloom]], [[future-me]], [[wallset]], [[recipes]], [[themes]]
status:: living
updated:: [[2026-10-23]]
project:: [[Projects/Unclaimed Bloom]]
related:: [[docs/PROJECT-CAPSULE.md]], [[README.md]]

# From Me To My Old Me

Hello Adam.

You forgot again.

This is fine. Not ideal, but historically accurate.

This file is the plain version of how Unclaimed Bloom works and where to poke it
when some app looks like it was dipped in pastel soup by a very confident
machine.

## The Short Version

Unclaimed Bloom does this:

```text
wallpaper
  -> Matugen source colors
  -> base palette + mood
  -> bloom
  -> target recipe
  -> spore
  -> template renderer  (sow + grow)
  -> plant hook         (plant)
  -> real config file
```

Normal command:

```bash
wallset
```

That picks a wallpaper, runs Matugen, grows colors, and applies the desktop.

If you already know the wallpaper:

```bash
wallset ~/.config/backgrounds/something.png
```

If you changed something in this repo and want to see it:

```bash
spore sync --apply
```

That one is new, and it is the one you will forget. Read the next section.

## There Are Two Copies Of Everything

This is the thing that will bite you.

```text
~/Development/Hyprland/unclaimed-bloom/   the repo — where you edit
~/.config/unclaimed-bloom/                the installed copy — what spore reads
```

The installed `spore`, `wallset` and friends read **`~/.config/unclaimed-bloom`**,
not the repo. That is on purpose: you can break things in the repo without
breaking the desktop.

So editing a recipe in the repo changes nothing until it is copied over:

```bash
spore sync            # copy changed palettes, moods, profiles, recipes, templates, hooks
spore sync --apply    # same, then rerun wallset with the current wallpaper
spore sync --dry-run  # what would be copied
spore sync scripts    # scripts are left out unless you ask
```

Copied files get the current time as their timestamp, so claimed-bloom can tell
that a sow is older than its inputs.

Not `scripts/install --force`. That one deletes and recopies everything, rewrites
the launchers, and keeps old timestamps. Use it when the launchers changed, not
when a recipe did.

Two more traps in the same family:

- `spore replant <profile> <target> <recipe>` edits the profile in
  `~/.config`, **not in the repo**. The next `spore sync` puts the repo's
  version back. If you want to keep a recipe switch, edit `profiles/` in the
  repo and sync.
- `scripts/spore` (the dev wrapper in the repo) reads the **repo** instead of
  `~/.config`. Same for `deno task dev:local`. Handy for trying things; confusing
  if you forgot which `spore` you ran.

If you do not know whether the two copies agree: open claimed-bloom and look at
**Check**. It says what is outdated and what to run.

## What wallset Does

`wallset` is the friendly wallpaper command.

It does not contain the color brain. It is the doorbell.

It:

- opens the Qreep wallpaper picker (or fuzzel/fzf if Qreep is not running),
  showing `~/.config/backgrounds` (`UB_WALLPAPER_DIR` changes that)
- passes the chosen file to `wallset-backend`

The backend:

```text
writes ~/.cache/unclaimed-bloom/current-wallpaper
runs Matugen on the wallpaper            (scripts/matugen-cache)
spore sow <profile> --wallpaper … --bloom-osd
spore grow <profile>
sets the wallpaper with awww
spore plant <profile> --bloom-osd
```

`<profile>` is whatever you chose with:

```bash
spore profile use desktop-graphite-blooming
```

(falling back to `desktop`). Override one run with
`UB_WALLSET_PROFILE=daily-light wallset`.

Planting takes about a minute. Most apps change within seconds; `hyprlock`
(about 15 s, it prepares its blurred background) and `icons` (about 50 s, it
recolours tens of thousands of SVGs) take the rest, and everything after
hyprlock waits for it. If you look straight after picking and nothing changed:
wait. The Qreep bloom OSD shows the progress.

## Compositions

The profiles you actually use are compositions:

```text
desktop-graphite-blooming   = daily-gtk-blooming (gtk, gimp) + daily-graphite-blooming (the other 31)
desktop-ash-dark-dormant    = daily-ash-dark-gtk-dormant (gtk, gimp) + daily-ash-dark-dormant
…
desktop                     = daily-gtk (gtk) + daily          ← the original
```

Name pattern: `desktop-<palette>-<mood>`. Pick a different one with
`spore profile use …` and then `wallset` (or `spore sync --apply`).

That means:

- GTK (and GIMP) get their own profile, so they can use calmer recipes than the rest
- the rest of the desktop gets the big `daily-*` profile
- `current-profile` is whatever you `profile use`d, the composition itself

This is intentional. Do not "fix" it at 1 AM unless you enjoy rebuilding the
same idea from scratch like a man cursed by tabs.

Two things compositions do **not** do:

- **They ignore the `[target]` argument.** `spore sow desktop-graphite-blooming yazi`
  sows all 33 targets. To work on one target, use the plain profile that plants
  it (see "One Target Only" below).
- **They have no spores of their own.** `spore inspect spore desktop-graphite-blooming yazi`
  fails; the spore lives under the run's profile:
  `spore inspect spore daily-graphite-blooming yazi`.

## One Target Only

Find which plain profile plants the target now (claimed-bloom → Show → Targets
says "Planted now by …", or `spore profile show <composition>`), then:

```bash
spore sow   daily-graphite-blooming yazi
spore grow  daily-graphite-blooming yazi
spore plant daily-graphite-blooming yazi
```

Afterwards `spore status` and claimed-bloom say the last sow/grow/plant "ran
for daily-graphite-blooming" instead of your composition. That is true and
harmless; the next `wallset` puts it back.

## Important Files

In the repo (edit here, then `spore sync`):

```text
profiles/                      profiles and compositions
palettes/                      base palettes
moods/                         mood weights
targets/<target>/recipes/      how a target reads the bloom
targets/<target>/templates/    the shape of the final config file
targets/<target>/hooks/        where it lands and what reloads
```

Generated:

```text
~/.cache/unclaimed-bloom/      blooms, spores, rendered files, run state
```

Real installed app config files are usually under:

```text
~/.config/
~/.local/share/
```

claimed-bloom's own stuff (its themes, the selected theme, the complaint quotes):

```text
~/.config/claimed-bloom/
```

## Words You Will Forget

### Palette

A palette is the boring base taste.

Examples:

```text
palettes/nord-tweak-dark.json   the graphite compositions
palettes/ash-dark.json          the ash-dark compositions
palettes/tokyonight-moon.json   daily
palettes/graphite-light.json
```

It says what `background`, `foreground`, `blue`, `red`, `border`, and other base
colors mean before the wallpaper starts yelling.

If everything is too blue, too grey, too contrasty, or too weak before Matugen
even gets involved, check the palette.

### Mood

A mood controls how strongly the wallpaper/source colors pull on the base
palette.

Files:

```text
moods/dormant.json
moods/budding.json
moods/blooming.json
moods/overgrown.json
```

Rough meaning:

```text
dormant   = wallpaper mostly shut up
budding   = small wallpaper influence
blooming  = normal daily influence
overgrown = Matugen has been given the microphone
```

Each mood has four weights: surfaces (backgrounds, borders), text, accents, and
states (danger, warning…). claimed-bloom → Show → Moods puts them side by side.

If everything is too pastel, too wallpaper-colored, or too much, try a calmer
mood — that is, a calmer composition: `desktop-graphite-dormant` instead of
`desktop-graphite-blooming`.

### Bloom

A bloom is the shared semantic color result.

Example bloom tokens:

```text
surface.base
surface.raised
text.primary
accent.primary
state.danger
selection.background
```

Generated bloom files live here:

```text
~/.cache/unclaimed-bloom/blooms/
```

You usually do not hand-edit blooms. They are generated.

Inspect one:

```bash
spore inspect bloom daily-graphite-blooming
```

Inspect what one target got from it:

```bash
spore inspect spore daily-graphite-blooming yazi
```

### Recipe

A recipe is where a target decides how to use the bloom.

This is usually the file you want.

Examples:

```text
targets/yazi/recipes/subtle-ish.json
targets/nvim/recipes/source-heavy.json
targets/gtk/recipes/nord-tweak-dark.json
targets/ghostty/recipes/subtle-ish.json
```

A recipe token can say:

Use the shared bloom:

```json
{ "bloom": "surface.base" }
```

Use bloom, then pull a little toward Matugen:

```json
{ "bloom": "accent.primary", "source": "primary", "mix": 0.15 }
```

Use pure base palette:

```json
{ "base": "background" }
```

Translation:

```text
mix 0.00 = no extra source pull
mix 0.15 = tiny source pull
mix 0.50 = serious source pull
mix 0.90 = wallpaper has taken hostages
```

Most targets use `subtle-ish`. A few still have a `source-heavy` recipe, and
`daily` still picks it for `nvim` and `qreep`. If Neovim is too goddamn pastel
under `daily`, look at:

```text
profiles/daily.json
targets/nvim/recipes/source-heavy.json
```

`daily` currently chooses:

```json
"nvim": "source-heavy"
```

So yes, if it is too much, future Adam, the file name was literally trying to
warn you.

Change it to:

```json
"nvim": "subtle-ish"
```

or reduce the `mix` values in the recipe. Then `spore sync --apply`.

### Template

A template is the shape of the final config file.

Example:

```text
targets/gtk/templates/unclaimed-bloom.css
```

Templates contain placeholders like:

```text
{{window_bg_color}}
```

The recipe creates the value. The template decides where that value goes.

If the color is wrong, check the recipe.

If the generated file is structurally wrong, missing a variable, using the wrong
CSS alias, or writing the wrong kind of config, check the template.

### Plant hook

A plant hook is what deploys the rendered file to its real destination.

```text
targets/<target>/hooks/plant.json
```

It has `copy` steps (copy rendered file to config path) and optional `exec` steps
(run reload commands, gsettings updates, etc.).

If a target is being grown but nothing is changing on disk after `grow`,
you need to run `plant` as well. Or check if the hook is missing.

claimed-bloom → Show → Targets lists, for every target, where it lands and what
runs after.

## Where Do I Change Yazi Colors?

Open:

```text
targets/yazi/recipes/subtle-ish.json
```

Copy it over and inspect:

```bash
spore sync recipes
spore sow daily-graphite-blooming yazi
spore inspect spore daily-graphite-blooming yazi
```

Apply only yazi:

```bash
spore grow  daily-graphite-blooming yazi
spore plant daily-graphite-blooming yazi
```

The adapter writes:

```text
~/.config/yazi/theme.toml
```

If yazi looks too pastel, reduce `mix` values or switch tokens from:

```json
{ "bloom": "...", "source": "...", "mix": 0.35 }
```

to:

```json
{ "bloom": "..." }
```

or:

```json
{ "base": "..." }
```

## Where Do I Change GTK Colors?

GTK is special because GTK cannot be trusted with power.

GTK uses its own profile inside every composition:

```text
profiles/daily-gtk-blooming.json          graphite compositions (one per mood)
profiles/daily-ash-dark-gtk-dormant.json  ash-dark compositions (one per mood)
profiles/daily-gtk.json                   the original desktop
```

GTK recipes, one per palette family:

```text
targets/gtk/recipes/nord-tweak-dark.json
targets/gtk/recipes/ash-dark.json
targets/gtk/recipes/graphite-dark.json
targets/gtk/recipes/graphite-light.json
targets/gtk/recipes/subtle-ish.json
```

GTK template:

```text
targets/gtk/templates/unclaimed-bloom.css
```

Generated output includes:

```text
~/.config/gtk-4.0/gtk.css
~/.local/share/themes/ADArt-Unclaimed-Bloom/
```

Use the GTK run's profile, not the composition:

```bash
spore inspect spore daily-gtk-blooming gtk
spore sow   daily-gtk-blooming gtk
spore grow  daily-gtk-blooming gtk
spore plant daily-gtk-blooming gtk
```

GTK surfaces should mostly come from the base palette, not Matugen.

If Thunar becomes purple again, look for `source_color` and other `"source"`
pulls on surface tokens in the GTK recipe the profile uses. Of the GTK recipes,
`subtle-ish.json` is the one that pulls `source_color` into several tokens; the
per-palette ones (`nord-tweak-dark`, `ash-dark`, `graphite-*`) do not.

If big surfaces use this:

```json
{ "bloom": "surface.raised", "source": "source_color", "mix": 0.15 }
```

that is probably why the file manager looks like wallpaper juice.

For calm GTK surfaces, prefer:

```json
{ "base": "background" }
```

or:

```json
{ "base": "background_highlight" }
```

The structural GTK theme (widget shapes, Thunar rules) still lives in the
sibling `adart-matugener-gtk-theme` repo. See [gtk.md](gtk.md).

## Where Do I Change Rofi Colors?

Rofi target recipe:

```text
targets/rofi/recipes/subtle-ish.json
```

Generated shared Rofi colors:

```text
~/.config/rofi/shared/matugen.rasi
```

(wallset no longer uses Rofi for picking wallpapers; Qreep does that now.)

## How To Change Which Recipe A Target Uses

Edit the profile **in the repo**:

```text
profiles/daily-graphite-blooming.json
```

Example:

```json
"nvim": "source-heavy"
```

Change to:

```json
"nvim": "subtle-ish"
```

Then:

```bash
spore sync --apply
```

`spore replant <profile> <target> <recipe> --apply` also works, but it edits
`~/.config` only, and the next `spore sync` undoes it. Fine for trying; edit the
repo to keep it.

If you only want to test without applying:

```bash
spore sync profiles
spore sow daily-graphite-blooming nvim
spore inspect spore daily-graphite-blooming nvim
```

## How To See What Is Happening

The quick answer:

```bash
spore status
```

Current profile, its runs, when sow/grow/plant last ran, and every target's
recipe and colors. Spores nobody uses anymore are listed at the bottom.

The friendlier answer: claimed-bloom.

```bash
cd src/claimed-bloom && bun run dev
```

- **Check** — is anything the current theme uses outdated, and what to run
- **Do** — run that
- **Show** — profiles, palettes, moods, targets, recipes, and what changed where

The CLI way:

```bash
spore profile list
spore profile show desktop-graphite-blooming
spore recipe list
spore recipe list yazi
spore recipe validate yazi
spore inspect spore daily-graphite-blooming yazi
```

## Common Problems

### I Changed A Recipe And Nothing Happened

You forgot to sync.

Again.

The installed spore reads `~/.config/unclaimed-bloom`, not the repo:

```bash
spore sync --apply
```

If you did sync: you forgot to sow/grow/plant. `--apply` does that for you.

### I Picked A Wallpaper And The Theme Did Not Change

Two usual reasons.

1. **It did change, you were early.** Planting takes about a minute; hyprlock
   and icons are slow and the rest waits for hyprlock. Watch the Qreep OSD.
2. **Only the accents changed.** In dark mode Matugen's background is
   near-black for almost any wallpaper, and blooming only lets a quarter of it
   into surfaces. So backgrounds barely move (on 2026-10-23 two very different
   wallpapers gave Ghostty `#25282d` and `#252831`) while accents swung from
   olive to lavender. If you want the wallpaper all over the place, use an
   `overgrown` composition.

`spore status` shows when plant last finished. If it says `running`, see 1.

### Everything Is Too Wallpaper-Colored

Check:

```text
moods/
profiles/<profile>.json
targets/<target>/recipes/
```

Use a calmer composition (`…-dormant` or `…-budding`).

Reduce `mix`.

Move from `source-heavy` to `subtle-ish`.

Use `{ "base": "..." }` for surfaces.

### One App Is Wrong

Go to:

```text
targets/<app>/recipes/
```

Then inspect (with the run profile, not the composition):

```bash
spore inspect spore daily-graphite-blooming <app>
```

### The Generated File Has The Wrong Shape

Recipe is probably not enough.

Check:

```text
targets/<app>/templates/
targets/<app>/hooks/plant.json
```

### I Asked For One Target And It Did All Of Them

You used the composition. Compositions ignore the target. Use the plain profile
that plants it: see "One Target Only".

### Status Says A Stage "Ran For" Some Other Profile

You did a one-target run on a plain profile. True and harmless; the next
`wallset` or `spore sync --apply` puts it back.

## Final Reminder

Do not start by rewriting the template.

Do not start by blaming Matugen.

Do not start by inventing `PaletteHydratorAbstractThemeMoodProvider`.

Start here:

```text
claimed-bloom → Check
profiles/<profile>.json
targets/<target>/recipes/<recipe>.json
spore sync --apply
spore inspect spore <run-profile> <target>
```

Most of the time, the answer is:

```text
wrong recipe,
too much mix,
forgot to sync,
or source-heavy got invited and nobody supervised it.
```
