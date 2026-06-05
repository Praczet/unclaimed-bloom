type:: note
tags:: [[unclaimed-bloom]], [[future-me]], [[wallset]], [[recipes]], [[themes]]
status:: living
updated:: [[2026-06-05]]
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
  -> adapter/template
  -> real config file
```

Normal command:

```bash
wallset
```

That picks a wallpaper, runs Matugen, grows colors, and applies the desktop.

If you already know the wallpaper:

```bash
wallset ~/Pictures/wallpapers/something.png
```

## What wallset Does

`wallset` is the friendly wallpaper command.

It does not contain the color brain. It is the doorbell.

It:

- opens Rofi so you can pick a wallpaper
- uses the Rofi wallpaper theme with image icons
- passes the selected file to `wallset-backend`

The backend runs:

```bash
spore sow desktop --wallpaper <wallpaper>
spore grow desktop
```

`desktop` is a composition profile:

```text
profiles/desktop.json
```

It currently runs:

```text
daily-gtk gtk
daily
```

That means:

- GTK gets its own Graphite-ish neutral profile first
- the rest of the desktop gets the normal `daily` profile after that
- `current-profile` ends as `daily`

This is intentional. Do not "fix" it at 1 AM unless you enjoy rebuilding the
same idea from scratch like a man cursed by tabs.

## Important Files

Profiles:

```text
profiles/
```

Target recipes and templates:

```text
targets/<target>/recipes/
targets/<target>/templates/
```

Base palettes:

```text
palettes/
```

Mood weights:

```text
moods/
```

Generated cache:

```text
~/.cache/unclaimed-bloom/
```

Real installed config files are usually under:

```text
~/.config/
~/.local/share/
```

## Words You Will Forget

### Palette

A palette is the boring base taste.

Examples:

```text
palettes/tokyonight-moon.json
palettes/graphite-dark.json
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

If everything is too pastel, too wallpaper-colored, or too much, try a calmer
mood.

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
spore inspect daily waybar
```

or:

```bash
spore inspect desktop gtk
```

### Recipe

A recipe is where a target decides how to use the bloom.

This is usually the file you want.

Examples:

```text
targets/yazi/recipes/subtle-ish.json
targets/waybar/recipes/source-heavy.json
targets/gtk/recipes/graphite-dark.json
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

If waybar is too goddamn pastel, look at:

```text
targets/waybar/recipes/source-heavy.json
profiles/daily.json
```

`daily` currently chooses:

```json
"waybar": "source-heavy"
```

So yes, if waybar is too much, future Adam, the file name was literally trying
to warn you.

Change it to:

```json
"waybar": "subtle-ish"
```

or reduce the `mix` values in:

```text
targets/waybar/recipes/source-heavy.json
```

Then run:

```bash
spore sow daily waybar
spore grow daily waybar
```

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
CSS alias, or writing the wrong kind of config, check the template or adapter.

## Where Do I Change Yazi Colors?

Open:

```text
targets/yazi/recipes/subtle-ish.json
```

Then inspect:

```bash
spore inspect daily yazi
```

Apply only yazi:

```bash
spore sow daily yazi
spore grow daily yazi
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

## Where Do I Change Waybar Colors?

Profile choice:

```text
profiles/daily.json
```

Recipes:

```text
targets/waybar/recipes/subtle-ish.json
targets/waybar/recipes/source-heavy.json
```

Generated output:

```text
~/.config/waybar/colors/matugen.css
```

Commands:

```bash
spore inspect daily waybar
spore sow daily waybar
spore grow daily waybar
```

If it is pastelish, first check whether `daily` uses `source-heavy`.

It probably does.

Yes, this is your handwriting.

## Where Do I Change GTK Colors?

GTK is special because GTK cannot be trusted with power.

GTK uses its own profile:

```text
profiles/daily-gtk.json
```

The `desktop` composition runs that first:

```text
profiles/desktop.json
```

GTK recipes:

```text
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

Use:

```bash
spore inspect desktop gtk
spore sow desktop gtk
spore grow desktop gtk
```

GTK surfaces should mostly come from Graphite base colors, not Matugen.

If Thunar becomes purple again, look for `source_color` in:

```text
targets/gtk/recipes/graphite-dark.json
```

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

## Where Do I Change Rofi Colors?

Rofi target recipe:

```text
targets/rofi/recipes/subtle-ish.json
```

Generated shared Rofi colors:

```text
~/.config/rofi/shared/matugen.rasi
```

Rofi theme used by `wallset`:

```text
~/.config/rofi/launchers/type-2/style-10.rasi
```

Override the picker theme:

```bash
UB_WALLSET_ROFI_THEME=~/.config/rofi/themes/peek/peek-preview.rasi wallset
```

## How To Change Which Recipe A Target Uses

Edit the profile:

```text
profiles/daily.json
```

Example:

```json
"waybar": "source-heavy"
```

Change to:

```json
"waybar": "subtle-ish"
```

Or use the CLI:

```bash
spore set daily waybar subtle-ish --apply
```

If you only want to test without applying:

```bash
spore sow daily waybar
spore inspect daily waybar
```

## How To See What Is Happening

List profiles:

```bash
spore profile list
```

List recipes:

```bash
spore recipe list
spore recipe list waybar
```

Validate recipes:

```bash
spore recipe validate
```

Inspect a target:

```bash
spore inspect daily waybar
```

Status:

```bash
spore status desktop
```

## Common Problems

### Everything Is Too Wallpaper-Colored

Check:

```text
moods/
profiles/daily.json
targets/<target>/recipes/
```

Reduce `mix`.

Move from `source-heavy` to `subtle-ish`.

Use `{ "base": "..." }` for surfaces.

### One App Is Wrong

Go to:

```text
targets/<app>/recipes/
```

Then inspect:

```bash
spore inspect daily <app>
```

### The Generated File Has The Wrong Shape

Recipe is probably not enough.

Check:

```text
targets/<app>/templates/
src/adapters/<App>Adapter.ts
```

### I Changed A Recipe And Nothing Happened

You forgot to sow/grow.

Again.

Run:

```bash
spore sow daily <target>
spore grow daily <target>
```

For GTK:

```bash
spore sow desktop gtk
spore grow desktop gtk
```

For everything:

```bash
spore sow desktop
spore grow desktop
```

## Final Reminder

Do not start by rewriting the adapter.

Do not start by blaming Matugen.

Do not start by inventing `PaletteHydratorAbstractThemeMoodProvider`.

Start here:

```text
profiles/<profile>.json
targets/<target>/recipes/<recipe>.json
spore inspect <profile> <target>
```

Most of the time, the answer is:

```text
wrong recipe,
too much mix,
or source-heavy got invited and nobody supervised it.
```
