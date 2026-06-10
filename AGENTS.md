# AGENTS.md

> Instructions for AI agents, coding assistants, future Adam, and any alien intelligence unlucky enough to wake up inside this repository.

## Project

- **Name:** Unclaimed Bloom
- **CLI:** `spore`
- **Motto:** Unclaimed Bloom grows from ash, borrowed soil, and unclaimed hope.
- **Project capsule:** `docs/PROJECT-CAPSULE.md`
- **Status:** active — Deno migration complete, all adapters replaced by templates + hooks
- **Updated:** 2026-06-10

## Read this first

Before changing anything important, read:

1. `docs/PROJECT-CAPSULE.md`
2. this `AGENTS.md`
3. existing scripts/configs before replacing them
4. generated reports before guessing what happened

This project is not “one more theme”. It is a recipe-driven ecosystem for growing one shared color/mood **bloom**, then scattering target-specific **spores** into tools like GTK, icons, AGS, Ghostty, Neovim, mycli, sqlit, and future desktop creatures.

The architecture is allowed to be poetic. The implementation should remain inspectable.

If you feel tempted to invent a perfect abstract framework before the first useful command works, sit down. Have water. GTK has already caused enough suffering.

---

## Core architecture

Recommended structure:

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

### Current technical decision

```text
core language: TypeScript
runtime:       Deno
workbench:     Deno server (workbench.ts) + Vite UI frontend
CLI:           spore — installed launcher or deno task dev -- <command>
workers:       Python workers via WorkerRunner (Deno.Command)
```

The Deno migration is complete. Node.js and npm are gone from the core. Vite is kept only for the workbench UI frontend build.

### Main rule

Unclaimed Bloom should **orchestrate first**, not rewrite everything.

Existing Python/Bash scripts are valid workers. They are not shame. They are the small creatures that already know how to do the dirty work.

Adapters may call workers. Workers should communicate through stable JSON contracts and reports.

---

## Vocabulary

### Bloom

A **bloom** is the generated shared semantic palette/mood result.

It is grown from:

- source palette, usually Matugen
- base palette, for example TokyoNight Moon
- mood
- profile
- weights/rules

Example output path:

```text
~/.cache/unclaimed-bloom/blooms/current.json
```

### Spore

A **spore** is a target-specific interpretation of the bloom.

Examples:

```text
~/.cache/unclaimed-bloom/spores/ghostty.json
~/.cache/unclaimed-bloom/spores/icons.json
~/.cache/unclaimed-bloom/spores/gtk.json
```

Each target gets its own spore because each target may need a different relationship to the source palette and base palette.

Ghostty can stay subtle and moonish. Icons can borrow more from Matugen. GTK can be supervised like a suspicious toddler holding scissors.

### Recipe

A **recipe** defines how one target interprets the bloom.

Recipes control:

- source/base mix
- token mappings
- target-specific weights
- per-token overrides
- target-specific behavior

A new target should usually join by adding:

1. a folder under `targets/<name>/`
2. one or more recipes under `targets/<name>/recipes/`
3. a template under `targets/<name>/templates/`
4. a plant hook under `targets/<name>/hooks/plant.json` if deployment needs steps
5. a worker only if the target requires heavier processing (icons, etc.)

See `docs/adding-a-target.md` for a full walkthrough.

### Adapter

An **adapter** orchestrates target output.

It may:

- render templates
- call Python/Bash/Node workers
- copy files
- run post-hooks
- collect reports

Adapters should not decide what looks good. Taste belongs in recipes.

### Worker

A **worker** is an executable helper script.

Workers may be written in:

- Python
- Bash
- Node/TypeScript
- anything executable and non-hostile

Workers should prefer JSON input/output contracts and should write reports where possible.

---

## Design principles

- One bloom, many spores.
- TokyoNight Moon is a palette, not a prison.
- Matugen is a source, not the god.
- Target recipes are allowed to disagree.
- Existing scripts should be integrated before they are rewritten.
- Generated output must be inspectable.
- Reports matter.
- Prefer boring folder names over metaphor overdose.
- Keep poetic language in docs, but keep commands usable.
- The Vite workbench is a visual layer over the core, not the brain.
- The CLI/core owns orchestration.
- Do not sacrifice code readability for wallpaper drama.
- Do not make a perfect abstraction before a tiny useful run exists.
- If the solution requires a goat, a daemon, and a 400-line shell substitution, step back.

---

## Current status

All core targets are working. The `sow → grow → plant` lifecycle is complete.

Active targets: ghostty, gtk, icons, nvim, ags, swaync, waybar, hyprland, rofi, yazi, wlogout, iced, sddm, mycli, sqlit, potato, broot.

Pending:

```text
- icons plant hook: adart-worker integration via WorkerRunner (progress streaming)
- workbench /api/run endpoint (sow/grow from UI)
- workbench WebSocket events (live run progress)
- composition profile support in plant command
```

---

## CLI reference

Main command: `spore` (installed) or `deno task dev -- <command>` (repo dev).

```bash
# Discovery
spore palette list
spore palette inspect <slug>
spore mood list
spore profile list
spore profile inspect <name>
spore recipe list [target]
spore recipe inspect <target/name>

# Core lifecycle
spore sow <profile> [target] [--wallpaper <path>] [--dry-run]
spore grow <profile> [target] [--dry-run]
spore plant <profile> [target] [--dry-run]
spore inspect <profile> [target]
spore status

# Recipe management
spore replant <profile> <target> <recipe> [--apply]

# Workers
spore worker run <name>
```

All commands accept `--json` for machine-readable output.

Dev with repo data instead of installed config:

```bash
deno task dev:local -- sow daily ghostty
```

---

## Coding style

### TypeScript

Adam generally prefers:

- TypeScript classes when they help organize code
- explicit `private`, `protected`, and `public` members
- **not** TypeScript `#private` fields
- typed function parameters
- clear interfaces/types
- readable, direct code
- practical modularity over architecture theater

Prefer:

```ts
export class RecipeLoader {
    public async load(path: string): Promise<Recipe> {
        // ...
    }

    private validateRecipe(recipe: unknown): Recipe {
        // ...
    }
}
```

Avoid:

```ts
class CosmicAbstractRecipeHydratorFactoryProvider {
    #state = new Map();
}
```

That second one may be legal TypeScript. It may also be a cry for help.

### Errors

Errors should be useful.

Bad:

```text
Failed.
```

Good:

```text
Failed to load recipe "icons/moonish-matugen".
Expected file:
  ~/.config/unclaimed-bloom/targets/icons/recipes/moonish-matugen.json
```

If a command runs another worker script, include:

- command
- arguments
- exit code
- stderr summary
- report path, if any

### Reports

Reports should explain what happened.

Suggested report fields:

```json
{
  "target": "icons",
  "profile": "daily",
  "recipe": "icons/moonish-matugen",
  "status": "ok",
  "inputs": {},
  "outputs": [],
  "warnings": [],
  "errors": [],
  "startedAt": "",
  "finishedAt": ""
}
```

### Generated files

Generated files should be clearly marked.

Include a comment where possible:

```text
Generated by Unclaimed Bloom / spore.
Do not edit this file directly unless you enjoy losing arguments with automation.
```

---

## Existing project context

Unclaimed Bloom grows from several existing theming efforts:

### Matugen

Current source of wallpaper-based palettes.

Future role:

- source provider
- not the whole design system

### GTK theme

Current role:

- CSS overrides
- Matugen/TokyoNight-ish colors
- Thunar and GTK experiments

Future role:

- GTK target recipe + adapter/templates
- later integration, not first proof

### Icon theme

Current role:

- Papirus-based icon recoloring
- color maps
- token replacement
- symlink forests
- weights
- reports
- possible/current Vite workbench for preview

Future role:

- major target
- existing scripts remain workers first
- current palette/weight idea becomes generalized recipe logic

### Ghostty

Current role:

- moonish Matugen/TokyoNight mix

Future role:

- good first simple target

### Neovim

Current role:

- TokyoNight Moon plus Matugen mixing

Future role:

- target recipe that preserves readability

### mycli / sqlit

Current role:

- smaller generated palette offshoots

Future role:

- good early small targets

### AGS

Current role:

- planned Matugen marriage / possible visual shell

Future role:

- target and maybe UI/controller later

---

## The story Adam is telling

This section is for alien AI. Read carefully. Do not optimize the soul out of the project.

Adam is not merely trying to generate colors. He is trying to make a desktop feel like it belongs to him without becoming trapped in one old theme. The current world grew from Matugen, TokyoNight Moon, GTK CSS, Papirus icons, Ghostty, Neovim, mycli, sqlit, AGS dreams, Bash scripts, Python scripts, and many “temporary” experiments that became load-bearing. As usual.

The project name came after a long search through words like sanctum, forge, shade, craft, prism, stray, spare, needless, unclaimed, tone, whisper, bloom, voice, glint, spore, scatter.

The final image:

> Unclaimed Bloom grows from ash, borrowed soil, and unclaimed hope.

This matters.

It means:

- old experiments are ash, not garbage
- Matugen and base palettes are borrowed soil
- the output is not a sterile “theme”
- the system should let color survive and spread
- each target gets its own spore
- the project should remain practical, but with a little weather inside it

The humor is dry, warm, slightly sarcastic, sometimes dramatic. This is not accidental. It helps make technical work feel less like filing taxes in a basement.

Examples of acceptable tone in docs:

```text
GTK is invited later, under supervision.
TokyoNight Moon is a palette, not a prison.
Matugen is a source, not the god.
Purity is how projects become beautiful and dead.
```

Examples of tone to avoid:

```text
This enterprise-grade solution empowers seamless design-token synergy.
```

No. Absolutely not. Leave the room.

---

## Adam’s language and communication style

Adam is Polish and prefers English, but writes quickly, emotionally, and often with typos. Do not confuse typos with lack of understanding.

Common traits:

- words may be misspelled
- letters may be swapped
- punctuation may be chaotic
- sentences may carry several ideas at once
- metaphors may appear before requirements
- jokes may hide actual design decisions
- “do you know what I mean?” often means “I know the shape, help me sharpen it”
- emotional phrasing often contains the real architecture

Important: in this project/chat context, **do not correct Adam’s English unless he asks**. He explicitly asked to skip English corrections in this chat.

When interpreting Adam:

- read for intent, not surface spelling
- preserve his metaphors when they reveal design
- turn chaos into structure without making it sterile
- ask only when genuinely blocked
- offer practical next steps
- keep dry humor if appropriate
- do not overpraise
- do not flatten his voice into corporate documentation

Adam may say something like:

```text
this bastard child of matugen and ghostty should borrow less moon but icons should get more drama
```

Translate that into:

```text
Target recipes need independent source/base mix weights.
```

But do not throw away the “bastard child” energy. It is part of the project memory, regrettably useful.

---

## How to respond to Adam in this project

Prefer:

- direct answers
- concrete file paths
- project skeletons
- commands
- small implementation steps
- downloadable files for long markdown/scripts
- dry, useful humor
- honesty about uncertainty

Avoid:

- generic productivity coaching
- corporate tone
- too much praise
- pretending a decision is final if it is still exploratory
- rewriting existing working tools without reason
- explaining obvious things too slowly
- ignoring the emotional/metaphorical layer

Adam likes documentation that is:

- useful
- slightly dry/sarcastic
- structured
- not over-polished
- not fake-cheerful
- not buzzword soup

Every documentation callout should have a title if callouts are used.

---

## File and artifact preferences

Adam prefers long markdown/code/prompts/scripts as downloadable files because the web chat interface often damages formatting.

He uses **DLAF** to mean “downloadable file”.

For notes/project docs, prefer **Logseq-friendly structure**:

```text
type::
tags::
status::
updated::
project::
related::
```

Avoid YAML front matter unless explicitly requested.

For repository docs like `AGENTS.md`, standard Markdown is fine, but Logseq-friendly properties are acceptable in project capsules.

---

## Practical repo rules

### Git commits

- Use Conventional Commits style for commit messages.
- Prefer short one-line messages unless the change genuinely needs a body.
- Do not add `Co-authored-by` trailers or other AI attribution trailers.
- Good:

```text
feat: add something
fix: handle missing recipe file
docs: update project capsule
```

- Bad:

```text
Add something
feat(scope)!: implement enterprise-grade chromatic synergy
Co-authored-by: Some AI <ai@example.com>
```

### Do

- Keep `docs/PROJECT-CAPSULE.md` up to date when major decisions change.
- Keep `AGENTS.md` up to date when workflow/architecture expectations change.
- Add reports for generated outputs.
- Prefer JSON contracts between core/adapters/workers.
- Keep generated files out of source unless they are examples/fixtures.
- Name things plainly in code, poetically in docs.
- Preserve existing scripts before replacing them.
- Add comments/header tags to scripts where appropriate.

### Do not

- Make the Vite UI the only place where logic exists.
- Hide taste decisions inside adapters.
- Hardcode TokyoNight Moon as the only base palette.
- Treat Matugen as the whole system.
- Rewrite Python/Bash workers before the contract is proven.
- Create a giant plugin architecture before two targets work.
- Let GTK choose the mood. GTK had its chance.

---

## Deno task reference

```bash
deno task dev -- <command>          # run CLI (installed data)
deno task dev:local -- <command>    # run CLI (repo data, UB_DATA_DIR=$(pwd))
deno task test                      # run test suite
deno task check                     # type-check CLI
deno task fmt                       # format src/deno/
deno task lint                      # lint src/deno/
deno task workbench:build           # build workbench UI
deno task workbench:server          # start workbench API server
deno task workbench                 # build + serve workbench
```

---

## Final reminder

Unclaimed Bloom should feel like this:

```text
Not a perfect theme.
Not a corporate design system.
Not a shrine to TokyoNight.
Not a Matugen wrapper with delusions.

A small living system:
one bloom,
many spores,
borrowed soil,
old ash,
and enough hope to make the desktop feel less accidental.
```
