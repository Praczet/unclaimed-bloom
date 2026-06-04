type:: project-capsule
tags:: [[project]], [[icons]], [[matugen]], [[gtk]], [[papirus]], [[hyprland]], [[vite]], [[typescript]]
status:: active
updated:: [[2026-06-03]]
project:: [[Projects/adart-matugener-icons]]

# Project Capsule: adart-matugener-icons

## Executive Summary

`adart-matugener-icons` is a local GTK icon-theme tooling project. It builds a Papirus-derived icon theme whose SVG colors are tokenized, mixed with a Matugen wallpaper palette and a configurable mood palette, then generated into a real installed GTK icon theme.

The active theme ID is:

```bash
Adart-Papirus-Matugen
```

Use the theme ID exactly when setting GTK:

```bash
gsettings set org.gnome.desktop.interface icon-theme "Adart-Papirus-Matugen"
```

The repository also contains `workbench/`, a local Vite + TypeScript app with a Node/Express backend for inspecting icons, editing overrides, editing mood palette values, and running the rebuild flow.

## Repository Shape

Project root:

```text
/home/adam/Development/Hyprland/icon-themes/adart-matugener-icons
```

Important directories:

```text
config/
  mood-palettes.json

maps/
  detected-colors.json
  color-map.json
  color-map.suggested.json
  color-map.suggested.with-apps.json

scripts/
  dev-full-rebuild
  dev-check-icon
  dev-file-icon
  icons-scan
  icons-moonmix
  icons-suggest-map
  icons-build-template
  icons-generate
  top-20-colors

sources/
  papirus-icon-theme/
    Papirus/
    Papirus-Dark/
    Papirus-Light/

themes/
  Adart-Papirus-Matugen-template/
  Adart-Papirus-Matugen-template.build-report.json

workbench/
  Vite frontend plus local Express backend.
```

Generated external outputs:

```text
~/.cache/matugen/adart-icons-palette.json
~/.cache/matugen/adart-icons-runtime.json
~/.local/share/icons/Adart-Papirus-Matugen
~/.local/share/icons/Adart-Papirus-Matugen.generate-report.json
```

## Build Pipeline

Main developer entrypoint:

```bash
./scripts/dev-full-rebuild --theme-apps
```

Useful notification variant:

```bash
./scripts/dev-full-rebuild --theme-apps --notify-progress --notify-every 1
```

Pipeline stages:

1. `icons-scan`
   Scans Papirus SVGs, extracts colors, and writes `maps/detected-colors.json`.

2. `icons-moonmix`
   Mixes Matugen colors with `config/mood-palettes.json`, then writes `~/.cache/matugen/adart-icons-runtime.json`.

3. `icons-suggest-map`
   Suggests source-color to token mappings and writes `maps/color-map.suggested.json`.

4. `icons-build-template`
   Builds `themes/Adart-Papirus-Matugen-template` by replacing source SVG colors with `__ADART_ICON_*__` tokens.

5. `icons-generate`
   Replaces tokens with runtime colors and writes the final theme under `~/.local/share/icons/Adart-Papirus-Matugen`.

6. `dev-full-rebuild`
   Orchestrates the pipeline and sets the GTK icon theme.

## Current Data Model

`maps/color-map.json` is the reviewed theme map. As of this analysis it has this high-level shape:

```json
{
  "meta": {},
  "tokens": {},
  "colors": {},
  "runtime_token_values": {},
  "icon_overrides": {}
}
```

Current observed counts:

```text
tokens: 24
colors: 7053
icon override groups: 9
icon override entries in template report: 17
```

Important: some older notes describe a simple `mappings` object. The current file is token/color centered, where each entry in `colors` carries fields such as `suggested_token`, `approved_token`, confidence, usage counts, contexts, and reasons. Code that edits mappings should understand this schema before writing.

Per-icon overrides live under `icon_overrides` and use logical icon keys:

```json
{
  "icon_overrides": {
    "devices/computer.svg": {
      "#333333": "__ADART_ICON_ACCENT_1_DIM__"
    }
  }
}
```

Override source colors, not generated colors. If a generated SVG shows a runtime color, trace it back through the source color and token before writing an override.

## Tokens

Known token family:

```text
__ADART_ICON_SURFACE__
__ADART_ICON_SURFACE_DIM__
__ADART_ICON_SURFACE_CONTAINER__
__ADART_ICON_SURFACE_HIGH__
__ADART_ICON_SURFACE_LOWEST__
__ADART_ICON_ON_SURFACE__
__ADART_ICON_ON_SURFACE_MUTED__
__ADART_ICON_OUTLINE__
__ADART_ICON_SHADOW__
__ADART_ICON_ACCENT_1__
__ADART_ICON_ACCENT_1_DIM__
__ADART_ICON_ACCENT_1_BRIGHT__
__ADART_ICON_ACCENT_2__
__ADART_ICON_ACCENT_2_DIM__
__ADART_ICON_ACCENT_2_BRIGHT__
__ADART_ICON_ACCENT_3__
__ADART_ICON_ACCENT_3_DIM__
__ADART_ICON_ACCENT_3_BRIGHT__
__ADART_ICON_SUCCESS__
__ADART_ICON_SUCCESS_DIM__
__ADART_ICON_WARNING__
__ADART_ICON_WARNING_DIM__
__ADART_ICON_ERROR__
__ADART_ICON_ERROR_DIM__
```

Runtime token colors are loaded from:

```text
~/.cache/matugen/adart-icons-runtime.json
```

## Mood Palette

Mood config is stored in:

```text
config/mood-palettes.json
```

Current active preset:

```text
tokyonight-moon
```

The preset has anchor colors for surfaces, foregrounds, accents, semantic colors, and shadow. It also has group weights:

```json
{
  "surface": 1.3,
  "foreground": 1.2,
  "accent": 0.8,
  "semantic": 1,
  "mix": null
}
```

`icons-moonmix` and the workbench both understand this file. The workbench can edit mood anchors and weights, save them back to JSON, and restore the default moon preset.

## Symlink And Path Rules

Papirus source layout is:

```text
Papirus/<size>/<context>/<icon>.svg
Papirus-Dark/<size>/<context>/<icon>.svg
```

Example:

```text
64x64/places/folder.svg
16x16/devices/computer.svg
```

Do not treat it as:

```text
<context>/<size>/<icon>.svg
```

The project must keep two concepts separate:

```text
relativePath = 64x64/devices/computer.svg
iconKey      = devices/computer.svg
```

`relativePath` is for reading source/template/generated SVG files. `iconKey` is for `maps/color-map.json.icon_overrides`.

Papirus uses many symlinks. `icons-build-template` is intentionally designed to process real files, preserve symlink structure, and avoid flattening everything into duplicate real SVGs.

## Script Roles

`scripts/dev-full-rebuild`

Main rebuild orchestrator. Key options include:

```text
--scan-icons
--min-confidence
--theme-apps
--mood
--preset
--notify-progress
--notify-every
--dry-run
--no-cache
```

`--theme-apps` matters because some mimetype icons resolve to app icons. For example, archive mimetypes may point to `apps/ark.svg`.

`scripts/icons-build-template`

Builds the tokenized template. Current report says it saw and wrote 305485 files, tokenized 44137 SVGs, recreated 157474 symlinks, loaded 7053 mappings, and applied 9 override groups.

`scripts/icons-generate`

Generates the final GTK icon theme from the tokenized template and runtime palette.

`scripts/dev-check-icon`

Diagnostic tool for one icon across source, template, and generated theme. It can show colors, token mapping, symlink status, runtime token values, and optional terminal preview.

Example:

```bash
./scripts/dev-check-icon --icon computer --context devices --size 64x64 --preview --preview-tool kitty
```

`scripts/dev-file-icon`

Uses GIO/PyGObject to discover the icon names GTK wants for a real file, then delegates to `dev-check-icon`.

Example:

```bash
./scripts/dev-file-icon /path/to/file
```

## Workbench

Location:

```text
workbench/
```

Tech:

```text
Vite
vanilla TypeScript
Node/Express backend
```

Development command:

```bash
cd /home/adam/Development/Hyprland/icon-themes/adart-matugener-icons/workbench
npm run dev
```

The workbench package scripts are:

```text
npm run dev
npm run dev:vite
npm run dev:api
npm run build
npm run preview
npm run typecheck
```

Main frontend files:

```text
workbench/src/app/WorkbenchApp.ts
workbench/src/components/IconPreview.ts
workbench/src/services/ApiClient.ts
workbench/src/types/workbench.ts
workbench/src/styles.css
```

Main backend file:

```text
workbench/server/index.ts
```

Current workbench features:

```text
Search icons by name.
Filter by folder/path.
Filter results by all, real files, symlinks, or overridden icons.
Look up GTK/GIO icon names for a real file path.
Preview original, generated, and overridden SVGs.
Toggle preview between original size and fill width.
Show source/template/generated file status as real, symlink, or missing.
Show color pipe entries from source color to template token and override token.
List override summaries in an override drawer.
Add per-color overrides with token selection.
Remove one source-color override.
Remove all overrides for an icon.
Trigger `./scripts/dev-full-rebuild --theme-apps` from the backend.
View and edit mood palette anchors and weights.
Restore the default Tokyonight Moon mood palette.
Optionally theme the workbench UI from Matugen colors.
```

Current backend endpoints:

```text
GET    /api/health
GET    /api/project
GET    /api/mood
GET    /api/mood/mix-sources
PUT    /api/mood
POST   /api/mood/restore-moon
POST   /api/rebuild-overrides
GET    /api/icons/search?q=...&path=...
GET    /api/files/icons?path=...
GET    /api/overrides
GET    /api/icons/detail?iconKey=...&relativePath=...
POST   /api/overrides
DELETE /api/overrides
DELETE /api/overrides/icon
```

Safety model:

```text
The app is local-first.
Backend file access is project-specific.
GIO lookup is done with execFile, not shell string interpolation.
Rebuild command is narrowly defined as scripts/dev-full-rebuild --theme-apps.
Icon paths are checked as safe relative paths before reading or writing.
```

## Current Repository State At Analysis

Date of analysis:

```text
2026-06-03
```

The worktree was not clean. Modified files observed:

```text
maps/color-map.json
maps/color-map.suggested.json
workbench/server/index.ts
workbench/src/app/WorkbenchApp.ts
workbench/src/services/ApiClient.ts
workbench/src/styles.css
```

Observed diff stat:

```text
6 files changed, 268 insertions(+), 82 deletions(-)
```

Recent commits:

```text
dd23394b7 chore: works
ff458c15b wip: work, work, work
042a0975c add thems to .gitignore v2
22c90853f add thems to .gitignore
285b3ec69 wipping
```

This capsule was added without reverting or normalizing those existing edits.

## Diagnostics

Check active GTK icon theme:

```bash
gsettings get org.gnome.desktop.interface icon-theme
```

Set active GTK icon theme:

```bash
gsettings set org.gnome.desktop.interface icon-theme "Adart-Papirus-Matugen"
```

Restart Thunar:

```bash
thunar -q
thunar &
```

Ask GIO what icon names a file wants:

```bash
gio info -a standard::icon /path/to/file
```

Inspect runtime palette:

```bash
jq '.meta, .token_aliases' ~/.cache/matugen/adart-icons-runtime.json
```

Inspect override map:

```bash
jq '.icon_overrides' maps/color-map.json
```

Inspect template report:

```bash
jq '.meta, .stats' themes/Adart-Papirus-Matugen-template.build-report.json
```

Inspect final generate report:

```bash
jq '.meta, .stats' ~/.local/share/icons/Adart-Papirus-Matugen.generate-report.json
```

## Known Examples

Folder:

```text
places/folder.svg
Known good symlink/token pipeline example.
```

Computer:

```text
devices/computer.svg
Current override maps #333333 to __ADART_ICON_ACCENT_1_DIM__.
```

Markdown:

```text
mimetypes/text-x-markdown.svg
Has overrides for #d74c4c, #e4e4e4, and #fafafa.
```

Ark/archive:

```text
apps/ark.svg
Has overrides for #4caf50, #ffffff, #4b4b4b, and #909090.
Archive mimetypes may resolve through this app icon, so --theme-apps is important.
```

## Practical Next Work

High-value next steps:

```text
Run `npm run typecheck` in workbench after the current dirty edits settle.
Add stable backups before workbench writes maps/color-map.json and config/mood-palettes.json.
Validate override tokens against runtimeTokens instead of accepting any __ADART_ICON_* string.
Make rebuild output visible in the workbench without blocking the UI for long runs.
Consider making --theme-apps the default if app-backed mimetype coverage is always expected.
Keep improving path/symlink diagnostics because Papirus resolution issues are common.
```

Engineering constraints:

```text
Keep scripts project-local.
Do not install helper scripts globally unless explicitly requested.
Preserve Papirus symlinks.
Preserve the distinction between relativePath and iconKey.
Avoid broad shell execution in the workbench backend.
Do not assume generated runtime colors are source colors.
```
