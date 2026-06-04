# Prompt: Create a UB-compatible palette

Use this prompt verbatim (or paste it into any AI chat) to generate a new palette file
for the Unclaimed Bloom theming system. Fill in `[PALETTE NAME OR URL]` at the bottom.

---

## The task

I need a JSON palette file for the **Unclaimed Bloom** (UB) theming system.

The palette I want to create is based on: **[PALETTE NAME OR URL]**

If I gave you a name (e.g. "Monokai", "Nord", "Dracula"), look up the official color
values for that theme. If I gave you a URL, read the colors from there.

---

## Output format

Produce a single JSON file with this structure:

```json
{
  "name": "Human-readable Name",
  "slug": "kebab-case-name",
  "kind": "dark",
  "source": "URL or credit",
  "colors": {
    ...native palette keys (every original color, unchanged names)...

    ...canonical aliases (the 18 required keys, added after native keys)...
  }
}
```

`kind` must be `"dark"` or `"light"`.

---

## Two-section rule

The `colors` object has two sections:

1. **Native keys** — every color from the original palette, using the palette's own names
   (`base`, `surface`, `love`, `peach`, `overlay1`, etc.). Do not rename or remove these.
   They serve as documentation and may be useful for future recipes.

2. **Canonical aliases** — the 18 keys listed below, added after the native keys.
   These map the palette's native colors to UB's standard vocabulary.
   Leave a blank line between the two sections for readability.

---

## The 18 canonical keys (all required)

| Key | Semantic meaning |
|-----|-----------------|
| `background` | Main application background |
| `background_dark` | Darker background — panels, sidebars, statusbar |
| `background_highlight` | Raised/active surface — selected rows, cards, popups |
| `foreground` | Primary text / main content |
| `foreground_dark` | Secondary text — labels, metadata, less important content |
| `comment` | Muted / disabled text — code comments, placeholders, hints |
| `border` | Dividers, outlines, separator lines |
| `red` | Error, danger, destructive action |
| `green` | Success, added, positive |
| `yellow` | Warning, modified, caution |
| `blue` | Info, links, primary interactive color |
| `purple` | Keywords, special syntax, accent |
| `magenta` | Types, decorators, secondary accent |
| `cyan` | Strings, constants, tertiary accent |
| `teal` | Operators, punctuation, or a second shade of cyan |
| `orange` | Numbers, attributes, warm accent |
| `selection_background` | Background of a selected/highlighted region |
| `selection_foreground` | Text color on top of a selected region |

All 18 must be present in the output. No exceptions.

---

## Mapping decisions

### When the source palette has a clear equivalent
Map it directly. Examples:
- Catppuccin `mauve` → `purple`
- Catppuccin `peach` → `orange`
- Catppuccin `sky`   → `cyan`
- Rose Pine `love`   → `red`
- Rose Pine `iris`   → `purple`

### When the palette has no separate value for a key
Accept the overlap — use the closest color and note it. Examples:
- Rose Pine has no orange: use `rose` for both `magenta` and `orange`
- Rose Pine has no separate green vs blue: use `pine` for both `green` and `blue`
- Solarized has only two background levels: use the same hex for `background_dark`
  and `background_highlight`

Do NOT invent hex values that do not exist in the original palette.
Do NOT interpolate or blend colors yourself.

### Background hierarchy rule
`background` should be the lightest background for light themes, darkest for dark themes.
`background_dark` is slightly more extreme (darker for dark, lighter for light).
`background_highlight` is the raised/active surface — not a shadow, a lift.

### For light themes
`foreground` is the darkest readable text color.
`foreground_dark` is slightly lighter / less prominent.
`comment` is clearly muted but still readable.

### For dark themes
`foreground` is the lightest normal text.
`foreground_dark` is dimmer secondary text.
`comment` is the dimmest still-readable muted text.

### selection_foreground
Usually the same as `foreground` (text is still readable on the selection background).
Use a contrasting color only if the palette explicitly defines one for selections.

---

## Palette limitation notes

If the palette genuinely cannot distinguish between two canonical keys (e.g. no teal
separate from cyan, no orange separate from magenta), that is fine. Use the same hex
value for both. This is a palette limitation, not a UB error. Do not add a comment
about it inside the JSON — JSON has no comments. If you want to flag it, mention it
outside the JSON block in plain text.

---

## Example (Catppuccin Mocha, abbreviated)

```json
{
  "name": "Catppuccin Mocha",
  "slug": "catppuccin-mocha",
  "kind": "dark",
  "source": "https://catppuccin.com/palette/",
  "colors": {
    "rosewater": "#f5e0dc",
    "flamingo":  "#f2cdcd",
    "pink":      "#f5c2e7",
    "mauve":     "#cba6f7",
    "red":       "#f38ba8",
    "peach":     "#fab387",
    "yellow":    "#f9e2af",
    "green":     "#a6e3a1",
    "teal":      "#94e2d5",
    "sky":       "#89dceb",
    "blue":      "#89b4fa",
    "text":      "#cdd6f4",
    "overlay1":  "#7f849c",
    "surface2":  "#585b70",
    "surface1":  "#45475a",
    "base":      "#1e1e2e",
    "crust":     "#11111b",

    "background":           "#1e1e2e",
    "background_dark":      "#11111b",
    "background_highlight": "#45475a",
    "foreground":           "#cdd6f4",
    "foreground_dark":      "#bac2de",
    "comment":              "#7f849c",
    "border":               "#585b70",
    "red":                  "#f38ba8",
    "green":                "#a6e3a1",
    "yellow":               "#f9e2af",
    "blue":                 "#89b4fa",
    "purple":               "#cba6f7",
    "magenta":              "#f5c2e7",
    "cyan":                 "#89dceb",
    "teal":                 "#94e2d5",
    "orange":               "#fab387",
    "selection_background": "#6c7086",
    "selection_foreground": "#cdd6f4"
  }
}
```

---

## Validation check

Before returning the file, verify:
- [ ] All 18 canonical keys are present
- [ ] No canonical key has an empty string or a made-up color
- [ ] `kind` is `"dark"` or `"light"`
- [ ] `slug` matches the filename format: lowercase, hyphens, no spaces
- [ ] Native keys are preserved exactly as they appear in the source

---

## The palette I want

**[PALETTE NAME OR URL]**

Return only the JSON file. No extra explanation needed unless you had to make a
non-obvious mapping decision or the palette had a genuine limitation (e.g. no distinct orange).
