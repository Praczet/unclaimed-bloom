# Adart-Matugener GTK Theme Project Capsule

Generated: 2026-06-03

## Project Identity

This repository builds and installs `Adart-Moonmix`, a GTK theme derived from an older GTK Moonmix user CSS override setup.

The visual target is Tokyonight Moon with wallpaper-aware Matugen color influence:

- dark navy/purple base surfaces
- muted contrast
- restrained accent color
- Material/Matugen palette integration without becoming a generic Matugen theme

GTK3 is the main target. GTK4 support exists for plain GTK4 apps such as `pavucontrol`, but this project intentionally does not claim full libadwaita theming.

## Current Repository Shape

```text
README.md
docs/
  PROJECT_PLAN.md
  prompts/
gimp/
  Adart-Moonmix/
    gimp.css
    gimp-dark.css
matugen/
  matugen.config.toml
  templates/
    gtk-adart-moonmix.css
scripts/
  dev-install
  install-theme
  update-matugen-palette
themes/
  Adart-Moonmix/
    gtk-3.0/
      gtk.css
      gtk-dark.css
      matugen-generated.css
      widgets/
      apps/
    gtk-4.0/
      gtk.css
      gtk-dark.css
      matugen-generated.css
      widgets.css
input/
```

`input/` is intentionally ignored by Git and acts as a local reference snapshot of the previous override setup.

## Core Architecture

The project separates palette generation from widget styling.

`matugen/templates/gtk-adart-moonmix.css` defines the color system. It mixes Tokyonight Moon base colors with Matugen wallpaper colors and emits GTK color aliases such as:

- `window_bg_color`
- `window_fg_color`
- `accent_bg_color`
- `accent_fg_color`
- `view_bg_color`
- `card_bg_color`
- `borders`
- `insensitive_fg_color`
- semantic colors for success, warning, and error
- GTK3 compatibility names such as `theme_bg_color`, `theme_selected_bg_color`
- app-derived aliases such as Thunar sidebar colors

`matugen/matugen.config.toml` writes the same generated palette template to both:

```text
themes/Adart-Moonmix/gtk-3.0/matugen-generated.css
themes/Adart-Moonmix/gtk-4.0/matugen-generated.css
```

Static CSS files then apply those variables to GTK selectors.

## GTK3 Entrypoint

`themes/Adart-Moonmix/gtk-3.0/gtk.css` is the main theme entrypoint.

Current import order:

```css
@import url("matugen-generated.css");

@import url("widgets/base.css");
@import url("widgets/headerbar.css");
@import url("widgets/view.css");
@import url("widgets/selection.css");
@import url("widgets/input.css");
@import url("widgets/button.css");
@import url("widgets/menu.css");
@import url("widgets/scrollbar.css");
@import url("widgets/control.css");
@import url("widgets/notebook.css");
@import url("widgets/dialog.css");
@import url("widgets/panel.css");
@import url("widgets/infobar.css");
@import url("widgets/label.css");

@import url("apps/thunar.css");
@import url("apps/gimp.css");
@import url("apps/yad.css");

@import url("widgets/final.css");
```

The order matters:

- generated palette first
- generic GTK3 widget rules next
- app-specific fixes after generic rules
- `widgets/final.css` last for cleanup such as removing inherited gradients

## GTK3 Widget Modules

Widget CSS is split by responsibility:

- `base.css`: windows, dialogs, background
- `headerbar.css`: headerbars, titlebars, toolbars, toolbar buttons
- `view.css`: text views, tree views, icon views, sidebars
- `selection.css`: selected and backdrop selected states
- `input.css`: entries, spin buttons, comboboxes, popup controls
- `button.css`: buttons, suggested/destructive actions, disabled/backdrop states
- `menu.css`: menus, popovers, model buttons, menubars
- `scrollbar.css`: troughs, sliders, backdrop slider state
- `control.css`: scales, progress bars, checks, radios, switches
- `notebook.css`: notebook headers, tabs, page content
- `dialog.css`: dialog internals and frames
- `panel.css`: frames, lists, rows, settings-like panels
- `infobar.css`: GtkInfoBar variants
- `label.css`: label normalization, links, tooltips
- `final.css`: last-pass reset for gradients/background images

Common rule patterns:

- explicit `background-image: none`
- explicit `box-shadow: none`
- explicit `:backdrop` handling
- selected-state colors use active and unfocused/backdrop palette aliases
- nested `label`, `box`, and `image` nodes often inherit color and clear backgrounds

## App-Specific GTK3 CSS

`themes/Adart-Moonmix/gtk-3.0/apps/thunar.css`

Thunar is a major target and has the largest app-specific file. GTK Inspector findings show its sidebar is not just a normal `GtkPlacesSidebar`; useful selectors include:

```css
.thunar .shortcuts-pane
.thunar .shortcuts-pane .view
.thunar .shortcuts-pane treeview
```

The file handles sidebar background, splitter cleanup, hover/selected rows, icon/list view behavior, and inactive-window states.

`themes/Adart-Moonmix/gtk-3.0/apps/gimp.css`

Handles GIMP GTK3/welcome-dialog cleanup inside the normal GTK theme package, especially nested welcome dialog surfaces and inherited backgrounds.

`themes/Adart-Moonmix/gtk-3.0/apps/yad.css`

Handles YAD dialog styling. It increases the prompt label size for `label#yad-dialog-label` and suppresses the stock Cancel button icon using positional selectors because the Cancel button has no stable name/class.

## GTK4 Support

`themes/Adart-Moonmix/gtk-4.0/gtk.css` imports:

```css
@import url("matugen-generated.css");
@import url("widgets.css");
```

`themes/Adart-Moonmix/gtk-4.0/widgets.css` is a conservative plain GTK4 widget layer. It styles windows, dialogs, headerbars, notebooks, buttons, inputs, selections, menus/popovers, scrollbars, switches, checks, radios, scales, progress bars, and infobars.

This layer is useful for plain GTK4 apps. It is not a full libadwaita theme.

## GIMP Theme Layer

GIMP has a separate app theme under:

```text
gimp/Adart-Moonmix/
  gimp.css
  gimp-dark.css
```

`gimp.css` imports `gimp-dark.css`.

`gimp-dark.css` imports the installed GTK3 generated palette from:

```text
file:///home/adam/.local/share/themes/Adart-Moonmix/gtk-3.0/matugen-generated.css
```

It maps GIMP's own theme color variables back to Adart-Moonmix variables, then imports:

```text
file:///usr/share/gimp/3.0/themes/Default/common-dark.css
```

This is necessary because GIMP uses its own application theme layer and does not reliably inherit normal GTK theme colors.

Maintenance note: the absolute import path means the installed theme location is assumed. If the install location changes, the GIMP theme import should change too.

## Scripts And Workflows

Generate a palette from a wallpaper:

```sh
scripts/update-matugen-palette image /path/to/wallpaper.jpg
```

This runs:

```sh
matugen -c matugen/matugen.config.toml ...
```

Install for the current user:

```sh
scripts/install-theme
```

This installs:

```text
~/.local/share/themes/Adart-Moonmix
~/.config/GIMP/3.2/themes/Adart-Moonmix
```

Development reinstall:

```sh
scripts/dev-install
```

This reinstalls the theme and runs `thunar -q` if Thunar is available so a fresh launch reloads CSS.

## Test Targets

Recommended GTK3 checks:

```sh
gtk3-demo
gtk3-widget-factory
thunar
```

Recommended GTK4 check:

```sh
pavucontrol
```

GIMP check:

```text
Edit > Preferences > Interface > Theme > Adart-Moonmix
```

Hyprland/GTK theme selection:

```text
Adart-Moonmix
```

Avoid stale `GTK_THEME` overrides unless explicitly setting it to `Adart-Moonmix`.

## Current Git State Observed

At analysis time, the worktree was dirty:

```text
 M themes/Adart-Moonmix/gtk-3.0/gtk.css
?? themes/Adart-Moonmix/gtk-3.0/apps/yad.css
```

The tracked modification imports `apps/yad.css` from the GTK3 entrypoint. The `yad.css` file is untracked.

This capsule does not revert or modify those files.

## Design Constraints And Gotchas

- Do not hand-edit `matugen-generated.css` except for temporary tests.
- Edit palette logic in `matugen/templates/gtk-adart-moonmix.css`.
- App CSS should apply palette variables, not invent new color systems.
- Thunar row rounding differs by view mode; tree/list/detail views do not reliably support rounded selected rows.
- Backdrop state matters for inactive windows and must be styled explicitly.
- Many GTK controls carry inherited gradients/images/shadows, so color-only rules are often insufficient.
- GTK4/libadwaita boundaries are real; avoid documenting or implementing GTK4 support as broader than it is.
- GIMP's theme path assumptions are currently user/install-location specific.

## Useful Next Moves

1. Decide whether `apps/yad.css` should be committed and documented in `README.md`.
2. Add lightweight smoke checks for generated files and expected imports, possibly via shell script.
3. Consider making the GIMP palette import path less hard-coded if installation outside the current user path matters.
4. Keep expanding GTK3 coverage from observed GTK Inspector nodes, especially where apps expose custom widget trees.
5. Treat GTK4 as plain GTK4 support unless a separate libadwaita strategy is deliberately chosen.

