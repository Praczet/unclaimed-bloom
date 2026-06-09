# Experiment: Deno Try to Hatch

> A guided migration experiment for Unclaimed Bloom.
> Not a rewrite. Not a religious conversion. A controlled hatching.

## Context

Unclaimed Bloom currently uses a JavaScript/TypeScript + Vite/Node-style setup. The project is a local Linux desktop theming system that grows shared palettes/blooms and scatters target-specific spores into tools such as Ghostty, GTK, icons, Neovim, Rofi, SDDM, mycli, sqlit, and future desktop creatures.

The desired experimental architecture is:

```text
Deno core
  loads palettes
  loads profiles
  validates recipes
  generates bloom
  generates target spores
  renders templates
  runs workers
  writes reports

Vite workbench
  previews palettes
  edits recipes/profiles
  compares spores
  shows generated outputs
  reads reports

Python workers
  scan icon themes
  tokenize SVGs
  recolor files
  rebuild symlink forests
  produce JSON reports
```

This experiment exists because Adam wants to learn Deno by using it in a real project, not by building another tutorial toy that prints a cheerful lie and then dies.

## Branch

Use an experiment branch:

```bash
git switch -c experiment/deno-try-to-hatch
```

Alternative project-flavoured branch name:

```bash
git switch -c spore/deno-try-to-hatch
```

## Main rule

Do **not** rewrite the whole project.

Work in small vertical slices. Each phase must produce one visible, runnable result and teach one Deno concept.

```text
One phase = one working thing + one learned Deno concept.
```

The existing Node/Vite setup must keep working until Adam explicitly decides otherwise.

## Role of the AI agent

You are helping Adam migrate experimentally and learn Deno. You are not here to run ahead and return with a finished cathedral Adam did not see being built.

For every phase:

1. Explain what will be changed before changing it.
2. List files you plan to create or modify.
3. Ask Adam to confirm if the phase touches existing working files.
4. Implement only the current phase.
5. Show how to run it.
6. Explain what Deno concept was learned.
7. Suggest a tiny manual experiment Adam can do himself.
8. Stop.

Do not proceed automatically to the next phase unless Adam asks.

Adam wants to be part of the process. Treat him as the builder, not as someone watching a progress bar while an AI raccoon rearranges the cupboards.

## Communication style

Prefer:

- concrete commands
- file paths
- short explanations before code
- one phase at a time
- honest uncertainty
- dry, useful humour
- practical learning notes

Avoid:

- huge rewrites
- generic migration enthusiasm
- corporate language
- pretending Deno is magic
- changing unrelated architecture
- removing existing Node/Vite scripts too early
- over-abstracting before the first useful command works

Use Adam's project style. Slightly poetic is fine. Buzzword soup is not.

## Technical target

Recommended target stack:

```text
Runtime:       Deno
Language:      TypeScript
UI:            Vite + TypeScript
CLI:           Deno executable / deno task
Server:        Deno.serve()
Workers:       Python for icon scanning/recoloring
Config:        JSON / JSONC
Templates:     simple token renderer first
```

Important: keep Vite for the Workbench UI. The experiment is about moving the core/server/CLI direction toward Deno, not replacing Vite with a homemade sadness engine.

## Non-goals

Do not:

- remove `package.json`
- remove existing Vite configuration
- remove the current Workbench server before a Deno replacement is proven
- rewrite Python icon workers in TypeScript
- rewrite Python icon workers in Rust
- convert all templates at once
- invite GTK as the first target
- create a giant plugin framework
- make Deno the god; Matugen already tried, and we learned things

## Learning goals

By the end of this experiment Adam should understand:

- `deno.json`
- `deno task`
- `deno run`
- Deno permissions
- Deno file APIs
- Deno environment handling
- Deno tests
- `Deno.serve()`
- `Deno.Command`
- how Deno can coexist with Vite
- how Python workers can remain external worker creatures
- whether this migration feels better in practice, not only in theory

## Project structure to create

Create the Deno experiment under a separate namespace first:

```text
src/deno/
├── cli/
│   └── spore.ts
├── core/
│   ├── paths/
│   │   └── BloomPaths.ts
│   ├── palettes/
│   │   └── PaletteLoader.ts
│   ├── profiles/
│   │   └── ProfileLoader.ts
│   ├── recipes/
│   │   └── RecipeLoader.ts
│   ├── blooms/
│   │   └── BloomGenerator.ts
│   ├── spores/
│   │   └── SporeGenerator.ts
│   ├── templates/
│   │   └── TemplateRenderer.ts
│   ├── workers/
│   │   └── WorkerRunner.ts
│   └── reports/
│       └── ReportWriter.ts
├── server/
│   └── workbench.ts
└── tests/
    └── fixtures/
```

This keeps the experiment easy to inspect and easy to delete if it grows horns.

Later, if the experiment succeeds, the code can be moved from `src/deno/` into the main `src/core`, `src/cli`, and `src/server` structure.

## Current state — as of 2026-06-09

Branch: `experiment/deno-try-to-hatch`

### What is built and working

**CLI** (`deno task spore:dev -- <command>`):

```
help / version / status
palette  list | inspect <slug>
profile  list | inspect <name>
recipe   list [target] | inspect <target/name>   ← shows available recipes if only target given
mood     list
sow      <profile> [target] [--dry-run]          ← bloom + spores into cache; hints "next: grow"
grow     <profile> [target] [--dry-run]          ← renders templates from cache; hints "next: plant"
inspect  <profile> [target]                      ← bloom colors or spore token table
replant  <profile> <target> <recipe> [--apply]   ← updates profile JSON; --apply runs sow+grow
plant    <profile> [target] [--dry-run]          ← deploys rendered files via hooks/plant.json
```

All commands support `--json` for machine-readable output.

**Core modules** (all with `*.test.ts`):

```
src/deno/core/
  paths/BloomPaths.ts          ← UB_DATA_DIR / UB_CACHE_DIR, all path methods
  palettes/PaletteLoader.ts
  profiles/ProfileLoader.ts
  recipes/RecipeLoader.ts
  moods/MoodLoader.ts          ← includes list() returning MoodSummary[]
  blooms/BloomGenerator.ts
  spores/SporeGenerator.ts
  templates/TemplateRenderer.ts  ← {{token}}, {{token|rgba}}, {{token|rgba:0.75}}
  hooks/HookRunner.ts          ← copy + exec steps, {{rendered}} etc. vars, dry-run
  reports/ReportWriter.ts
```

**Templates** — every target has at least one:

```
targets/
  ags/templates/matugen.css
  ghostty/templates/ghostty.theme
  hyprland/templates/matugen.conf     ← uses {{primary|rgba}} for Hyprland format
  iced/templates/matugen.json
  icons/templates/runtime.json        ← intermediate input for Python worker
  mycli/templates/colors.ini
  nvim/templates/matugen-colors.lua
  potato/templates/theme.json
  rofi/templates/matugen.rasi         ← uses {{background|rgba:0.75}} for CSS format
  sddm/templates/theme.conf
  sqlit/templates/theme.json
  swaync/templates/matugen.css
  waybar/templates/matugen.css
  wlogout/templates/matugen.css
  yazi/templates/theme.toml
```

**Plant hooks** — targets that need post-deploy steps:

```
targets/gtk/hooks/plant.json    ← copy to ~/.local/share/themes/... + gsettings
targets/icons/hooks/plant.json  ← run adart-worker + gsettings
```

**Workbench API** (`deno task workbench:server` → port 7865):

```
GET /api/status
GET /api/palettes
GET /api/profiles          ← rich shape: targets[], bloomAt, sownAt per target
GET /api/recipes[?target=]  ← includes usages[] and raw recipe
GET /api/blooms            ← flat Record<profile, bloom> map (Vite UI compatible)
GET /api/bloom-preview/<profile>
GET /api/inspect/<profile>
GET /api/docs              ← stub (returns empty list)
```

Vite workbench (`npm run dev:workbench:ui`) already proxies `/api` to port 7865.
Run both servers to use the Deno backend with the existing UI.

### Test suite

```bash
deno task test   # 61 tests, all passing
```

### Lifecycle for any target

```bash
deno task spore:dev -- sow daily yazi
deno task spore:dev -- grow daily yazi
deno task spore:dev -- plant daily yazi   # only if targets/yazi/hooks/plant.json exists
```

### Key architecture decisions made

- **No adapters** — replaced by `targets/<target>/templates/` + generic `TemplateRenderer`
- **Template lookup fallback** — tries `dataDir/targets/` first, then repo `targets/` (dev workflow works without UB_DATA_DIR)
- **Hook system** — `targets/<target>/hooks/plant.json` with `copy` and `exec` steps; targets without hooks are silently skipped by `plant`
- **`sow → grow → plant`** — three explicit stages; `grow` is always cache-only, `plant` is the real-files step
- **`UB_DATA_DIR=$(pwd)`** — use this when editing profiles/recipes in the repo to avoid stale installed config
- **`replant --apply`** — runs sow + grow inline; add `--plant` concept is next
- **Composition profiles** — not supported yet in sow/grow/plant (throws a clear error)
- **icons target** — `grow` produces `runtime.json` in cache; `plant` would call the Python worker (hook wired, worker path TBD)
- **sddm** — template exists with 5 tokens; full recipe decision postponed

### What is NOT done yet

- `plant` does not yet support `--apply` chaining from `replant`
- WebSocket live updates in workbench server
- `/api/run` endpoint (sow/grow triggered from UI)
- Composition profile support in any write command
- `grow --plant` or `plant` for targets without a `hooks/plant.json` (they are skipped)
- Python worker integration (Phase 11)
- `spore:local` task shortcut (`UB_DATA_DIR=$(pwd)` pre-set)

### Next phase

**Phase 11 — Python worker runner** (`src/deno/core/workers/WorkerRunner.ts`)
Use `Deno.Command` to run a Python worker, capture stdout/stderr/exit code, write a report.
Start with a demo worker, then wire into the icons target via `plant`.

---

## Phase 0 — Prepare the experiment

### Purpose

Create the migration plan and safety boundary.

### Files

Create:

```text
docs/EXPERIMENT-DENO-TRY-TO-HATCH.md
```

Optional:

```text
docs/DENO-MIGRATION-LOG.md
```

### Requirements

- Explain the target architecture.
- Explain what stays unchanged.
- Explain rollback.
- Explain how Adam participates.

### Adam participation

Adam reads the plan and edits it before code starts.

### Done when

The branch exists and the experiment document exists.

## Phase 1 — Add `deno.json`

### Purpose

Introduce Deno without touching the existing Node/Vite workflow.

### Files

Create:

```text
deno.json
```

### Suggested first version

```json
{
  "tasks": {
    "check": "deno check src/deno/cli/spore.ts",
    "fmt": "deno fmt",
    "lint": "deno lint",
    "test": "deno test",
    "spore:dev": "deno run --allow-read --allow-write --allow-env --allow-run src/deno/cli/spore.ts",
    "workbench:server": "deno run --allow-read --allow-write --allow-env --allow-run --allow-net=127.0.0.1,localhost src/deno/server/workbench.ts"
  },
  "compilerOptions": {
    "strict": true
  }
}
```

### Adam participation

Run:

```bash
deno --version
deno task fmt
deno task lint
```

If Deno is not installed, install it first.

### Deno concept learned

- Deno project configuration
- Deno tasks
- built-in formatter/linter/checker

### Done when

`deno task fmt` and `deno task lint` run without damaging the current project. A heroic minimum, yes.

## Phase 2 — Create tiny CLI skeleton

### Purpose

Create an experimental Deno CLI entry point.

### Files

Create:

```text
src/deno/cli/spore.ts
```

### Requirements

Support:

```bash
deno task spore:dev -- --help
deno task spore:dev -- version
deno task spore:dev -- status
```

`status` should print:

- current working directory
- detected `UB_DATA_DIR`
- detected `UB_CACHE_DIR`
- default data/cache paths if env vars are missing

### Adam participation

Run commands and intentionally change env vars:

```bash
UB_DATA_DIR=/tmp/ub-data UB_CACHE_DIR=/tmp/ub-cache deno task spore:dev -- status
```

### Deno concept learned

- CLI args
- `Deno.env.get()`
- permission requirements
- basic Deno execution

### Done when

The CLI responds with useful status output.

## Phase 3 — Implement BloomPaths

### Purpose

Move path resolution into testable Deno core logic.

### Files

Create:

```text
src/deno/core/paths/BloomPaths.ts
src/deno/core/paths/BloomPaths.test.ts
```

### Requirements

Resolve:

- data dir
- cache dir
- profiles dir
- palettes dir
- recipes dir
- spores dir
- reports dir

Respect:

- `UB_DATA_DIR`
- `UB_CACHE_DIR`

Use defaults:

```text
~/.config/unclaimed-bloom
~/.cache/unclaimed-bloom
```

### Adam participation

Read the test file and change one expected path to see the test fail. Then restore it. Yes, deliberately breaking tests is allowed. It is called learning, not vandalism, if you put it back.

### Deno concept learned

- Deno tests
- path handling
- environment handling in testable code

### Done when

```bash
deno test
```

passes.

## Phase 4 — Load palettes

### Purpose

Load real palette files with clear validation errors.

### Files

Create:

```text
src/deno/core/palettes/PaletteLoader.ts
src/deno/core/palettes/PaletteLoader.test.ts
src/deno/tests/fixtures/palettes/
```

### Requirements

- Load JSON palettes.
- Optionally support JSONC later, but do not overcomplicate the first pass.
- Validate:
  - name
  - slug
  - kind
  - colors
- Add CLI commands:

```bash
deno task spore:dev -- palette list
deno task spore:dev -- palette inspect <slug>
```

### Adam participation

Create one deliberately broken fixture palette and observe the error message.

### Deno concept learned

- `Deno.readTextFile`
- JSON parsing
- clear errors
- test fixtures

### Done when

Palette list and inspect work from the experimental CLI.

## Phase 5 — Load profiles and recipes

### Purpose

Teach the Deno core about Unclaimed Bloom's actual domain.

### Files

Create:

```text
src/deno/core/profiles/ProfileLoader.ts
src/deno/core/recipes/RecipeLoader.ts
```

Add tests and fixtures.

### Requirements

Add CLI commands:

```bash
deno task spore:dev -- profile list
deno task spore:dev -- profile inspect <name>
deno task spore:dev -- recipe list
deno task spore:dev -- recipe inspect <target/name>
```

### Adam participation

Open one profile and one recipe and explain, in comments or notes, which fields are still confusing. The goal is not only code. It is also making the project vocabulary sharper.

### Deno concept learned

- typed domain models
- loader patterns
- useful validation

### Done when

Profiles and recipes can be listed and inspected without touching generated outputs.

## Phase 6 — Generate first bloom

### Purpose

Make the Deno core generate a shared bloom.

### Files

Create:

```text
src/deno/core/blooms/BloomGenerator.ts
src/deno/core/reports/ReportWriter.ts
```

### Requirements

Add command:

```bash
deno task spore:dev -- grow <profile> --dry-run
deno task spore:dev -- grow <profile>
```

Start with a small semantic palette:

- background
- foreground
- surface
- primary
- secondary
- accent
- border
- selection

Write output to:

```text
~/.cache/unclaimed-bloom/blooms/<profile>.json
```

Write report to:

```text
~/.cache/unclaimed-bloom/reports/<timestamp>-grow-<profile>.json
```

### Adam participation

Compare the generated bloom with the source/base palette and decide whether the first mixing rules feel sane.

### Deno concept learned

- writing files
- creating directories
- report generation
- dry-run command design

### Done when

A bloom can be generated and inspected.

## Phase 7 — Generate first Ghostty spore

### Purpose

Generate one target-specific output from the bloom.

### Files

Create:

```text
src/deno/core/spores/SporeGenerator.ts
```

Add a Ghostty recipe fixture if needed.

### Requirements

Add commands:

```bash
deno task spore:dev -- target grow ghostty --profile <profile>
deno task spore:dev -- target inspect ghostty --profile <profile>
```

Write spore to:

```text
~/.cache/unclaimed-bloom/spores/ghostty.json
```

### Adam participation

Open the spore JSON and decide whether the target-specific fields are useful or too abstract.

### Deno concept learned

- transforming shared domain output into target-specific data
- keeping target logic outside the generic bloom

### Done when

Ghostty spore JSON exists and is readable.

## Phase 8 — Render template

### Purpose

Render a target config file using a simple template renderer.

### Files

Create:

```text
src/deno/core/templates/TemplateRenderer.ts
```

### Requirements

Start with simple token replacement:

```text
{{background}}
{{foreground}}
{{cursor_color}}
{{selection_background}}
```

No loops. No conditionals. No template cathedral.

Add command:

```bash
deno task spore:dev -- render ghostty --profile <profile> --dry-run
deno task spore:dev -- render ghostty --profile <profile>
```

Write generated file to cache first, not directly to real config.

### Adam participation

Edit the template manually and rerun render. See what breaks. Improve error messages if needed.

### Deno concept learned

- text processing
- safe output
- missing-token errors

### Done when

A Ghostty config can be rendered into cache.

## Phase 9 — Create Deno Workbench API server

### Purpose

Build an experimental Deno API server for the Workbench.

### Files

Create:

```text
src/deno/server/workbench.ts
```

### Requirements

Use `Deno.serve()`.

Add endpoints:

```text
GET /api/status
GET /api/palettes
GET /api/profiles
GET /api/recipes
GET /api/blooms/current
```

Do not implement WebSockets yet.

### Adam participation

Run:

```bash
deno task workbench:server
curl http://127.0.0.1:7865/api/status
```

Then open the endpoint in the browser.

### Deno concept learned

- `Deno.serve()`
- `Request`
- `Response`
- JSON APIs
- network permissions

### Done when

The API server returns useful JSON.

## Phase 10 — Connect Vite Workbench to Deno server

### Purpose

Keep Vite for UI, but let it talk to the Deno backend.

### Files

Modify only if needed:

```text
vite.config.ts
src/ui/...
```

### Requirements

- Keep existing Vite dev flow.
- Proxy `/api` to Deno server if needed.
- Do not remove old server yet.
- Add docs for running both:

```bash
deno task workbench:server
npm run dev:workbench:ui
```

### Adam participation

Run both servers and confirm the UI reads Deno data.

### Deno concept learned

- Deno and Vite coexistence
- backend/frontend boundary

### Done when

Workbench displays data from the Deno server.

## Phase 11 — Run Python worker from Deno

### Purpose

Prove that Python remains the dirty-hands worker layer.

### Files

Create:

```text
src/deno/core/workers/WorkerRunner.ts
workers/demo-worker.py
```

### Requirements

Use `Deno.Command`.

Capture:

- stdout
- stderr
- exit code
- duration

Add command:

```bash
deno task spore:dev -- worker run demo
```

### Adam participation

Modify the demo worker to fail intentionally. Observe how the Deno core reports the error.

### Deno concept learned

- subprocesses
- `--allow-run`
- worker contracts
- report wrapping

### Done when

Deno can run a Python worker and report success/failure cleanly.

## Phase 12 — Integrate icon worker

### Purpose

Call the real or existing icon scan/recolor worker from Deno.

### Requirements

- Do not rewrite the icon worker.
- Create an icon target adapter/recipe.
- Pass all paths explicitly.
- Capture report path.
- Summarize result in CLI.

Add command:

```bash
deno task spore:dev -- target scan icons --profile <profile>
```

### Adam participation

Read the worker report and decide which report fields should be promoted into the Workbench UI.

### Deno concept learned

- real worker orchestration
- stable JSON contracts
- migration without rewriting working creatures

### Done when

Deno can trigger an icon worker and summarize the report.

## Phase 13 — Add WebSocket updates later

### Purpose

Add live progress only after the API is stable.

### Requirements

Add `/ws` endpoint with JSON events:

- grow started
- grow finished
- worker started
- worker finished
- error

Do not stream every internal detail yet.

### Adam participation

Watch progress in the Workbench and decide what is actually useful, not just visually busy.

### Deno concept learned

- WebSocket handling
- UI event contracts

### Done when

Workbench receives live progress events.

## Phase 14 — Migration verdict

### Purpose

Decide based on experience, not novelty smell.

### Files

Update:

```text
docs/DENO-MIGRATION-LOG.md
```

### Questions to answer

- What became simpler?
- What became harder?
- What still depends on Node?
- What still depends on Vite/npm?
- Did Deno permissions feel useful or annoying?
- Are tests easier or harder?
- Is the CLI nicer?
- Is the Workbench server cleaner?
- What should be migrated next?
- What should stay as-is?
- Should this experiment continue, pause, or be buried with respect?

### Done when

Adam can make a real decision:

```text
continue / pause / abandon
```

## AI prompt to start the experiment

Use this prompt with an AI coding agent:

```text
You are working in the Unclaimed Bloom repository.

We are starting an experimental branch called "Deno Try to Hatch".

Goal:
Explore migrating the core/CLI/server direction toward Deno while keeping Vite for the Workbench UI and Python for heavy icon workers.

Important:
This is not a full rewrite. Keep the existing Node/Vite setup working. Work in small vertical slices. Adam wants to learn Deno by participating, so explain each step and stop after each phase.

Target architecture:
- Deno core loads palettes, profiles, validates recipes, generates blooms/spores, renders templates, runs workers, writes reports.
- Vite Workbench previews palettes, edits recipes/profiles, compares spores, shows generated outputs, reads reports.
- Python workers scan icon themes, tokenize SVGs, recolor files, rebuild symlink forests, produce JSON reports.

Rules:
- Implement only the requested phase.
- Before coding, list files you plan to create or modify.
- Do not remove package.json, Vite config, existing Node scripts, or existing workers.
- Use explicit public/private/protected TypeScript members. Do not use #private fields.
- Prefer simple, readable code.
- Add useful errors with file paths and command details.
- Add tests where the phase asks for them.
- After coding, show exact commands to run.
- Explain the Deno concept learned in this phase.
- Give Adam one tiny manual experiment to try.
- Stop and wait.

Start with Phase 0: create docs/EXPERIMENT-DENO-TRY-TO-HATCH.md and, optionally, docs/DENO-MIGRATION-LOG.md. Do not modify runtime code yet.
```

## Final reminder

This experiment is successful even if the final decision is “do not migrate”.

The real output is not only Deno code. The real output is understanding:

```text
Does Deno make Unclaimed Bloom cleaner, safer, and nicer to work on?
```

If yes, continue.

If no, bury the experiment politely and steal the good ideas.

No technology deserves loyalty before it has carried groceries.
