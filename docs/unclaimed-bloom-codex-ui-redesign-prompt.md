# Codex Prompt — Unclaimed Bloom Workbench Redesign

You are working in the `Praczet/unclaimed-bloom` repository.

The goal is to redesign and rebuild the **Workbench UI and its workbench server API** into a proper theme-forging tool. You may significantly restructure or replace the current UI and workbench server code if needed, as long as you do **not** break the main CLI application or the existing core generation logic.

The user wants an iterative, visually testable process. Do not do one giant rewrite. Work in small steps. After each step, produce a visible artifact that can be run and tested in the browser.

## Project context

Unclaimed Bloom is a theming/workbench project. It combines:

- base palettes such as Tokyonight Moon,
- Matugen/source colors,
- moods,
- bloom palettes,
- recipes,
- target-specific generated configs.

The current workbench has useful data, but the UI feels like a debug table. It has three main views: `bloom`, `inspect`, and `docs`. The `docs` / Live Help page currently mixes documentation, quick commands, and a very useful live profile/target status preview. That live profile preview should become a real workbench tool, not hidden inside documentation.

The desired UI should feel like a **theme forge / palette laboratory / developer cockpit**, not like a generic SaaS dashboard.

Keep the dark, calm, technical mood. Think Tokyonight Moon, Hyprland, Ghostty, Neovim, Matugen, theme workshop. Useful first, pretty second, but still visually coherent.

## Important constraints

- You may redesign the UI completely.
- You may redesign the workbench server API completely if needed.
- You may reorganize UI files, types, components, state, CSS, and workbench server helpers.
- You must not break the main CLI application.
- Do not change core CLI behavior unless absolutely necessary and explicitly justified.
- Keep changes incremental and testable.
- Prefer TypeScript types/interfaces over loose `any`.
- Prefer explicit `private`, `protected`, and `public` class members if classes are introduced.
- Do not use TypeScript `#private` fields.
- Preserve the project’s dry, slightly poetic/dev-tool personality.

## Main product goal

The workbench should let the user:

1. choose a profile,
2. understand profile composition,
3. see profile/target status,
4. see how bloom colors are generated,
5. inspect how a recipe transforms bloom/source colors into target colors,
6. assign recipes to targets,
7. edit recipes and mixer weights visually,
8. optionally edit raw recipe data in an advanced panel,
9. preview results before saving,
10. save recipe changes or save them as a new recipe,
11. sow/grow profile or target from the UI,
12. see the equivalent CLI commands.

In one sentence:

> The workbench should let me choose a profile and target, see how colors are generated, inspect how a recipe transforms them, edit the recipe/mixers visually, preview the result, then save and grow.

## Key concept: profile composition

Profiles can have composition, for example a desktop profile composed of multiple profile parts or profile variants. This must be visible in the UI.

The redesigned UI should not treat profiles as just flat tabs. It should show:

- current profile,
- profile type/composition if available,
- base palette,
- mood,
- source,
- bloom timestamp/state,
- targets belonging to the profile,
- target recipe assignment,
- target state: sown/grown/status/errors.

If the existing data model does not expose composition clearly, add workbench-only API shaping that makes this visible without breaking CLI internals.

## Current UI problems to solve

The current UI problems:

- top header is too dense;
- profile tabs, metadata, actions, target selector, palette strip, and timestamp all compete in one area;
- Live Help mixes documentation and live profile control data;
- the useful profile status table is hidden inside Docs;
- Bloom view is visually too table-heavy too early;
- Inspect view is useful but visually flat;
- there is no strong selected context;
- recipe names are static text instead of interactive controls;
- no real UI exists for editing recipes or mixers;
- the current UI does not clearly show profile composition;
- actions do not clearly show what CLI command they correspond to.

## Desired information architecture

Redesign around these main sections:

1. **Overview**
2. **Bloom**
3. **Inspect**
4. **Recipes** or **Workshop**
5. **Docs**

Suggested navigation labels:

- `overview`
- `bloom`
- `inspect`
- `recipes`
- `docs`

`Docs` should become real documentation/help only. It may contain quick commands and explanations, but live profile status should move to Overview.

## Desired layout

Prefer a three-area workbench layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Header: Unclaimed Bloom • connection • global actions       │
├───────────────┬─────────────────────────────┬──────────────┤
│ Sidebar       │ Main view                   │ Context      │
│ Profiles      │ Overview/Bloom/Inspect/etc. │ Actions      │
│ Targets       │                             │ CLI command  │
└───────────────┴─────────────────────────────┴──────────────┘
```

### Left sidebar

The left sidebar should show:

- app title and connection indicator,
- profile list,
- active/current profile marker,
- profile composition if available,
- target list for selected profile,
- target status badges,
- active target marker.

This should replace the current cramped horizontal profile tab area where possible.

### Main area

The main area changes depending on the selected section.

### Right context/action panel

The right panel should always show:

- selected profile,
- selected target if any,
- selected recipe if any,
- current mode,
- useful state/warnings,
- action buttons,
- equivalent CLI command snippets.

Example commands:

```bash
spore sow daily
spore grow daily
spore inspect daily swaync
spore grow daily swaync
```

## Section details

### 1. Overview

This replaces the live profile preview currently hidden in Docs.

It should show:

- active profile summary,
- composition tree/list if available,
- base palette,
- mood,
- source,
- bloom state/time,
- target count,
- target status table/card list.

Target rows/cards should show:

- target name,
- recipe name,
- sown time,
- grown time,
- status,
- actions: inspect, sow, grow.

The recipe name must be interactive. Clicking the recipe should open a recipe assignment/editor panel or popover.

### 2. Bloom

This view answers: “What did this profile generate?”

It should show:

- profile bloom summary,
- a hero palette strip,
- grouped bloom tokens:
  - surface,
  - text,
  - accent,
  - state,
  - border,
  - selection.

Token rows/cards should visually compare:

```text
base palette color + source/mood color + mix weight => bloom result
```

The view should remain useful for debugging, but it should be more visual and less like a raw table dump.

### 3. Inspect

This view answers: “How does this recipe turn bloom/source colors into target colors?”

It should show one target at a time, for example:

```text
Target: swaync
Recipe: source-heavy
Profile: daily
```

Rows should show:

- target token name,
- bloom token used,
- source tint token,
- mix value,
- final result color.

This view should make the pipeline visually clear:

```text
Bloom token -> source tint -> mix -> target result
```

### 4. Recipes / Workshop

This is the new important tool.

It should allow editing recipes and mixers from the UI.

Required capabilities, ideally phased in:

- list recipes,
- show which targets use each recipe,
- assign a recipe to a target,
- edit recipe rows in a form/table,
- change bloom token references,
- change source token references,
- adjust mix weights,
- preview output against active profile/source,
- save recipe,
- save as new recipe,
- reset/revert changes,
- optionally expose a raw JSON/YAML editor in an advanced panel.

Recipe editing model should support both:

- shared/global recipes,
- target assignment to a recipe,
- “save as new recipe” to avoid accidentally changing all targets.

When editing a shared recipe, make it clear which targets will be affected.

### 5. Docs

Docs should become clean help/documentation only.

It may include:

- quick CLI commands,
- explanation of terms: bloom, profile, source, mood, recipe, target, sow, grow,
- where files are stored,
- how workbench and CLI relate.

It should no longer be the primary place for live profile status.

## Visual design direction

Use a dark, calm, technical style.

Design principles:

- stronger hierarchy,
- less clutter in top header,
- more breathing room,
- clear active states,
- larger and more meaningful color swatches,
- compact but readable badges,
- tables only where tables are truly useful,
- cards for summaries and editable objects,
- visible pipeline relationships.

Avoid:

- generic SaaS dashboard look,
- huge glowing gradients,
- decorative clutter,
- hiding important controls in markdown.

The UI should feel like a developer’s theme workshop: dry, useful, slightly poetic, not childish.

## Iterative implementation plan

Do not implement everything at once.

Each step must leave the app runnable and visually testable with:

```bash
npm run dev
```

After each step:

- summarize what changed,
- list touched files,
- mention what the user should visually test,
- mention any missing/fake/nonfunctional parts clearly.

### Step 1 — UI shell and navigation

Create the new workbench shell:

- left sidebar,
- main content area,
- right context/action panel,
- navigation sections: overview, bloom, inspect, recipes, docs.

Move existing data into this shell with minimal behavior changes.

Artifact to test:

- user can switch sections,
- active profile and active target are visible,
- old Bloom/Inspect/Docs content still accessible or roughly migrated.

### Step 2 — Overview replaces Live Help status

Move the profile/target status preview out of Docs and into Overview.

Overview should show:

- profile summary,
- profile composition if available,
- target table/card list,
- recipe badges,
- target status,
- inspect/sow/grow buttons.

Docs should be reduced toward actual help.

Artifact to test:

- Overview clearly replaces the useful part of Live Help.
- Recipe names are visible and clickable, even if the first version only opens a read-only panel.

### Step 3 — Improve Bloom view

Redesign Bloom view into grouped visual token sections.

Artifact to test:

- bloom palette is easier to understand visually,
- token groups are clear,
- color transformation pipeline is visible.

### Step 4 — Improve Inspect view

Redesign Inspect view for one target at a time.

Artifact to test:

- selecting target updates inspect view,
- recipe name and target are obvious,
- each row clearly shows bloom/source/mix/result.

### Step 5 — Read-only Recipe Workshop

Create Recipes/Workshop view in read-only mode first.

It should show:

- recipe list,
- selected recipe details,
- rows/tokens/mix values,
- targets using this recipe,
- raw config preview if practical.

Artifact to test:

- user can browse recipes and understand them.

### Step 6 — Editable Recipe Workshop with preview

Add editing UI:

- dropdown/token pickers,
- mix sliders/number inputs,
- preview results,
- dirty state,
- reset changes.

Do not save to disk until preview works safely.

Artifact to test:

- user can modify values in UI and see preview changes.

### Step 7 — Saving and assignment

Add server endpoints for:

- assigning recipe to target,
- saving recipe,
- saving as new recipe,
- reverting/resetting.

Be careful not to break CLI/core config format.

Artifact to test:

- changes persist,
- CLI still works,
- affected targets are clear.

## API/server guidance

The current workbench server can be changed heavily if needed.

Prefer creating clear workbench API endpoints such as:

- `GET /api/workbench/state`
- `GET /api/profiles`
- `GET /api/profiles/:profile`
- `GET /api/profiles/:profile/overview`
- `GET /api/profiles/:profile/bloom`
- `GET /api/profiles/:profile/targets/:target/inspect`
- `GET /api/recipes`
- `GET /api/recipes/:recipe`
- `POST /api/recipes/:recipe/preview`
- `PUT /api/recipes/:recipe`
- `POST /api/recipes/save-as`
- `PUT /api/profiles/:profile/targets/:target/recipe`
- `POST /api/actions/sow`
- `POST /api/actions/grow`

These endpoint names are suggestions. Use what best fits the existing code.

If API shape changes, update the UI types accordingly.

## Code quality expectations

- Split large UI files into modules/components where useful.
- Create a `src/ui/types.ts` or `src/ui/types/` structure for UI data types.
- Keep server-side response types clear.
- Avoid duplicating transformation logic if it already exists in core modules.
- Keep CLI and core generation logic stable.
- Keep CSS organized, possibly by layout/components/views.
- Avoid “clever” abstractions too early.

## Personality / tone

This project has a dry, slightly sarcastic, poetic developer-tool tone. Keep that in labels/help text where appropriate, but do not overdo it.

Good:

- “No bloom generated yet.”
- “This recipe feeds 4 targets.”
- “Changing this shared recipe will affect: swaync, waybar, rofi.”
- “Preview only. No files harmed yet.”

Bad:

- corporate dashboard language,
- motivational nonsense,
- excessive emoji,
- decorative copy that hides function.

## First task to start with

Start with **Step 1 only**.

Do not implement recipe saving yet.
Do not rewrite the CLI.
Do not attempt the entire redesign in one pass.

Implement the new shell and navigation, preserve existing functionality as much as possible, and make the result visually testable.

When finished, provide:

1. changed files,
2. short explanation,
3. how to run,
4. what to visually test,
5. known unfinished parts.
