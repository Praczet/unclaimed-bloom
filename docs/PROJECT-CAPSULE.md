type:: project-capsule
tags:: [[project-capsule]], [[theme-system]], [[linux-theming]], [[matugen]], [[vite]], [[typescript]], [[unclaimed-bloom]]
status:: active-development
updated:: [[2026-06-05]]
capsule-version:: 0.8
project:: [[Projects/Unclaimed Bloom]]
related:: [[Matugen]], [[GTK Theme]], [[Icon Theme]], [[AGS]], [[Ghostty]], [[Neovim]], [[mycli]], [[sqlit]], [[Hyprland]], [[SDDM]]

# Unclaimed Bloom

- motto:: **Unclaimed Bloom grows from ash, borrowed soil, and unclaimed hope.**
- cli:: `spore`
- capsule-version:: 0.5
- purpose:: A project-start capsule for creating the repository and giving future Adam/Codex/ChatGPT enough context to continue without digging through the old ashes by hand.

## Core decision snapshot

- project-name:: **Unclaimed Bloom**
- command-name:: **spore**
- core-language:: **TypeScript**
- runtime:: **Node.js**
- workbench:: **Vite**
- workers:: Existing Python/Bash scripts are valid workers behind adapters.
- architecture:: Shared TypeScript core, Node CLI, Vite visual workbench, adapter-orchestrated workers.
- core-metaphor:: **One bloom, many spores.**
- immediate-goal:: Orchestrate existing theming work under one recipe-driven system.
- first-implementation-style:: Practical, inspectable, config-first.
- first-rule:: Do not rewrite working Python/Bash scripts just to make the architecture look pure.
- second-rule:: Adapters may call workers; workers should communicate through stable JSON contracts and reports.
- third-rule:: TokyoNight Moon is a palette, not a prison. Matugen is a source, not the god.

## One-sentence definition

- **Unclaimed Bloom** is a recipe-driven theming system that grows a shared color/mood bloom from sources like Matugen and selectable base palettes, then scatters target-specific spores into tools like GTK, icons, AGS, Ghostty, Neovim, mycli, sqlit, and future desktop creatures.

## Recent changes (2026-06-05)

- workbench: added POST /api/notify that forces the server to reload blooms/profiles and broadcast via WebSocket so the UI can refresh without a manual reload.
- cli: added `spore set` / `spore replant` to change a profile's target recipe and `--apply` to run sow+grow immediately.
- cli: added cache subcommands (cache create/list/apply/remove) for named cached spore variants.
- inspect: `spore inspect` now shows full bloom + source palette derivation (so Matugen source colors are visible in the inspector).
- workbench UI: improved WebSocket fallback to connect to the backend port (7865) when same-origin WS is not available.
- repo layout: target-owned recipes/templates now live under `targets/<target>/`, with compatibility fallback for older `recipes/<target>` and `templates/<target>` paths.
- gtk: added Graphite-inspired base palettes, GTK recipes, and GTK-only profiles (`daily-gtk`, `daily-light-gtk`) so GTK can stay neutral while the rest of `daily` keeps its normal bloom.
- profiles: added composition profiles with ordered runs; `desktop` runs `daily-gtk` for GTK, then `daily`, and leaves `current-profile` set to `daily`.
- wallpaper: `wallset` and `wallset-backend` are now repo-owned scripts installed by `scripts/install`; default flow runs `spore sow desktop --wallpaper` then `spore grow desktop`. The old `walset` spelling is kept as a compatibility alias.

## The soul of the project

- This project is not meant to be “one more theme”.
- It is a small ecosystem for shaping atmosphere.
- It accepts that colors are borrowed:
  - from wallpaper,
  - from Matugen,
  - from TokyoNight Moon,
  - from other base palettes,
  - from old experiments,
  - from current scripts,
  - from whatever survived the previous aesthetic incident.
- It should not be bound forever to:
  - Moon,
  - Night,
  - Tokyo,
  - one palette,
  - one mood,
  - one target,
  - one sacred mistake.
- It should allow a desktop to become coherent without becoming sterile.
- It should be practical, but not soulless.
- It should be inspectable, because invisible magic eventually becomes a support ticket from hell.
- It should respect existing work instead of pretending the past was a regrettable prototype phase.
- It should make GTK behave, at least briefly. Let us not become naive, though.

## Why “Unclaimed Bloom”

- “Unclaimed” means:
  - not owned,
  - not assigned,
  - not locked to one identity,
  - not planted in a proper garden,
  - not yet claimed by one mood, palette, target, or theme family.
- “Bloom” means:
  - color,
  - life,
  - emergence,
  - return,
  - something growing where nothing was expected.
- Together:
  - **Unclaimed Bloom** suggests beauty growing from abandoned material, old ash, borrowed soil, and unclaimed hope.

## Why `spore`

- A spore is small, mobile, organic, and able to grow somewhere else.
- In the project metaphor:
  - the shared generated palette/mood is the **bloom**,
  - target-specific interpretations are **spores**,
  - recipes decide how each spore grows in each tool.
- `spore` is:
  - short,
  - spellable,
  - command-like,
  - less generic than `forge`,
  - less occupied than `emerge`,
  - less undo-ish than `ubloom`,
  - more alive than `generate-theme`.
- The CLI should stay usable and mostly sane.
- The poetry belongs in docs and concepts; the commands should not become scented candles.

## Core metaphor

- source-palette:: soil
- old-configs:: ash
- base-palette:: borrowed soil / taste-memory
- generated-semantic-palette:: bloom
- target-specific-output:: spore
- target-recipe:: growth rule
- adapter:: imprinting/orchestration mechanism
- worker:: existing script that does practical work
- profile:: saved ecosystem

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
workers/templates/post-hooks
        ↓
GTK / icons / AGS / Ghostty / Neovim / mycli / sqlit / SDDM / future beasts
```

## Problem this solves

- Current theming work exists as related but separate creatures:
  - Matugen generates wallpaper-based palettes.
  - GTK theme uses Matugen/TokyoNight-ish CSS overrides.
  - Icon theme mixes Papirus, Matugen, TokyoNight Moon, weights, token maps, overrides, real files, and symlink forests.
  - Ghostty has its own Matugen/TokyoNight mood.
  - Neovim has a Matugen/TokyoNight Moon mix.
  - mycli and sqlit have their own small generated palettes.
  - AGS is waiting to become both themed target and maybe visual controller.
  - Python/Bash scripts already do useful work.
- The current system works, but the logic is scattered.
- The desired system should:
  - centralize palette/mood logic,
  - keep target-specific freedom,
  - avoid hardcoding TokyoNight Moon as the only source of taste,
  - allow different tools to borrow differently from Matugen and base palettes,
  - make future targets join by adding recipes/adapters/workers instead of inventing a new ritual every time,
  - preserve existing working scripts until there is a real reason to replace them.

## Main design principle

- **One bloom, many spores.**
- A shared bloom is generated from:
  - source palette,
  - base palette,
  - mood,
  - profile,
  - global weights/rules.
- Each target receives its own spore through a recipe.
- Each target may borrow from source/base differently.
- This means:
  - Ghostty can stay mostly moonish with a small Matugen perfume.
  - Icons can use stronger Matugen accents and specific token weights.
  - GTK can be conservative with surfaces and dramatic only under supervision.
  - Neovim can remain readable, because unreadable code is not spirituality.
  - AGS can be more expressive and decorative.
  - mycli/sqlit can be tuned without becoming accidental neon soup.

## Architectural recommendation

- Use **TypeScript** as the core language.
- Use **Node.js** for the CLI/runtime.
- Use **Vite** for the visual workbench.
- Keep existing **Python/Bash scripts** as workers where they already work.
- Treat Unclaimed Bloom as an **orchestrator first**, not a rewrite crusade.

```text
unclaimed-bloom/
├── src/core/       shared TypeScript logic
├── src/cli/        Node/TypeScript CLI: spore
├── src/ui/         Vite workbench
├── src/adapters/   target orchestration
├── scripts/        existing/new Python/Bash workers
├── palettes/       base palettes
├── moods/          global mood presets
├── profiles/       saved ecosystems
├── targets/        target modules: recipes, templates, target-local assets
└── docs/           project capsule, design docs, notes
```

## Why not Deno, for now

- Deno would be elegant for a CLI-first TypeScript tool.
- However, this project will very likely need a visual workbench:
  - palette previews,
  - icon previews,
  - recipe editing,
  - weight sliders,
  - target reports,
  - before/after comparisons.
- The icon theme already has a Vite workbench direction.
- Keeping the core, CLI, and UI inside a Node/Vite ecosystem reduces split-brain.
- Therefore:
  - **Node + TypeScript + Vite** is the current recommendation.
  - Deno is not forbidden by the laws of nature, just not the chosen road today.

## Existing Python/Bash scripts

- Existing Python/Bash scripts should be treated as **workers**.
- Workers are not enemies.
- Workers are not shame.
- Workers are the little creatures that already know how to do the dirty work.

### Worker contract idea

- `spore` generates stable JSON files:
  - bloom files,
  - target spore files,
  - recipe-resolved configs.
- Workers consume those files.
- Workers write outputs and reports.

Example:

```text
spore sow daily
  ↓
~/.cache/unclaimed-bloom/blooms/daily.json
~/.cache/unclaimed-bloom/spores/daily/icons.json
  ↓
icons adapter calls existing Python worker
  ↓
icon theme generated
  ↓
~/.cache/unclaimed-bloom/reports/icons.json
```

### Worker rule

- Do not rewrite a Python script unless:
  - it is painful to maintain,
  - the contract cannot be made clean,
  - performance requires it,
  - or future Adam is already swearing before opening the file.

Purity is how projects become beautiful and dead.

## Vocabulary

### Source

- A source is where dynamic color information comes from.
- Examples:
  - Matugen palette from wallpaper,
  - manually chosen seed color,
  - imported palette,
  - generated runtime palette.

### Base palette

- A base palette is a taste profile.
- It is not the final theme.
- Examples:
  - TokyoNight Moon,
  - Catppuccin Mocha,
  - Catppuccin Latte,
  - desert/sand palette,
  - warm paper palette,
  - cold glass palette,
  - user-defined weird little purple thing.

### Mood

- A mood defines how source and base palette should be mixed.
- It may include:
  - surface weight,
  - foreground weight,
  - accent weight,
  - saturation/contrast adjustments,
  - dark/light preference,
  - target-specific defaults.

### Bloom

- A bloom is the generated shared semantic palette.
- It should contain stable semantic tokens such as:
  - `surface.base`
  - `surface.raised`
  - `text.primary`
  - `text.muted`
  - `accent.primary`
  - `accent.secondary`
  - `state.success`
  - `state.warning`
  - `state.danger`
  - `selection.background`
  - `selection.foreground`
  - `border.subtle`
- Suggested output:
  - `~/.cache/unclaimed-bloom/blooms/current.json`
  - `~/.cache/unclaimed-bloom/blooms/daily.json`

### Spore

- A spore is a target-specific interpretation of the bloom.
- Each tool gets its own spore.
- Examples:
  - Ghostty spore,
  - Icons spore,
  - GTK spore,
  - Neovim spore,
  - AGS spore.

### Recipe

- A recipe defines how a target should interpret the bloom.
- It controls:
  - which base palette is used,
  - which Matugen/source tokens matter,
  - how strongly to borrow from source vs base palette,
  - per-token overrides,
  - target-specific weights.
- A new tool should usually join the system by adding:
  - one recipe,
  - one template,
  - one adapter only if needed.

### Adapter

- An adapter knows how to orchestrate a target.
- It may:
  - render templates,
  - call workers,
  - copy files,
  - run post-hooks,
  - collect reports.
- It should not decide what looks good.
- Taste belongs in recipes.
- Execution belongs in adapters/workers.

### Worker

- A worker is an existing or new script that does practical work.
- Workers can be:
  - Python,
  - Bash,
  - Node,
  - anything executable and non-hostile.
- Workers should use JSON input/output contracts where possible.

### Profile

- A profile is a saved ecosystem.
- It combines:
  - source,
  - base palette,
  - mood,
  - enabled targets,
  - recipe choices per target.
- Examples:
  - `daily`
  - `dark`
  - `light`
  - `moonish`
  - `sandy-dry-land`
  - `experimental-do-not-ask`

## Target-specific freedom

- There must not be a single global “Moon amount”.
- Each target needs its own policy.
- Example:
  - Ghostty may use:
    - mostly TokyoNight Moon,
    - little Matugen,
    - conservative background.
  - Icons may use:
    - stronger Matugen accent,
    - specific token weights,
    - separate handling for surface/foreground/accent.
  - GTK may use:
    - controlled surfaces,
    - safe contrast,
    - accent where meaningful.
- Existing icon-theme logic already proves this is needed:
  - base palette can be changed,
  - weights can be changed,
  - specific icon tokens can have specific behavior.

## Actual repository structure

See "Actual repository structure (as of 0.4)" in the "Current implementation state"
section for the up-to-date tree. The structure below was accurate at capsule 0.3
and is kept here for historical context only.

All adapters created as of 0.7. See "Current implementation state" section for the up-to-date tree.

## Suggested user config shape

```text
~/.config/unclaimed-bloom/
├── config.json
├── palettes/
│   ├── tokyonight-moon.json
│   ├── desert-sand.json
│   ├── warm-paper.json
│   └── custom/
├── moods/
│   ├── moonish.json
│   ├── source-heavy.json
│   ├── base-dominant.json
│   ├── soft-light.json
│   └── sandy-dry-land.json
├── profiles/
│   ├── daily.json
│   ├── dark.json
│   ├── light.json
│   └── experimental.json
└── targets/
    ├── ghostty/
    │   └── recipes/
    ├── icons/
    │   └── recipes/
    ├── gtk/
    │   ├── recipes/
    │   └── templates/
    ├── nvim/
    │   └── recipes/
    ├── ags/
    │   └── recipes/
    ├── mycli/
    │   └── recipes/
    └── sqlit/
        └── recipes/
```

## Suggested cache/report shape

See "Suggested cache shape (current)" in the implementation state section above —
spores and reports are namespaced by profile as of capsule 0.4.

## Example profile

```json
{
  "name": "daily",
  "source": {
    "type": "matugen",
    "palettePath": "~/.cache/matugen/colors.json"
  },
  "basePalette": "tokyonight-moon",
  "mood": "moonish",
  "targets": {
    "ghostty": "ghostty/moonish-subtle",
    "icons": "icons/moonish-matugen",
    "gtk": "gtk/moonish-balanced",
    "nvim": "nvim/moonish-readable",
    "mycli": "mycli/moonish",
    "sqlit": "sqlit/moonish"
  }
}
```

## Example target recipe

```json
{
  "name": "ghostty/moonish-subtle",
  "target": "ghostty",
  "basePalette": "tokyonight-moon",
  "weights": {
    "surface": 0.20,
    "foreground": 0.30,
    "accent": 0.55
  },
  "tokens": {
    "background": {
      "source": "background",
      "base": "background",
      "mix": 0.15
    },
    "foreground": {
      "source": "on_surface",
      "base": "foreground",
      "mix": 0.30
    },
    "cursor": {
      "source": "primary",
      "base": "blue",
      "mix": 0.65
    }
  }
}
```

## Example worker-backed target config

```json
{
  "target": "icons",
  "recipe": "icons/moonish-matugen",
  "adapter": "worker",
  "worker": {
    "command": "python",
    "args": [
      "scripts/workers/icons-generate.py",
      "--spore",
      "~/.cache/unclaimed-bloom/spores/icons.json",
      "--report",
      "~/.cache/unclaimed-bloom/reports/icons.json"
    ]
  },
  "outputs": [
    "~/.local/share/icons/Adart-Papirus-Unclaimed-Bloom"
  ],
  "postHooks": [
    "gtk-update-icon-cache ~/.local/share/icons/Adart-Papirus-Unclaimed-Bloom"
  ]
}
```

## CLI direction

- command:: `spore`
- The CLI should be short and usable.
- Keep first commands practical.

### Current command set (as of 0.4)

```bash
# Discovery
spore palette list
spore mood list
spore recipe list [target]
spore recipe validate [target]
spore profile list

# Core workflow
spore sow <profile> [target] [--wallpaper <path>]
spore inspect <profile> [target]
spore grow <profile> [target]
spore status [profile] [target]
```

### Command meanings

- `spore sow <profile>`
  - Generate bloom + spores into cache. No config side effects. Safe to run anytime.
  - `--wallpaper <path>` calls Matugen first, updates the source colors cache.
- `spore grow <profile>`
  - Push cached spores through adapters to actual config destinations.
  - Ghostty reloads live (SIGUSR2). mycli and sqlit update immediately.
- `spore inspect <profile>`
  - Live per-token view: base key | source key | mix weight | rendered hex.
  - Always re-generates from data files, never reads cache.
- `spore status`
  - Show sow/grow timestamps for all profiles and targets.
- `spore recipe list`
  - List available target recipes.
- `spore recipe validate [target]`
  - Validate recipe JSON, bloom paths, required target tokens, mix ranges, and shipped-recipe shape.
- `spore palette list`
  - List base palettes with kind (dark/light) and color count.
- `spore mood list`
  - List moods with weight values.

### Optional future poetic verbs

- `scatter`
  - Distribute spores into enabled targets.
- `seed`
  - Write a target spore.
- `imprint`
  - Write colors into a specific app/tool.
- `bloom`
  - Generate the shared bloom.

Keep these optional. First version should not become a greenhouse-themed command maze.

## Workers in this repository

### Active workers

#### scripts/ub-mycli-apply

Bash. Assembles `~/.myclirc` from a static base config plus the generated colors INI.
Called by `MycliAdapter` after it writes the INI file.

Contract:
```bash
ub-mycli-apply [base.conf] [colors.ini] [output.myclirc]
```

Creates a timestamped backup of the previous `~/.myclirc` before overwriting.

#### scripts/matugen-cache

Bash. Standalone helper for running Matugen and saving the full JSON output.
Superseded by `spore sow --wallpaper` for the normal workflow, but useful for
one-off palette generation or testing.

Contract:
```bash
matugen-cache <wallpaper-path> [dark|light]
```

### Retired workers (scripts/retired/)

These scripts have been superseded by TypeScript adapters + recipes and are kept
for reference only. Do not use them directly — they hardcode TokyoNight Moon colors
and produce output incompatible with the new spore contract.

- `matugen-ghostty-moonmix.py` — replaced by `GhosttyAdapter` + `targets/ghostty/recipes/subtle-ish.json`
- `matugen-mycli-moonmix` — replaced by `MycliAdapter` + `targets/mycli/recipes/subtle-ish.json`
- `matugen-sqlit-moonmix` — replaced by `SqlitAdapter` + `targets/sqlit/recipes/subtle-ish.json`

### scripts/matugen-sqlit-moonmix

Python. Generates a sqlit/Textual custom theme JSON and patches `sqlit/settings.json` to activate it.

Contract:
```bash
matugen-sqlit-moonmix \
  --palette ~/.cache/matugen/sqlit-palette.json \
  --theme-file ~/.config/sqlit/themes/matugen-moon.json \
  --settings ~/.config/sqlit/settings.json \
  --mix-weight 0.40
```

Output: a Textual `Theme`-compatible JSON plus an updated settings.json. Creates backups of both files.

### Common pattern across all three moonmix scripts

All three scripts share the same architecture:

- `TOKYO_MOON` dict — hardcoded base colors (bg, fg, blue, cyan, green, yellow, orange, red, magenta, purple, comment, variants).
- `mix(base, tint, tint_weight)` — simple sRGB linear blend. `0.0` = pure base, `1.0` = pure Matugen.
- `pick(palette, key, fallback)` — safe Matugen key lookup with fallback to base color.
- Each color token has its own per-token `mix_weight` override, not a single global weight.

This means: `TOKYO_MOON` is the first concrete `palettes/tokyonight-moon.json` waiting to be extracted. The per-token weights scattered in each script are the first concrete recipe definitions waiting to be formalized.

## Existing related projects to absorb or coordinate

### Matugen setup

- Current role:
  - Generates wallpaper-based palettes.
  - Provides the source palette.
- Future role:
  - Remains a source provider.
  - Should not own the full design logic.

### GTK theme project

- Full capsule: `docs/adart-matugener-gtk-theme-project-capsule.md`
- Current role:
  - GTK3 + limited GTK4 theme named `Adart-Moonmix`.
  - Matugen generates `matugen-generated.css` via a template (`matugen/templates/gtk-adart-moonmix.css`).
  - Static CSS widget files consume those generated variables.
  - Scripts: `install-theme`, `dev-install`, `update-matugen-palette`.
- Future role:
  - Becomes a GTK target adapter/recipe set.
  - Templates should consume target spore values.
  - Not invited to the first milestone. It knows what it did.

### Icon theme project

- Full capsule: `docs/adart-matugener-icons-project-capsule.md`
- Current role:
  - Papirus-based icon recoloring. Theme ID: `Adart-Papirus-Matugen`.
  - Five-stage pipeline: scan → moonmix → suggest-map → build-template → generate.
  - Uses 24 named tokens (`__ADART_ICON_SURFACE__`, `__ADART_ICON_ACCENT_1__`, etc.) for SVG color replacement.
  - `config/mood-palettes.json` holds the active mood preset (anchor colors + group weights: `surface`, `foreground`, `accent`, `semantic`, `mix`). Current preset: `tokyonight-moon`.
  - Has a working **Vite + TypeScript + Node/Express workbench** at `workbench/` for icon preview, override editing, mood editing, and triggering rebuilds.
  - Runtime palette written to `~/.cache/matugen/adart-icons-runtime.json`.
- Future role:
  - Becomes the icons target.
  - Existing token system survives.
  - Existing Python/Bash scripts remain as workers.
  - `config/mood-palettes.json` structure (anchor colors + group weights) is the direct ancestor of the Unclaimed Bloom mood/recipe format.
  - The icons workbench is the direct ancestor of the Unclaimed Bloom Vite workbench.

### AGS + Matugen marriage

- Current role:
  - Planned visual shell/control UI integration.
- Future role:
  - AGS becomes both:
    - a target to theme,
    - a possible UI/controller layer later.

### Ghostty

- Current role:
  - Has a moonish Matugen/TokyoNight mood via `scripts/matugen-ghostty-moonmix.py`.
- Future role:
  - First or early simple adapter.
  - The worker already exists. The first proof is wrapping it in the recipe/bloom/spore system.

### Neovim

- Current role:
  - Uses TokyoNight Moon plus Matugen mixing.
- Future role:
  - Target recipe must preserve readability.
  - Syntax colors should not be sacrificed to wallpaper drama.

### mycli / sqlit

- Current role:
  - Workers already exist: `matugen-mycli-moonmix`, `matugen-mycli-apply`, `matugen-sqlit-moonmix`.
- Future role:
  - Good early adapters because outputs are small and testable.
  - Workers stay; recipes and adapters wrap them.

### SDDM / Hyprlock / wallpaper scripts

- Current role:
  - Theme/wallpaper integration already exists.
- Future role:
  - Later targets, not first-phase core.
  - Should consume generated bloom/spore values when stable.

## First implementation milestone

- Do not start with AGS UI.
- Do not start with all targets.
- Do not start with GTK unless boredom has become too peaceful.
- The workers for Ghostty, mycli, and sqlit already exist in `scripts/`.
- The first proof is not rewriting them — it is wrapping them in the recipe/bloom/spore system.
- First version should prove:
  - palette loading (extract `TOKYO_MOON` from scripts → `palettes/tokyonight-moon.json`),
  - base palette loading,
  - recipe loading (formalize the per-token weights already in the scripts),
  - bloom generation,
  - one or two target spores,
  - calling the existing worker script via a WorkerAdapter,
  - inspect/report output.

### Recommended first targets

- Ghostty:
  - Worker exists: `scripts/matugen-ghostty-moonmix.py`.
  - Small output. Easy to verify visually.
  - Prove the recipe → bloom → spore → worker → output chain.
- mycli or sqlit:
  - Workers exist: `matugen-mycli-moonmix`, `matugen-mycli-apply`, `matugen-sqlit-moonmix`.
  - Good low-risk second target once the chain is proven.
- Icons:
  - Important but heavier. Pipeline is complex.
  - Existing project can be integrated after core contracts are stable.
- GTK:
  - Important but should come after the logic is proven.
  - GTK is not invited to the first quiet dinner. It knows what it did.

## Workbench direction

- Vite workbench should be a visual layer over the core.
- It should not become the brain.
- It may later provide:
  - palette preview,
  - bloom preview,
  - target spore preview,
  - icon preview,
  - recipe editor,
  - weight sliders,
  - report viewer,
  - before/after comparison,
  - “apply target” actions via local bridge.

### Workbench rule

- UI components should call shared core logic or a local backend/CLI bridge.
- Browser UI should not directly become a swamp of filesystem-specific logic.
- The workbench observes, edits, previews, and triggers.
- The CLI/core still owns actual orchestration.

## Non-goals for the first version

- No full GUI as first milestone.
- No AGS manager yet.
- No complete GTK world domination.
- No attempt to support every app.
- No perfect contrast solver at first.
- No massive plugin system before the first useful run.
- No rewrite of working scripts just to satisfy architectural vanity.
- No metaphor overdose in folder names:
  - Use `targets/<name>/recipes/`, not `targets/<name>/rituals/`.
  - Use `profiles/`, not `gardens/`.
  - Use `adapters/`, not `mycelial-apostles/`, despite obvious temptation.

## Design rules

- Keep the core semantic palette small at first.
- Target-specific complexity belongs in recipes and adapters.
- Adapters should not contain taste decisions.
- Recipes define taste.
- Profiles select recipes.
- Base palettes are selectable.
- TokyoNight Moon is a palette, not a prison.
- Matugen is a source, not the god.
- Python/Bash scripts are workers, not shame.
- Target recipes are allowed to disagree.
- Reports should explain what happened.
- Every generated run should be inspectable.
- Future Adam should not need archaeological permits to understand the config.

## Maintenance conventions

These apply to all future work in this repository.

### README.md

- `README.md` must be kept current as commands are added or changed.
- The Usage section should always reflect the actual dev invocation (via `scripts/spore`).
- New commands get a one-line entry in the Commands table before being merged.
- Coming-soon commands may be listed with a `(coming soon)` annotation until implemented.

### Zsh completions

- `completions/_spore` is the canonical completion file for the `spore` CLI.
- Whenever a new subcommand or positional argument is added to `spore`, update `completions/_spore` in the same commit.
- Bash scripts with parameters that accept named flags or meaningful positional arguments get their own completion file in `completions/` named `_<script-name>`.
- The README instructs users how to source the completions.

### Matugen config hygiene

- `~/.config/matugen/config.toml` is the live Matugen config. It should only contain entries for targets **not yet absorbed by a UB adapter**.
- When a new UB adapter takes ownership of a target (e.g. Neovim, AGS, SDDM), the corresponding `[templates.*]` entry must be removed from `config.toml`.
- Before removing: copy the entry into `~/.config/matugen/to-remove/old_matugen_conf` with a comment explaining which UB adapter replaced it and why.
- Move the template file itself from `~/.config/matugen/templates/` into `~/.config/matugen/to-remove/` at the same time.
- When asked to update Matugen (e.g. "we just added a Neovim adapter"), proactively suggest this cleanup as part of the same task — do not wait to be asked separately.
- **Currently active in Matugen** (not yet absorbed): none of the main desktop targets; UB owns hyprland, waybar, swaync, adart (AGS), rofi, wlogout, yazi, potato, iced, nvim, and sddm-adart-matugener-theme.
- **Already removed** (absorbed by UB): gtk (GtkAdapter), ghostty (GhosttyAdapter), mycli (MycliAdapter), sqlit (SqlitAdapter), icons (IconsAdapter).

## Possible semantic token seed

```json
{
  "surface": {
    "base": "#000000",
    "dim": "#000000",
    "raised": "#000000",
    "highest": "#000000"
  },
  "text": {
    "primary": "#ffffff",
    "secondary": "#cccccc",
    "muted": "#999999",
    "disabled": "#666666"
  },
  "accent": {
    "primary": "#ffffff",
    "secondary": "#ffffff",
    "tertiary": "#ffffff"
  },
  "state": {
    "success": "#00ff00",
    "warning": "#ffff00",
    "danger": "#ff0000",
    "info": "#00ffff"
  },
  "border": {
    "subtle": "#333333",
    "strong": "#555555"
  },
  "selection": {
    "background": "#333333",
    "foreground": "#ffffff"
  }
}
```

## Answered first questions (resolved by 0.4)

- Dev invocation: `scripts/spore` wrapper — sets `UB_DATA_DIR` automatically.
- Cache vs apply separation: **resolved** — `sow` = cache only, `grow` = apply to config.
- Recipe mix weights: `0.0..1.0` per-token values.
- Matugen source: read from cache files, or call directly via `sow --wallpaper`.
- Template format: adapters write directly; plain text templates can be added later.
- First workers: `ub-mycli-apply` (active). `matugen-ghostty/mycli/sqlit-moonmix` → retired.
- Icon workbench: link as separate project first, integrate later.

## Tiny README seed

- **Unclaimed Bloom** grows from ash, borrowed soil, and unclaimed hope.
- It is a recipe-driven theming system for Linux desktops.
- It takes color sources such as Matugen, blends them with selectable base palettes and moods, then scatters target-specific spores into tools like GTK, icons, AGS, Ghostty, Neovim, mycli, and sqlit.
- Each target can decide how much it borrows from the source palette and how much it keeps from the chosen base palette.
- Existing Python/Bash scripts can remain as workers behind adapters.
- It is not one more theme.
- It is a small ecosystem for letting color survive the wasteland.

## Current implementation state

updated:: [[2026-06-05]]
capsule-version:: 0.8

### Actual repository structure (as of 0.8)

```text
unclaimed-bloom/
├── src/
│   ├── core/
│   │   ├── types.ts             Palette, Source, Mood, Recipe, Bloom, Spore, Profile, Report
│   │   ├── Mixer.ts             hexToRgb, rgbToHex, mixColors, Mixer class
│   │   ├── BloomGenerator.ts    base + source + mood → BloomColors (6 groups, 18 tokens)
│   │   ├── SporeGenerator.ts    recipe + bloom/base/source → Spore
│   │   └── canonical.ts         18 canonical palette key names (enforced by spore palette validate)
│   ├── node/
│   │   ├── fs.ts                readJson/writeJson + typed loaders for all data types
│   │   ├── loader.ts            loadSourcePalette, loadSourceColors, loadBasePalette, expandHome
│   │   └── paths.ts             Paths object, DATA_DIR / CACHE_DIR (XDG-aware + UB_ overrides)
│   ├── adapters/
│   │   ├── WorkerAdapter.ts     run() / runOrThrow() for external script invocation
│   │   ├── GhosttyAdapter.ts    renders theme file + sends SIGUSR2 for live reload
│   │   ├── MycliAdapter.ts      renders INI colors + calls ub-mycli-apply worker
│   │   ├── SqlitAdapter.ts      renders Textual Theme JSON + patches settings.json
│   │   ├── IconsAdapter.ts      writes icons-runtime.json + calls icons-generate worker
│   │   ├── GtkAdapter.ts        renders gtk-adart-unclaimed-bloom.css with resolved hex values
│   │   ├── NvimAdapter.ts       writes matugen-colors.lua; reloads all running nvim via socket
│   │   ├── AgsAdapter.ts        writes AGS matugen.css (source + 10 overrides); reloads AGS
│   │   ├── SwayncAdapter.ts     writes swaync colors/matugen.css; reloads swaync CSS
│   │   ├── WaybarAdapter.ts     writes waybar colors/matugen.css; sends SIGUSR2 to waybar
│   │   ├── HyprlandAdapter.ts   writes matugen.lua (rgba) + matugen.conf ($var/$var_hex); hyprctl reload
│   │   ├── RofiAdapter.ts       writes matugen.rasi with 7 semantic CSS variables + wallpaper path
│   │   ├── YaziAdapter.ts       writes full theme.toml from 21 recipe tokens
│   │   ├── WlogoutAdapter.ts    writes @define-color CSS (source + overrides); adds `foreground`
│   │   ├── IcedAdapter.ts       writes rusty-screen theme JSON: palette (5) + extra (13 source keys)
│   │   ├── SddmAdapter.ts       writes full theme.conf for sddm-adart-matugener
│   │   └── PotatoAdapter.ts     writes potato theme.json (10 tokens); post-hook: potato-sync
│   ├── server/
│   │   └── workbench.ts         HTTP + WebSocket server; profiles/status/actions API; watches blooms
│   ├── ui/
│   │   ├── index.html           Vite entry point
│   │   ├── main.ts              fetch blooms, render swatches, live WebSocket updates
│   │   ├── style.css            minimal dark chrome
│   │   └── tsconfig.json        extends root + adds DOM lib
│   └── cli/
│       └── spore.ts             full CLI — sow, grow, inspect, status, list commands
├── completions/
│   ├── _spore                   zsh completion for spore CLI
│   └── _matugen-cache           zsh completion for matugen-cache script
├── scripts/
│   ├── spore                    dev wrapper (sets UB_DATA_DIR, delegates to tsx)
│   ├── matugen-cache            standalone Matugen → JSON cache script
│   ├── ub-mycli-apply           assembles ~/.myclirc from base.conf + colors.ini
│   └── retired/                 old moonmix scripts (ghostty, mycli, sqlit) — replaced by adapters
├── palettes/
│   ├── tokyonight-moon.json     dark — primary daily palette
│   ├── tokyonight-day.json      light
│   ├── catppuccin-mocha.json    dark
│   ├── catppuccin-latte.json    light
│   ├── gruvbox-light.json       light — includes normalized aliases for recipe compatibility
│   ├── rose-pine-dawn.json      light
│   └── solarized-light.json     light
├── moods/
│   ├── dormant.json             surface:0.05 fg:0.08 accent:0.20 semantic:0.10
│   ├── budding.json             surface:0.15 fg:0.18 accent:0.45 semantic:0.25
│   ├── blooming.json            surface:0.25 fg:0.32 accent:0.50 semantic:0.40
│   └── overgrown.json           surface:0.70 fg:0.60 accent:0.90 semantic:0.70
├── profiles/
│   ├── daily.json               tokyonight-moon + blooming + matugen dark + 14 targets
│   └── daily-light.json         tokyonight-day + budding + matugen light + 11 targets
├── targets/
│   ├── ags/recipes/             subtle-ish + source-heavy
│   ├── ghostty/recipes/         subtle-ish + source-heavy
│   ├── gtk/
│   │   ├── recipes/             subtle-ish
│   │   └── templates/           unclaimed-bloom.css with {{TOKEN}} placeholders
│   ├── hyprland/recipes/        subtle-ish
│   ├── iced/recipes/            subtle-ish
│   ├── icons/recipes/           subtle-ish
│   ├── mycli/recipes/           subtle-ish
│   ├── nvim/recipes/            subtle-ish + source-heavy
│   ├── potato/recipes/          subtle-ish
│   ├── rofi/recipes/            subtle-ish
│   ├── sddm/recipes/            subtle-ish
│   ├── sqlit/recipes/           subtle-ish
│   ├── swaync/recipes/          subtle-ish + source-heavy
│   ├── waybar/recipes/          subtle-ish + source-heavy
│   ├── wlogout/recipes/         subtle-ish
│   └── yazi/recipes/            subtle-ish
├── assets/wallpapers/           test wallpapers for Matugen runs
├── docs/
│   ├── PROJECT-CAPSULE.md
│   ├── adart-matugener-gtk-theme-project-capsule.md
│   └── adart-matugener-icons-project-capsule.md
└── vite.config.ts               root:src/ui, proxies /api and /ws to workbench server :7865
```

### What is built

```text
Core chain:
  palette (base taste) → source (Matugen JSON) → mood (mix weights)
    → BloomGenerator → bloom (shared semantic palette)
    → SporeGenerator + recipe → spore (target-specific color set)
    → adapter → worker/template/post-hook → target config file

Recipe token modes:
  Bloom-backed:
    { "bloom": "surface.base" }
    { "bloom": "accent.primary", "source": "primary", "mix": 0.15 }

  Pure base:
    { "base": "background" }

  Direct mix escape hatch, supported by the engine but not used by shipped recipes:
    { "base": "blue", "source": "primary", "mix": 0.55 }

Use bloom-backed tokens for shared target roles. Use pure base when a target needs an
untinted base-palette color, for example a pure TokyoNight background. Direct base/source
mix recipes are reserved for future exceptions where a target needs deliberate disagreement
that cannot be expressed as bloom, bloom plus source tint, or pure base.

Adapters (all working):
  GhosttyAdapter   — writes theme file, sends SIGUSR2 for live reload
  MycliAdapter     — writes colors INI, calls ub-mycli-apply worker
  SqlitAdapter     — writes Textual theme JSON, patches settings.json
  IconsAdapter     — writes icons-runtime.json, calls icons-generate worker (live progress)
  GtkAdapter       — renders gtk-adart-unclaimed-bloom.css with fully-resolved hex values;
                     writes to both repo themes/ dir and ~/.local/share/themes/ live install
  NvimAdapter      — writes ~/.config/nvim/lua/generated/matugen-colors.lua (same format
                     as old matugen template); reloads all running nvim instances via socket glob
  AgsAdapter       — writes AGS matugen.css from source + 10 recipe overrides; post-hook reloads AGS
  SwayncAdapter    — writes ~/.config/swaync/colors/matugen.css from source + recipe overrides;
                     reloads swaync CSS
  WaybarAdapter    — writes ~/.config/waybar/colors/matugen.css from source + recipe overrides;
                     sends SIGUSR2 to waybar
  HyprlandAdapter  — writes two files: matugen.lua (rgba format, for decoration.lua) and
                     matugen.conf ($var + $var_hex format, for hyprlock.conf); post-hook: hyprctl reload
  RofiAdapter      — writes ~/.config/rofi/shared/matugen.rasi with 7 semantic CSS variables;
                     reads wallpaper path from cache file for background-image
  YaziAdapter      — writes full theme.toml from 21 recipe tokens; improved over old matugen
                     template: semantic permission colors, adaptive filetype colors
  WlogoutAdapter   — writes @define-color CSS from source + recipe overrides; fixes missing
                     `foreground` variable the old template never defined
  IcedAdapter      — writes rusty-screen theme JSON: palette (5 recipe-mixed keys) +
                     extra (13 source color keys for Material You math)
  SddmAdapter      — writes full theme.conf for sddm-adart-matugener from source + recipe overrides
  PotatoAdapter    — writes ~/.config/potato/theme.json with 10 tokens; post-hook: potato-sync

matugen config.toml migration status: COMPLETE.
  All [templates.*] entries have been replaced by UB adapters.
  matugen/config.toml contains the wallpaper hook ([config.wallpaper]) + an empty [templates]
  section (required by matugen's serde schema — removing it causes a parse error).
  Retired entries archived in ~/.config/matugen/to-remove/old_matugen_conf.

CLI commands:
  sow     — generate bloom + spores into cache (no config side effects)
  grow    — push cached spores through adapters to actual config files
  inspect — live per-token view: base | source | mix | rendered (no writes)
  status  — show sow/grow timestamps for all profiles and targets

List commands:
  palette list      — name, kind (dark/light), color count
  mood list         — name + weight values
  profile list      — name, basePalette, mood, targets
  recipe list       — name, basePalette override or (profile), token count
  recipe validate   — bloom path, required token, mix range, and shipped recipe shape checks

Workbench (npm run workbench):
  Node server on :7865 — HTTP /api/blooms, /api/profiles, /api/inspect/:profile,
  /api/docs, /api/docs/:id,
  POST /api/run for constrained sow/grow actions, WebSocket /ws, fs.watch on blooms dir.
  Vite dev server on :5173 — renders labeled color swatches by semantic group,
  bloom/profile preview, profile/status controls, target selection, sow/grow buttons, command output,
  docs/help view with README opened first plus generated Live Help, optional
  Use Bloom palette toggle for theming the workbench from the active profile bloom,
  and live-updates via WebSocket when sow writes a new bloom.
  Ports can be overridden with UB_WORKBENCH_PORT and UB_WORKBENCH_UI_PORT.
  scripts/unclaimed-bloom detects an already-running workbench URL and opens it instead
  of starting a second server.

Wallpaper integration (wallset/wallset-backend):
  wallset optionally picks a wallpaper from UB_WALLPAPER_DIR and calls wallset-backend.
  wallset-backend calls spore sow <profile> --wallpaper <image> then spore grow <profile>.
  Default profile is the "desktop" composition, so GTK grows from daily-gtk before
  the rest of the desktop grows from daily. sow runs matugen twice internally:
  full run (templates + wallpaper set), then dry-run to extract clean colors JSON.

Key design decisions implemented:
  - sow/grow separation: sow is always safe; grow is explicit and side-effectful
  - Spores namespaced by profile: spores/{profile}/{target}.json
  - basePalette optional in recipes: omit to inherit from profile
  - Matugen source: nested JSON with dark/light/default variants per token
  - --wallpaper flag on sow: full matugen run (templates + wallpaper) then dry-run for JSON
  - Two-run matugen: without --dry-run stdout is template logs not JSON; keep them separate
  - Palette normalization: gruvbox-light carries canonical alias keys so any
    recipe written against tokyonight-moon vocabulary works unchanged
  - GTK ownership: UB generates fully-resolved hex CSS (no mix() with hardcoded TN values);
    base palette is the mixing anchor, not Tokyonight — daily-light with gruvbox-light
    produces gruvbox-anchored GTK colors
  - Icons token display: inspect strips common __ADART_ICON_*__ prefix for alignment
  - current-profile file: written by sow; composition profiles can restore it after multi-profile runs
  - current-wallpaper file: written by sow --wallpaper, read by RofiAdapter for background-image
  - swaync blur: backdrop-filter: blur(16px) in style.css + Hyprland layerrule blur for
    namespace swaync-notification-window + ignore_alpha = 0.1 to prevent halo on transparent padding
  - matugen [templates] required: even with no entries, the key must exist in config.toml or
    matugen's serde parser throws "missing field `templates`" — keep an empty [templates] section
  - daily profile uses ags/source-heavy (matugen-dominant mix); daily-light keeps subtle-ish
  - All commands accept optional [target] filter: sow/grow/inspect/status
```

### What works today

```bash
# Full workflow — one command per step:
scripts/spore sow daily --wallpaper ~/.config/backgrounds/wallpaper.png
scripts/spore inspect daily ghostty
scripts/spore grow daily

# Switch profile (light theme):
scripts/spore sow daily-light --wallpaper ~/.config/backgrounds/wallpaper.png
scripts/spore grow daily-light

# Per-target operations:
scripts/spore sow daily ghostty
scripts/spore grow daily ghostty
scripts/spore inspect daily mycli

# Status and discovery:
scripts/spore status
scripts/spore palette list
scripts/spore mood list
scripts/spore profile list
scripts/spore recipe list
scripts/spore recipe list ghostty
scripts/spore recipe validate
```

Ghostty reloads live on `grow` (SIGUSR2). mycli and sqlit update their configs immediately.

### Answered design questions

- Dev invocation: `scripts/spore <command>` (wrapper sets UB_DATA_DIR automatically).
- Data vs cache: data in repo / `~/.config/unclaimed-bloom/`; generated outputs in `~/.cache/unclaimed-bloom/`.
- Sow vs grow separation: `sow` = safe, cache-only; `grow` = explicit, writes to `~/.config/`.
- Spore namespacing: `spores/{profile}/{target}.json` — profiles never clobber each other.
- Recipe mix weights: `0.0..1.0` range, per-token explicit values, optional per-recipe basePalette override.
- Matugen source: nested JSON read at sow time; variant (dark/light/default) selected per-profile.
- Direct Matugen invocation: `sow --wallpaper <path>` calls matugen and updates the cache file.
- Palette vocabulary: all palettes should carry canonical alias keys matching the recipe token vocabulary.
- Old scripts: retired to `scripts/retired/`; `ub-mycli-apply` stays as active worker.
- Template format: adapters write output directly; plain text templates can be added when needed.

## Current decision snapshot

- project:: **Unclaimed Bloom**
- motto:: **Unclaimed Bloom grows from ash, borrowed soil, and unclaimed hope.**
- CLI:: **spore**
- commands:: **sow** (cache) | **grow** (apply) | **inspect** | **status** | **list**
- core:: **TypeScript**
- runtime:: **Node.js**
- workbench:: **Vite** (live swatch preview, inspect view, docs/help view, bloom-themed UI toggle, profile/status controls, sow/grow bridge)
- workers:: **existing Python/Bash scripts through adapters**
- architecture:: config-first, recipe-driven, adapter-rendered, worker-friendly, UI-previewable.
- core metaphor:: one bloom, many spores. sow seeds into cache, grow them into config.
- status:: broad adapter set working. wallset integrated. workbench can inspect, show profile status, and run sow/grow.
- next major target:: neovim.
- eventual visual layer:: Vite workbench interactive features after palette normalization.

## Suggested cache shape (current)

```text
~/.cache/unclaimed-bloom/
├── matugen-colors.json          raw Matugen output (dark + light variants per token)
├── current-profile              name of the last profile passed to sow
├── icons-runtime.json           resolved icon token aliases (written by IconsAdapter)
├── blooms/
│   ├── daily.json
│   └── daily-light.json
├── spores/
│   ├── daily/
│   │   ├── ghostty.json
│   │   ├── mycli.json
│   │   ├── sqlit.json
│   │   ├── icons.json
│   │   └── gtk.json
│   └── daily-light/
│       ├── ghostty.json
│       ├── mycli.json
│       ├── sqlit.json
│       ├── icons.json
│       └── gtk.json
├── ini/
│   └── mycli-colors.ini         intermediate INI for ub-mycli-apply
└── reports/
    ├── daily/
    │   ├── ghostty.json
    │   ├── mycli.json
    │   └── sqlit.json
    └── daily-light/
        └── ...
```

## Do not do next

- Do not build interactive Vite workbench features before palette normalization is solid.
- Do not move existing scripts unless imports/calls are updated and tested.
- Do not add more palettes without ensuring they carry the canonical alias keys.

## Next steps

### ✅ 1. Icons target — DONE
IconsAdapter writes icons-runtime.json + calls icons-generate worker.
Output theme: ADArt-Papirus-Unclaimed-Bloom.

### ✅ 2. Vite workbench skeleton — DONE
src/ui/ + src/server/workbench.ts. npm run workbench → :5173.
Live swatch preview via WebSocket, auto-reconnect.

### ✅ 6. GTK target — DONE
GtkAdapter renders gtk-adart-unclaimed-bloom.css with fully-resolved hex.
Writes to repo themes/ and ~/.local/share/themes/ live install simultaneously.

### ✅ 3. Palette normalization spec — DONE

18 canonical keys enforced across all palettes. `spore palette validate` added.
`docs/Prompt__create_palette.md` documents AI-assisted palette creation.
Palettes: catppuccin-mocha/latte, rose-pine-dawn, solarized-light, gruvbox-light, dracula, tokyonight-moon/day.

### ✅ 4. Additional moods — DONE

Four moods, named as growth stages:
- `dormant`   — surface:0.05 fg:0.08 accent:0.20 semantic:0.10 — palette is the law
- `budding`   — surface:0.15 fg:0.18 accent:0.45 semantic:0.25 — gentle, for light profiles
- `blooming`  — surface:0.25 fg:0.32 accent:0.50 semantic:0.40 — balanced default
- `overgrown` — surface:0.70 fg:0.60 accent:0.90 semantic:0.70 — Matugen dominates

`daily` uses `blooming`, `daily-light` uses `budding`.

### ✅ 5. Neovim target — DONE

NvimAdapter writes `~/.config/nvim/lua/generated/matugen-colors.lua` (same format
Matugen used). Reloads all running nvim instances via socket glob.
Recipes: `subtle-ish` and `source-heavy` (stronger Matugen pull).
matugen-mix.nvim plugin unchanged — UB just took over the file.

### ✅ 6. GTK target — DONE (see earlier entry above)

### ✅ 9. AGS target — DONE
AgsAdapter writes matugen.css from source colors + 10 recipe-mixed overrides.
Post-hook reloads AGS only.
Recipes: `subtle-ish` and `source-heavy`.

### ✅ 9b. swaync + waybar targets — DONE
SwayncAdapter writes `~/.config/swaync/colors/matugen.css` and reloads swaync CSS.
WaybarAdapter writes `~/.config/waybar/colors/matugen.css` and sends SIGUSR2 to waybar.
Recipes: `subtle-ish` and `source-heavy`.

### ✅ 10. SDDM target — DONE
SddmAdapter writes full theme.conf for sddm-adart-matugener.
HyprlandAdapter writes matugen.lua + matugen.conf (two output files, two formats).
RofiAdapter, YaziAdapter, WlogoutAdapter, IcedAdapter, PotatoAdapter also added.
matugen/config.toml is now template-free — all targets owned by UB.

### ✅ 7. Install script — DONE

`scripts/install` installs a `spore` launcher to `~/.local/bin/spore` by default.
The launcher keeps code execution tied to the repo checkout, but uses
`~/.config/unclaimed-bloom/` as `UB_DATA_DIR` by default.

It also copies first-run data files and scripts to `~/.config/unclaimed-bloom/`,
installs zsh completions to `~/.config/zsh/completions/`, and supports `--force`
for refreshing installed data files when future Adam knowingly chooses violence.

### ✅ 8a. Workbench profile/status + sow/grow bridge — DONE

Workbench now shows selected profile metadata, per-target sown/grown status, and
provides constrained `sow`/`grow` controls for all targets or one selected target.
The local server exposes `/api/profiles` and `/api/run`; `/api/run` only accepts
`sow` or `grow` with a known profile and optional target. It returns stdout/stderr
so the UI can show what happened without inventing a second command language,
because one is enough.

### ✅ 8a.1 Workbench docs/help view — DONE

Workbench has a `docs` view backed by `/api/docs`. It opens `README.md` first and
can switch to generated `Live Help`, which is built from current profiles, targets,
recipes, and cache status. Repo-internal docs like `PROJECT-CAPSULE.md`, prompts,
and old project capsules stay in the folder structure and are not shown in the Vite
workbench. Markdown is rendered locally in the UI with support for headings,
paragraphs, lists, tables, blockquotes, fenced code, inline code, links, and
emphasis. All H2 sections render as collapsible details blocks. Live Help target
status renders as a table so profile targets line up like data, not a shopping
list after rain. Profile sections render as nested collapsible details blocks,
with the current profile sorted first, opened by default, and marked with a current
badge. Target table rows include `inspect`, `sow`, and `grow` actions wired to the
existing workbench controls. This is documentation, not a static-site generator audition.

### ✅ 8a.2 Workbench Bloom UI palette toggle — DONE

Workbench has a `Use Bloom palette` toggle in the profile control strip plus a bloom
derivation preview. When enabled, it maps the active profile bloom onto the workbench CSS variables:
`surface.base` → background, `surface.raised` → panel surface,
`text.primary`/`text.muted` → text, `accent.primary` → accent,
`border.subtle` → borders, and state colors for success/warning/danger.
The UI derives softer surface/accent/border variables from those raw bloom values and
keeps fallback text/accent colors when contrast would drop too far. The preference is
stored in localStorage and reapplies when the active profile changes or a WebSocket
bloom update arrives. The workbench uses the bloom, not raw Matugen, because Matugen
is source and the bloom is the supervised result.

### 8b. Workbench interactive recipe editing

Extend the Vite workbench with:
- Per-token mix weight sliders (recipe editing)
- Palette selector per profile
- Mood selector
- Before/after swatch comparison

### 11. Hyprlock target

Add a dedicated adapter for hyprlock.conf color variables.
Currently hyprlock reads from matugen.conf (written by HyprlandAdapter).
A HyprlockAdapter could write more tailored lock-screen colors separately.
