# Adding a New Target

A target is one app that Unclaimed Bloom themes. Adding one requires four things: a recipe, a template, a plant hook, and a profile entry.

---

## 1. Decide the token set

Look at how the app is configured. Find its theme/color file and identify every color slot it exposes. Group them into semantic roles:

| Role | Bloom token to reach for |
|---|---|
| Main background | `surface.base` |
| Panel / raised surface | `surface.raised` |
| Status bar / dark inset | `surface.dim` |
| Primary text | `text.primary` |
| Secondary / dim text | `text.secondary`, `text.muted` |
| Primary accent | `accent.primary` |
| Secondary / tertiary accent | `accent.secondary`, `accent.tertiary` |
| Success (green) | `state.success` |
| Warning (yellow) | `state.warning` |
| Error / danger (red) | `state.danger` |
| Info (cyan / teal) | `state.info` |
| Borders, tree lines | `border.subtle`, `border.strong` |
| Selection bg / fg | `selection.background`, `selection.foreground` |

For each slot, pick a short token name (e.g. `bg`, `fg`, `accent`, `border`). These become the `{{placeholders}}` in the template.

Check what Matugen source colors are available:

```
spore palette inspect matugen
# or browse ~/.cache/unclaimed-bloom/matugen-colors.json
```

Common source names: `background`, `surface`, `surface_container`, `surface_container_high/highest/low/lowest`, `on_surface`, `on_surface_variant`, `primary`, `secondary`, `tertiary`, `error`, `outline`, `outline_variant`, etc.

---

## 2. Create the recipe

`targets/<name>/recipes/subtle-ish.json`

Each token maps a bloom semantic color to a Matugen source color, blended by `mix`:
- `mix: 0.0` = pure bloom color
- `mix: 1.0` = pure source color
- Typical range: `0.1`–`0.3`

```json
{
  "name": "subtle-ish",
  "target": "<name>",
  "tokens": {
    "bg": {
      "bloom": "surface.base",
      "source": "background",
      "mix": 0.15
    },
    "fg": {
      "bloom": "text.primary",
      "source": "on_surface",
      "mix": 0.1
    },
    "accent": {
      "bloom": "accent.primary",
      "source": "primary",
      "mix": 0.15
    }
  }
}
```

A token with only `bloom` uses no source blending:

```json
"fg_on_accent": { "bloom": "surface.base" }
```

Validate the bloom token names used in the recipe:

```
spore recipe validate <name>
```

---

## 3. Create the template

`targets/<name>/templates/<output-filename>`

The filename must match what the app expects (e.g. `theme.toml`, `colors.conf`, `unclaimed-bloom.hjson`).

Use `{{token_name}}` for each color slot. The renderer replaces each placeholder with a `#rrggbb` hex value. For other formats, modifiers are available:

| Syntax | Output |
|---|---|
| `{{accent}}` | `#acb3fe` |
| `{{accent\|rgba}}` | `rgba(172, 179, 254, ff)` |
| `{{accent\|rgba:0.5}}` | `rgba(172, 179, 254, 0.5)` |

Every `{{token}}` in the template must exist in the recipe; missing tokens cause `grow` to fail.

---

## 4. Create the plant hook

`targets/<name>/hooks/plant.json`

The hook runs after `grow` and deploys the rendered file. The most common pattern is a copy step:

```json
{
  "steps": [
    { "type": "copy", "dest": ["~/.config/<app>/colors/matugen.conf"] }
  ]
}
```

For apps that need a reload signal after the file is copied, chain an `exec` step:

```json
{
  "steps": [
    { "type": "copy", "dest": ["~/.config/<app>/colors/matugen.conf"] },
    { "type": "exec", "command": "bash", "args": ["-c", "<reload-command> || true"] }
  ]
}
```

The copy `dest` is an array because the same file can be deployed to multiple paths.

Available step types:

| Type | Purpose |
|---|---|
| `copy` | Copy rendered file to one or more destination paths |
| `exec` | Run an arbitrary command |
| `worker` | Run a Python worker script (for heavy jobs like icon generation) |

---

## 5. Copy to user config

The system reads from `~/.config/unclaimed-bloom/targets/`. The repo at `~/Development/Hyprland/unclaimed-bloom/targets/` is the source of truth — copy after creating:

```bash
TARGET=<name>
REPO=~/Development/Hyprland/unclaimed-bloom
CONF=~/.config/unclaimed-bloom

mkdir -p "$CONF/targets/$TARGET"/{recipes,templates,hooks}
cp "$REPO/targets/$TARGET/recipes/"*.json  "$CONF/targets/$TARGET/recipes/"
cp "$REPO/targets/$TARGET/templates/"*     "$CONF/targets/$TARGET/templates/"
cp "$REPO/targets/$TARGET/hooks/"*.json    "$CONF/targets/$TARGET/hooks/"
```

Or re-run the full install to sync everything:

```bash
~/Development/Hyprland/unclaimed-bloom/scripts/install
```

---

## 6. Add to the profile

Edit `~/.config/unclaimed-bloom/profiles/daily.json` and add the target with its recipe name:

```json
"targets": {
    "<name>": "subtle-ish",
    ...
}
```

Order matters — targets are planted in the order listed.

---

## 7. Test it

```bash
# Sow (generate spore) for just this target
spore sow daily <name>

# Grow (render template) for just this target
spore grow daily <name>

# Inspect rendered output before planting
cat ~/.cache/unclaimed-bloom/rendered/daily/<name>/<output-filename>

# Plant (deploy)
spore plant daily <name>
```

If `grow` errors with `Missing template tokens`, the token name in the template doesn't match any key in the recipe. If `sow` errors, the bloom token name is invalid — run `spore recipe validate <name>` to check.

---

## Checklist

- [ ] `targets/<name>/recipes/subtle-ish.json` — token → bloom + source + mix
- [ ] `targets/<name>/templates/<output-file>` — `{{token}}` placeholders
- [ ] `targets/<name>/hooks/plant.json` — copy + optional reload
- [ ] Copied to `~/.config/unclaimed-bloom/targets/<name>/`
- [ ] Added to `~/.config/unclaimed-bloom/profiles/daily.json`
- [ ] `spore sow daily <name>` passes
- [ ] `spore grow daily <name>` passes
- [ ] `spore plant daily <name>` passes
- [ ] App looks correct visually after next wallpaper change
