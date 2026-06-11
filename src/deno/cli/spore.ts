import { HumanDisplay } from "./HumanDisplay.ts";
import {
  BloomGenerator,
  type BloomPreview,
} from "../core/blooms/BloomGenerator.ts";
import { EventEmitter, type RunState } from "../core/events/EventEmitter.ts";
import { HookRunner, type WorkerEventSink } from "../core/hooks/HookRunner.ts";
import { MoodLoader, type MoodSummary } from "../core/moods/MoodLoader.ts";
import { BloomPaths } from "../core/paths/BloomPaths.ts";
import { type Palette, PaletteLoader } from "../core/palettes/PaletteLoader.ts";
import {
  type CompositionProfile,
  type CompositionRun,
  type MatugenSource,
  type Profile,
  type ProfileEntry,
  ProfileLoader,
} from "../core/profiles/ProfileLoader.ts";
import { type Recipe, RecipeLoader } from "../core/recipes/RecipeLoader.ts";
import { ReportWriter } from "../core/reports/ReportWriter.ts";
import { type Spore, SporeGenerator } from "../core/spores/SporeGenerator.ts";
import { TemplateRenderer } from "../core/templates/TemplateRenderer.ts";
import { localISOString } from "../core/time/localIso.ts";
import { WorkerRunner } from "../core/workers/WorkerRunner.ts";

const VERSION = "0.1.0-deno-experiment";

type OutputMode = "human" | "json";

interface ParsedArgs {
  readonly outputMode: OutputMode;
  readonly args: string[];
}

interface BloomContext {
  readonly paths: BloomPaths;
  readonly profile: Profile;
  readonly basePalette: Palette;
  readonly sourcePalette: Palette;
  readonly moodName: string;
  readonly preview: BloomPreview;
}

interface SownSporeResult {
  readonly target: string;
  readonly recipe: string;
  readonly sporePath: string;
  readonly reportPath: string;
  readonly spore: Spore;
}

class SporeCli {
  private readonly display = new HumanDisplay();
  private outputMode: OutputMode = "human";

  public async run(args: string[]): Promise<void> {
    const parsed = this.parseGlobalArgs(args);
    this.outputMode = parsed.outputMode;
    const commandArgs = parsed.args;
    const command = commandArgs[0] ?? "--help";

    if (command === "--help" || command === "-h" || command === "help") {
      this.printHelp();
      return;
    }

    if (command === "--version" || command === "-v" || command === "version") {
      if (this.outputMode === "json") {
        this.printJson({ ok: true, version: VERSION });
        return;
      }
      this.printHuman(`spore ${VERSION}`);
      return;
    }

    if (command === "status") {
      await this.printStatus();
      return;
    }

    if (command === "sow") {
      await this.sowProfile(commandArgs.slice(1));
      return;
    }

    if (command === "grow") {
      await this.growProfile(commandArgs.slice(1));
      return;
    }

    if (command === "plant") {
      await this.plantProfile(commandArgs.slice(1));
      return;
    }

    if (command === "replant") {
      await this.replantTarget(commandArgs.slice(1));
      return;
    }

    if (command === "inspect") {
      await this.runInspectCommand(commandArgs.slice(1));
      return;
    }

    if (command === "palette") {
      await this.runPaletteCommand(commandArgs.slice(1));
      return;
    }

    if (command === "profile") {
      await this.runProfileCommand(commandArgs.slice(1));
      return;
    }

    if (command === "recipe") {
      await this.runRecipeCommand(commandArgs.slice(1));
      return;
    }

    if (command === "mood") {
      await this.runMoodCommand(commandArgs.slice(1));
      return;
    }

    if (command === "targets") {
      await this.runTargetsCommand(commandArgs.slice(1));
      return;
    }

    if (command === "worker") {
      await this.runWorkerCommand(commandArgs.slice(1));
      return;
    }

    if (command === "prune") {
      await this.runPruneCommand(commandArgs.slice(1));
      return;
    }

    this.printUnknownCommand(command);
    Deno.exit(1);
  }

  public printFatalError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);

    if (this.outputMode === "json") {
      this.printJson({
        ok: false,
        error: {
          message,
        },
      });
      return;
    }

    this.printHumanError(message);
  }

  private parseGlobalArgs(args: string[]): ParsedArgs {
    const commandArgs = args[0] === "--" ? args.slice(1) : args;
    const filtered: string[] = [];
    let outputMode: OutputMode = "human";

    for (let index = 0; index < commandArgs.length; index += 1) {
      const arg = commandArgs[index];

      if (arg === "--json") {
        outputMode = "json";
        continue;
      }

      if (arg === "--format" && commandArgs[index + 1] === "json") {
        outputMode = "json";
        index += 1;
        continue;
      }

      filtered.push(arg);
    }

    return {
      outputMode,
      args: filtered,
    };
  }

  private printHelp(): void {
    this.printHuman(`spore ${VERSION}

Unclaimed Bloom CLI.

Lifecycle:
  sow     <profile> [target] [--dry-run] [--bloom-osd]          Compute bloom and spores into cache.
  grow    <profile> [target] [--dry-run]                        Render cached spores into files.
  plant   <profile> [target] [--dry-run] [--bloom-osd]          Deploy rendered files via hooks.
  replant <profile> <target> <recipe> [--apply] [--plant]       Change recipe in profile.

Inspect (cache artifacts, generated by sow/grow):
  inspect bloom  <profile>
  inspect spore  <profile> <target>

Config (source definitions in ~/.config/unclaimed-bloom/):
  palette  [list | show <slug>    | validate <slug>]
  profile  [list | show <name>    | validate <name>]
  recipe   [list [target] | show <target/name> | validate <target>]
  mood     [list | show <name>    | validate <name>]

Maintenance:
  prune   [--keep <n>] [--rendered] [--all] [--dry-run]          Trim accumulated cache files.

Targets:
  targets [<target>]    List all targets, or show one in detail.

Utility:
  worker <name> [args...]   Run a Python worker.
  status                    Show runtime paths and env overrides.
  version                   Show version.
  help                      Show this help.

Global flags:
  --json           Machine-readable JSON output.
  --format json    Same as --json.`);
  }

  private async printStatus(): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const pathSummary = paths.summary();
    const stateBase = paths.stateFile().replace(/\.json$/, "");
    const sowState = await this.readStageState(`${stateBase}-sow.json`);
    const growState = await this.readStageState(`${stateBase}-grow.json`);
    const plantState = await this.readStageState(`${stateBase}-plant.json`);
    const lastProfile = [plantState, growState, sowState].find((s) => s?.profile)?.profile;

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        status: { ...pathSummary, sow: sowState, grow: growState, plant: plantState },
      });
      return;
    }

    this.printHuman("Unclaimed Bloom");
    this.printHuman("");

    const infoFields: Array<{ label: string; value: string; dim?: boolean }> = [];

    if (lastProfile) {
      infoFields.push({ label: "profile", value: lastProfile });
      try {
        const profile = await new ProfileLoader().inspect(paths.profilesDir(), lastProfile);
        if (!this.isCompositionProfile(profile)) {
          infoFields.push({ label: "palette", value: profile.basePalette });
          infoFields.push({ label: "mood", value: profile.mood });
        }
      } catch { /* profile not in data dir — skip */ }
    }

    const fmtStage = (state: RunState | null): string => {
      if (!state) return this.display.dim("(never)");
      return `${this.formatDate(state.updated_at)}  ${this.display.dim(state.status)}`;
    };

    infoFields.push({ label: "sow", value: fmtStage(sowState) });
    infoFields.push({ label: "grow", value: fmtStage(growState) });
    infoFields.push({ label: "plant", value: fmtStage(plantState) });
    infoFields.push({ label: "data", value: pathSummary.dataDir, dim: true });
    infoFields.push({ label: "cache", value: pathSummary.cacheDir, dim: true });

    this.printHuman(this.display.fields(infoFields));

    if (lastProfile) {
      const sporeRows = await this.readSporeRows(paths, lastProfile);
      if (sporeRows.length > 0) {
        this.printHuman("");
        this.printHuman(this.display.table(sporeRows, [
          { header: "target", value: (r) => r.target },
          { header: "recipe", value: (r) => r.recipe },
          { header: "sown", value: (r) => r.sownAt, dim: true },
          { header: "colors", value: (r) => r.colors },
        ]));
      }
    }
  }

  private async readStageState(path: string): Promise<RunState | null> {
    try {
      const text = await Deno.readTextFile(path);
      return JSON.parse(text) as RunState;
    } catch {
      return null;
    }
  }

  private async readSporeRows(
    paths: BloomPaths,
    profile: string,
  ): Promise<Array<{ target: string; recipe: string; sownAt: string; colors: string }>> {
    const profileEntry = await new ProfileLoader().inspect(paths.profilesDir(), profile).catch(() => null);
    const subProfiles: string[] = profileEntry && this.isCompositionProfile(profileEntry)
      ? profileEntry.runs.map((r) => r.profile)
      : [profile];

    const rows: Array<{ target: string; recipe: string; sownAt: string; colors: string }> = [];
    for (const sub of subProfiles) {
      try {
        for await (const entry of Deno.readDir(paths.sporesDir(sub))) {
          if (!entry.isFile || !entry.name.endsWith(".json") || entry.name.includes("__")) continue;
          const target = entry.name.replace(/\.json$/, "");
          try {
            const spore = await this.readJson(paths.sporeFile(sub, target)) as Spore;
            rows.push({
              target: subProfiles.length > 1 ? `${sub}/${target}` : target,
              recipe: spore.recipe,
              sownAt: this.formatDate(spore.generatedAt),
              colors: this.sporeSwatches(spore.colors, 8),
            });
          } catch { /* skip unreadable spore */ }
        }
      } catch { /* no spores dir yet */ }
    }
    return rows.sort((a, b) => a.target.localeCompare(b.target));
  }

  private sporeSwatches(colors: Record<string, string>, count: number): string {
    const hexValues = Object.values(colors);
    if (hexValues.length === 0) return "";
    const step = Math.max(1, Math.floor(hexValues.length / count));
    const picked: string[] = [];
    for (let i = 0; i < hexValues.length && picked.length < count; i += step) {
      picked.push(hexValues[i]);
    }
    return picked.map((hex) => this.display.swatch(hex)).join("");
  }

  private formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const day = String(d.getDate()).padStart(2, " ");
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      return `${month} ${day} ${hours}:${mins}`;
    } catch {
      return iso;
    }
  }

  private async runInspectCommand(args: string[]): Promise<void> {
    const subcommand = args[0];

    if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      this.printInspectHelp();
      return;
    }

    if (subcommand === "bloom") {
      await this.inspectBloom(args[1]);
      return;
    }

    if (subcommand === "spore") {
      await this.inspectCachedSpore(args[1], args[2]);
      return;
    }

    if (subcommand === "mood") {
      this.printInspectRedirect(
        "mood",
        "mood show <name>",
        "Moods are config definitions — no cache artifact exists.",
      );
      Deno.exit(1);
    }

    if (subcommand === "palette") {
      this.printInspectRedirect(
        "palette",
        "palette show <slug>",
        "Palettes are config definitions — no cache artifact exists.",
      );
      Deno.exit(1);
    }

    if (subcommand === "profile") {
      this.printInspectRedirect(
        "profile",
        "profile show <name>",
        "Profiles are config definitions — no cache artifact exists.",
      );
      Deno.exit(1);
    }

    if (subcommand === "recipe") {
      this.printRecipeInspectRedirect();
      Deno.exit(1);
    }

    this.printUnknownCommand(`inspect ${subcommand}`);
    Deno.exit(1);
  }

  private printInspectHelp(): void {
    this.printHuman(`Inspect cache artifacts (generated by sow/grow):
  spore inspect bloom  <profile>
  spore inspect spore  <profile> <target>

For config definitions use: palette show, profile show, recipe show, mood show.`);
  }

  private printInspectRedirect(
    noun: string,
    suggestion: string,
    reason: string,
  ): void {
    if (this.outputMode === "json") {
      this.printJson({
        ok: false,
        error: {
          message: `inspect ${noun}: no cache artifact.`,
          reason,
          suggestion: `spore ${suggestion}`,
        },
      });
      return;
    }
    this.printHumanError(`inspect ${noun}: no cache artifact.`);
    this.printHumanError(`  ${reason}`);
    this.printHumanError(`  Use: spore ${suggestion}`);
  }

  private printRecipeInspectRedirect(): void {
    if (this.outputMode === "json") {
      this.printJson({
        ok: false,
        error: {
          message: "inspect recipe: no cache artifact.",
          reason: "Recipes are config definitions — their output is a spore.",
          suggestions: [
            "spore recipe show <target/name>  (definition)",
            "spore inspect spore <profile> <target>  (generated output)",
          ],
        },
      });
      return;
    }
    this.printHumanError("inspect recipe: no cache artifact.");
    this.printHumanError("  Recipes are config definitions — their output is a spore.");
    this.printHumanError("  Use: spore recipe show <target/name>            (definition)");
    this.printHumanError("       spore inspect spore <profile> <target>     (generated output)");
  }

  private async runPaletteCommand(args: string[]): Promise<void> {
    const subcommand = args[0] ?? "list";

    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      this.printPaletteHelp();
      return;
    }

    if (subcommand === "list") {
      await this.listPalettes();
      return;
    }

    if (subcommand === "show") {
      await this.showPalette(args[1]);
      return;
    }

    if (subcommand === "validate") {
      await this.validatePalette(args[1]);
      return;
    }

    if (subcommand === "inspect") {
      this.printInspectRedirect(
        "palette",
        "palette show <slug>",
        "Palettes are config definitions — no cache artifact exists.",
      );
      Deno.exit(1);
    }

    this.printUnknownCommand(`palette ${subcommand}`);
    Deno.exit(1);
  }

  private printPaletteHelp(): void {
    this.printHuman(`Palette commands:
  spore palette list
  spore palette show <slug>
  spore palette validate <slug>`);
  }

  private async listPalettes(): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new PaletteLoader();
    const palettes = await loader.list(paths.palettesDir());

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "palette list",
        palettes,
      });
      return;
    }

    this.printHuman(this.display.table(palettes, [
      { header: "slug", value: (palette) => palette.slug },
      { header: "kind", value: (palette) => palette.kind },
      { header: "name", value: (palette) => palette.name },
      {
        header: "colors",
        value: (palette) => String(palette.colorCount),
        align: "right",
      },
      { header: "path", value: (palette) => palette.path, dim: true },
    ]));
  }

  private async showPalette(slug: string | undefined): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new PaletteLoader();

    if (!slug) {
      this.printUsageError("Missing palette slug.", "palette show <slug>");
      if (this.outputMode === "human") {
        this.printHuman("");
        const palettes = await loader.list(paths.palettesDir());
        if (palettes.length > 0) {
          this.printHuman("Available palettes:");
          this.printHuman(this.display.fields(palettes.map((palette) => ({
            label: `  ${palette.slug}`,
            value: palette.kind,
            dim: palette.kind === "dark",
          }))));
          this.printHuman("");
        } else {
          this.printHuman("No palettes found.");
        }
        this.printPaletteHelp();
      }
      Deno.exit(1);
    }

    const palette = await loader.inspect(paths.palettesDir(), slug);

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "palette show",
        palette,
      });
      return;
    }

    this.printHuman("");
    this.printHuman(`${palette.name} ${this.display.dim(`(${palette.slug})`)}`);
    const infoFields = [];
    infoFields.push({ label: "kind", value: palette.kind });
    infoFields.push({
      label: "colors",
      value: String(Object.keys(palette.colors).length),
    });
    if (palette.source) {
      infoFields.push({ label: "source", value: palette.source, dim: true });
    }
    this.printHuman(this.display.fields(infoFields));
    this.printHuman("");
    this.printHuman(this.display.table(
      Object.entries(palette.colors).sort(([a], [b]) =>
        a.localeCompare(b, undefined, { numeric: true })
      ).map(([name, hex]) => ({
        name,
        hex,
      })),
      [
        { header: "token", value: (row) => row.name },
        { header: "color", value: (row) => this.display.colorValue(row.hex) },
      ],
    ));
  }

  private async validatePalette(slug: string | undefined): Promise<void> {
    if (!slug) {
      this.printUsageError("Missing palette slug.", "palette validate <slug>");
      Deno.exit(1);
    }
    const paths = BloomPaths.fromDeno();
    const loader = new PaletteLoader();
    try {
      await loader.inspect(paths.palettesDir(), slug);
      if (this.outputMode === "json") {
        this.printJson({ ok: true, command: "palette validate", slug });
      } else {
        this.printHuman(`${this.display.dim("✓")} ${slug}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.outputMode === "json") {
        this.printJson({ ok: false, command: "palette validate", slug, error: { message: msg } });
      } else {
        this.printHuman(`✗ ${slug}`);
        this.printHuman(`  ${msg}`);
      }
      Deno.exit(1);
    }
  }

  private async runProfileCommand(args: string[]): Promise<void> {
    const subcommand = args[0] ?? "list";

    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      this.printProfileHelp();
      return;
    }

    if (subcommand === "list") {
      await this.listProfiles();
      return;
    }

    if (subcommand === "show") {
      await this.showProfile(args[1]);
      return;
    }

    if (subcommand === "validate") {
      await this.validateProfile(args[1]);
      return;
    }

    if (subcommand === "inspect") {
      this.printInspectRedirect(
        "profile",
        "profile show <name>",
        "Profiles are config definitions — no cache artifact exists.",
      );
      Deno.exit(1);
    }

    this.printUnknownCommand(`profile ${subcommand}`);
    Deno.exit(1);
  }

  private printProfileHelp(): void {
    this.printHuman(`Profile commands:
  spore profile list
  spore profile show <name>
  spore profile validate <name>`);
  }

  private async listProfiles(): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new ProfileLoader();
    const profiles = await loader.list(paths.profilesDir());

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "profile list",
        profiles,
      });
      return;
    }

    this.printHuman(this.display.table(profiles, [
      { header: "name", value: (profile) => profile.name },
      { header: "type", value: (profile) => profile.type },
      {
        header: "base",
        value: (profile) => profile.basePalette ?? "",
        dim: true,
      },
      {
        header: "mood",
        value: (profile) => profile.mood ?? "",
        dim: true,
      },
      {
        header: "targets",
        value: (profile) => String(profile.targetCount ?? ""),
        align: "right",
      },
      {
        header: "runs",
        value: (profile) => String(profile.runCount ?? ""),
        align: "right",
      },
      { header: "path", value: (profile) => profile.path, dim: true },
    ]));
  }

  private async showProfile(name: string | undefined): Promise<void> {
    if (!name) {
      this.printUsageError("Missing profile name.", "profile show <name>");
      if (this.outputMode === "human") {
        this.printProfileHelp();
      }
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const loader = new ProfileLoader();
    const profile = await loader.inspect(paths.profilesDir(), name);
    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "profile show",
        profile,
      });
      return;
    }

    if (this.isCompositionProfile(profile)) {
      this.printHuman(this.display.fields([
        { label: "name", value: profile.name },
        { label: "type", value: "composition" },
        ...(profile.currentProfile
          ? [{ label: "current", value: profile.currentProfile }]
          : []),
      ]));
      this.printHuman("");

      const runRows = await Promise.all(profile.runs.map(async (run) => {
        const sub = await loader.inspect(paths.profilesDir(), run.profile);
        if (this.isCompositionProfile(sub)) return { profile: run.profile, palette: "", targets: "(nested — unsupported)" };
        const allSubTargets = Object.keys(sub.targets);
        let active = run.targets ? allSubTargets.filter((t) => run.targets!.includes(t)) : allSubTargets;
        if (run.exclude) active = active.filter((t) => !run.exclude!.includes(t));
        return { profile: run.profile, palette: sub.basePalette, targets: active.join("  ") };
      }));

      this.printHuman(this.display.table(runRows, [
        { header: "profile", value: (r) => r.profile },
        { header: "palette", value: (r) => r.palette, dim: true },
        { header: "targets", value: (r) => r.targets, dim: true },
      ]));
      return;
    }

    const sourceDesc = profile.source.type === "seed"
      ? `seed: ${profile.source.color}`
      : `matugen:${profile.source.variant}  ${profile.source.colorsPath}`;

    this.printHuman(this.display.fields([
      { label: "name", value: profile.name },
      { label: "base palette", value: profile.basePalette },
      { label: "mood", value: profile.mood },
      { label: "source", value: sourceDesc, dim: true },
    ]));
    this.printHuman("");
    this.printHuman(this.display.table(
      Object.entries(profile.targets).map(([target, recipe]) => ({ target, recipe })),
      [
        { header: "target", value: (row) => row.target },
        { header: "recipe", value: (row) => row.recipe },
      ],
    ));
  }

  private async validateProfile(name: string | undefined): Promise<void> {
    if (!name) {
      this.printUsageError("Missing profile name.", "profile validate <name>");
      Deno.exit(1);
    }
    const paths = BloomPaths.fromDeno();
    const loader = new ProfileLoader();
    try {
      await loader.inspect(paths.profilesDir(), name);
      if (this.outputMode === "json") {
        this.printJson({ ok: true, command: "profile validate", name });
      } else {
        this.printHuman(`${this.display.dim("✓")} ${name}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.outputMode === "json") {
        this.printJson({ ok: false, command: "profile validate", name, error: { message: msg } });
      } else {
        this.printHuman(`✗ ${name}`);
        this.printHuman(`  ${msg}`);
      }
      Deno.exit(1);
    }
  }

  private async runRecipeCommand(args: string[]): Promise<void> {
    const subcommand = args[0] ?? "list";

    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      this.printRecipeHelp();
      return;
    }

    if (subcommand === "list") {
      await this.listRecipes(args[1]);
      return;
    }

    if (subcommand === "show") {
      await this.showRecipe(args[1]);
      return;
    }

    if (subcommand === "validate") {
      await this.validateRecipes(args[1]);
      return;
    }

    if (subcommand === "inspect") {
      this.printRecipeInspectRedirect();
      Deno.exit(1);
    }

    this.printUnknownCommand(`recipe ${subcommand}`);
    Deno.exit(1);
  }

  private printRecipeHelp(): void {
    this.printHuman(`Recipe commands:
  spore recipe list [target]
  spore recipe show <target/name>
  spore recipe validate <target>`);
  }

  private async validateRecipes(target: string | undefined): Promise<void> {
    if (!target) {
      this.printUsageError("Missing target.", "recipe validate <target>");
      Deno.exit(1);
    }

    const VALID_BLOOM = new Set([
      "surface.base", "surface.dim", "surface.raised", "surface.highest",
      "text.primary", "text.secondary", "text.muted", "text.disabled",
      "accent.primary", "accent.secondary", "accent.tertiary",
      "state.success", "state.warning", "state.danger", "state.info",
      "border.subtle", "border.strong",
      "selection.background", "selection.foreground",
    ]);

    const paths = BloomPaths.fromDeno();
    const loader = new RecipeLoader();
    const id = target.includes("/") ? target : undefined;
    const summaries = id
      ? [await loader.list(paths.recipesDir()).then((all) => all.find((r) => r.id === id)!)].filter(Boolean)
      : await loader.list(paths.recipesDir(), target);

    if (summaries.length === 0) {
      this.printHuman(`No recipes found for: ${target}`);
      Deno.exit(1);
    }

    let anyFailed = false;

    for (const summary of summaries) {
      const recipe = await loader.inspect(paths.recipesDir(), summary.id);
      const bad: string[] = [];

      for (const [name, token] of Object.entries(recipe.tokens)) {
        if ("bloom" in token && !VALID_BLOOM.has(token.bloom)) {
          bad.push(`  ${name}: bloom:${token.bloom}  (unknown token)`);
        }
      }

      if (this.outputMode === "json") continue;

      if (bad.length === 0) {
        this.printHuman(`${this.display.dim("✓")} ${summary.id}`);
      } else {
        anyFailed = true;
        this.printHuman(`✗ ${summary.id}`);
        bad.forEach((line) => this.printHuman(line));
      }
    }

    if (this.outputMode === "json") {
      const results = await Promise.all(summaries.map(async (summary) => {
        const recipe = await loader.inspect(paths.recipesDir(), summary.id);
        const errors = Object.entries(recipe.tokens)
          .filter(([, t]) => "bloom" in t && !VALID_BLOOM.has(t.bloom))
          .map(([name, t]) => ({ token: name, ref: `bloom:${"bloom" in t ? t.bloom : ""}` }));
        return { id: summary.id, ok: errors.length === 0, errors };
      }));
      this.printJson({ ok: results.every((r) => r.ok), results });
      return;
    }

    if (anyFailed) Deno.exit(1);
  }

  private async listRecipes(target: string | undefined): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new RecipeLoader();
    const recipes = await loader.list(paths.recipesDir(), target);

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "recipe list",
        target,
        recipes,
      });
      return;
    }

    this.printHuman(this.display.table(recipes, [
      { header: "id", value: (recipe) => recipe.id },
      {
        header: "base",
        value: (recipe) => recipe.basePalette ?? "(profile)",
        dim: true,
      },
      {
        header: "tokens",
        value: (recipe) => String(recipe.tokenCount),
        align: "right",
      },
      { header: "path", value: (recipe) => recipe.path, dim: true },
    ]));
  }

  private async showRecipe(id: string | undefined): Promise<void> {
    if (!id) {
      this.printUsageError(
        "Missing recipe id.",
        "recipe show <target/name>",
      );
      if (this.outputMode === "human") {
        this.printRecipeHelp();
      }
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const loader = new RecipeLoader();

    if (!id.includes("/")) {
      const recipes = await loader.list(paths.recipesDir(), id);
      if (this.outputMode === "json") {
        this.printJson({
          ok: false,
          error: { message: `Recipe id must look like <target>/<name>. Received: ${id}` },
          hint: recipes.map((r) => r.id),
        });
        Deno.exit(1);
      }
      if (recipes.length === 0) {
        this.printUsageError(
          `No recipes found for target "${id}".`,
          "recipe show <target/name>",
        );
      } else {
        this.printUsageError(
          `Recipe id must include a name. Did you mean one of these?`,
          "recipe show <target/name>",
        );
        this.printHuman("");
        this.printHuman(this.display.table(recipes, [
          { header: "id", value: (r) => r.id },
          { header: "tokens", value: (r) => String(r.tokenCount), align: "right" },
        ]));
      }
      Deno.exit(1);
    }
    const recipe = await loader.inspect(paths.recipesDir(), id);
    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "recipe show",
        recipe,
      });
      return;
    }

    const infoFields: Array<{ label: string; value: string; dim?: boolean }> = [
      { label: "name", value: recipe.name },
      { label: "target", value: recipe.target },
    ];
    if (recipe.basePalette) {
      infoFields.push({ label: "base palette", value: recipe.basePalette, dim: true });
    }
    if (recipe.weights) {
      const w = recipe.weights;
      const parts = (["surface", "foreground", "accent", "semantic"] as const)
        .filter((k) => w[k] !== undefined)
        .map((k) => `${k}: ${w[k]}`);
      if (parts.length > 0) {
        infoFields.push({ label: "weights", value: parts.join("  "), dim: true });
      }
    }
    infoFields.push({
      label: "tokens",
      value: String(Object.keys(recipe.tokens).length),
    });

    this.printHuman(this.display.fields(infoFields));
    this.printHuman("");

    const tokenRows = Object.entries(recipe.tokens).map(([name, token]) => {
      if ("bloom" in token) {
        const mix = token.mix !== undefined ? String(token.mix) : "";
        const src = token.source ? ` + ${token.source}` : "";
        return { name, kind: "bloom", ref: `${token.bloom}${src}`, mix };
      }
      if ("source" in token) {
        return { name, kind: "direct", ref: `${token.source} + ${token.base}`, mix: String(token.mix) };
      }
      return { name, kind: "base", ref: token.base, mix: "" };
    });

    this.printHuman(this.display.table(tokenRows, [
      { header: "token", value: (row) => row.name },
      { header: "kind", value: (row) => row.kind, dim: true },
      { header: "ref", value: (row) => row.ref, dim: true },
      { header: "mix", value: (row) => row.mix, align: "right" },
    ]));
  }

  private async runMoodCommand(args: string[]): Promise<void> {
    const subcommand = args[0] ?? "list";

    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      this.printMoodHelp();
      return;
    }

    if (subcommand === "list") {
      await this.listMoods();
      return;
    }

    if (subcommand === "show") {
      await this.showMood(args[1]);
      return;
    }

    if (subcommand === "validate") {
      await this.validateMood(args[1]);
      return;
    }

    if (subcommand === "inspect") {
      this.printInspectRedirect(
        "mood",
        "mood show <name>",
        "Moods are config definitions — no cache artifact exists.",
      );
      Deno.exit(1);
    }

    this.printUnknownCommand(`mood ${subcommand}`);
    Deno.exit(1);
  }

  private printMoodHelp(): void {
    this.printHuman(`Mood commands:
  spore mood list
  spore mood show <name>
  spore mood validate <name>`);
  }

  private async listMoods(): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new MoodLoader();
    const moods = await loader.list(paths.moodsDir());

    if (this.outputMode === "json") {
      this.printJson({ ok: true, command: "mood list", moods });
      return;
    }

    this.printHuman(this.display.table(moods, [
      { header: "name", value: (mood: MoodSummary) => mood.name },
      {
        header: "surface",
        value: (mood: MoodSummary) => String(mood.weights.surface),
        align: "right",
      },
      {
        header: "foreground",
        value: (mood: MoodSummary) => String(mood.weights.foreground),
        align: "right",
      },
      {
        header: "accent",
        value: (mood: MoodSummary) => String(mood.weights.accent),
        align: "right",
      },
      {
        header: "semantic",
        value: (mood: MoodSummary) => String(mood.weights.semantic),
        align: "right",
      },
      {
        header: "description",
        value: (mood: MoodSummary) => mood.description,
        dim: true,
      },
    ]));
  }

  private async showMood(name: string | undefined): Promise<void> {
    if (!name) {
      this.printUsageError("Missing mood name.", "mood show <name>");
      if (this.outputMode === "human") {
        this.printMoodHelp();
      }
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const loader = new MoodLoader();
    const mood = await loader.inspect(paths.moodsDir(), name);
    const moodPath = `${paths.moodsDir()}/${name}.json`;

    if (this.outputMode === "json") {
      this.printJson({ ok: true, command: "mood show", mood: { ...mood, path: moodPath } });
      return;
    }

    this.printHuman(mood.name);
    if (mood.description) {
      this.printHuman(this.display.dim(`  ${mood.description}`));
    }
    this.printHuman("");
    this.printHuman(this.display.table([
      { key: "surface", value: String(mood.weights.surface) },
      { key: "foreground", value: String(mood.weights.foreground) },
      { key: "accent", value: String(mood.weights.accent) },
      { key: "semantic", value: String(mood.weights.semantic) },
    ], [
      { header: "weight", value: (row: { key: string; value: string }) => row.key },
      { header: "value", value: (row: { key: string; value: string }) => row.value, align: "right" as const },
    ]));
    this.printHuman("");
    this.printHuman(this.display.dim(moodPath));
  }

  private async validateMood(name: string | undefined): Promise<void> {
    if (!name) {
      this.printUsageError("Missing mood name.", "mood validate <name>");
      Deno.exit(1);
    }
    const paths = BloomPaths.fromDeno();
    const loader = new MoodLoader();
    try {
      await loader.inspect(paths.moodsDir(), name);
      if (this.outputMode === "json") {
        this.printJson({ ok: true, command: "mood validate", name });
      } else {
        this.printHuman(`${this.display.dim("✓")} ${name}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.outputMode === "json") {
        this.printJson({ ok: false, command: "mood validate", name, error: { message: msg } });
      } else {
        this.printHuman(`✗ ${name}`);
        this.printHuman(`  ${msg}`);
      }
      Deno.exit(1);
    }
  }

  private async sowProfile(args: string[]): Promise<void> {
    const profileName = args.find((arg) => !arg.startsWith("-"));
    const targetFilter = args.find((arg, index) =>
      index > 0 && !arg.startsWith("-") && args[index - 1] !== "--profile"
    );
    const dryRun = args.includes("--dry-run");

    if (!profileName) {
      this.printUsageError(
        "Missing profile name.",
        "sow <profile> [target] [--dry-run]",
      );
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const profileLoader = new ProfileLoader();
    const profileEntry = await profileLoader.inspect(paths.profilesDir(), profileName);

    if (args.includes("--bloom-osd") && !dryRun) {
      const wpIdx = args.indexOf("--wallpaper");
      const wallpaperPath = wpIdx !== -1 ? args[wpIdx + 1] : undefined;
      await this.notifyBloom("bloom-show", profileName, wallpaperPath);
    }

    if (this.isCompositionProfile(profileEntry)) {
      await this.sowCompositionProfile(profileEntry, args);
      return;
    }

    const profile = profileEntry;
    const targets = Object.entries(profile.targets).filter(([target]) =>
      targetFilter === undefined || target === targetFilter
    );

    if (targets.length === 0 && targetFilter !== undefined) {
      throw new Error(`Target "${targetFilter}" not in profile "${profileName}".`);
    }

    if (!dryRun) {
      const emitter = new EventEmitter(paths.eventsFile(), paths.stateFile());
      await emitter.startRun(profileName, "sow", targets.map(([t]) => t));
      try {
        await this.sowProfileInner(profileName, targetFilter, dryRun, emitter);
        await emitter.finishRun();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await emitter.errorRun(msg);
        throw err;
      }
      return;
    }

    await this.sowProfileInner(profileName, targetFilter, dryRun, undefined);
  }

  private async sowProfileInner(
    profileName: string,
    targetFilter: string | undefined,
    dryRun: boolean,
    emitter: EventEmitter | undefined,
  ): Promise<void> {
    const startedAt = localISOString();
    const context = await this.createBloomContext(profileName);
    const paths = context.paths;
    const writer = new ReportWriter();
    const generatedAt = context.preview.generatedAt;
    const bloomPath = paths.bloomFile(context.profile.name);
    const reportPath = paths.timestampedSowReportFile(
      context.profile.name,
      generatedAt,
    );
    const targets = Object.entries(context.profile.targets).filter(([target]) =>
      targetFilter === undefined || target === targetFilter
    );
    const result = {
      profile: context.profile.name,
      target: targetFilter,
      dryRun,
      basePalette: context.basePalette.slug,
      source: context.sourcePalette.name,
      mood: context.moodName,
      bloomPath,
      reportPath,
      bloom: {
        profile: context.preview.profile,
        generatedAt: context.preview.generatedAt,
        colors: context.preview.colors,
      },
      rows: context.preview.rows,
    };

    if (dryRun) {
      if (this.outputMode === "json") {
        this.printJson({
          ok: true,
          command: "sow",
          result,
        });
        return;
      }

      this.printHuman(this.display.fields([
        {
          label: "Dry run",
          value: targetFilter
            ? `bloom + ${targetFilter} spore for ${context.profile.name}`
            : `bloom for ${context.profile.name}`,
        },
        { label: "base palette", value: context.basePalette.slug },
        { label: "source", value: context.sourcePalette.name },
        { label: "mood", value: context.moodName },
        { label: "would write bloom", value: bloomPath, dim: true },
        { label: "would write report", value: reportPath, dim: true },
      ]));
      this.printHuman("");
      this.printHuman(this.display.table(context.preview.rows, [
        { header: "token", value: (row) => row.path },
        {
          header: "result",
          value: (row) => this.display.colorValue(row.result),
        },
        {
          header: "base",
          value: (row) => `${row.baseKey} ${row.baseHex}`,
          dim: true,
        },
        {
          header: "source",
          value: (row) => `${row.sourceKey} ${row.sourceHex}`,
          dim: true,
        },
        {
          header: "mix",
          value: (row) => String(row.weight),
          align: "right",
        },
      ]));

      return;
    }

    await writer.writeJson(bloomPath, {
      profile: context.preview.profile,
      generatedAt: context.preview.generatedAt,
      colors: context.preview.colors,
    });
    await writer.write(reportPath, {
      target: "bloom",
      profile: context.profile.name,
      recipe: "(bloom)",
      status: "ok",
      inputs: {
        basePalette: context.basePalette.slug,
        source: context.sourcePalette.name,
        mood: context.moodName,
      },
      outputs: [bloomPath],
      warnings: [],
      errors: [],
      startedAt,
      finishedAt: localISOString(),
    });

    const sporeOutputs = await this.sowTargetSpores({
      context,
      targets,
      startedAt,
      emitter,
    });

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "sow",
        result: {
          ...result,
          spores: sporeOutputs,
          outputs: [
            bloomPath,
            reportPath,
            ...sporeOutputs.flatMap((spore) => [
              spore.sporePath,
              spore.reportPath,
            ]),
          ],
        },
      });
      return;
    }

    this.printHuman(`Bloom written: ${this.display.dim(bloomPath)}`);
    this.printHuman(`Report written: ${this.display.dim(reportPath)}`);
    if (sporeOutputs.length > 0) {
      this.printHuman("");
      this.printHuman(this.display.table(sporeOutputs, [
        { header: "target", value: (spore) => spore.target },
        { header: "recipe", value: (spore) => spore.recipe },
        { header: "spore", value: (spore) => spore.sporePath, dim: true },
        { header: "report", value: (spore) => spore.reportPath, dim: true },
      ]));
    }
    this.printHuman("");
    const growArgs = [profileName, targetFilter].filter(Boolean).join(" ");
    this.printHuman(this.display.dim(`  next: spore grow ${growArgs}`));
  }

  private async sowCompositionProfile(
    comp: CompositionProfile,
    args: string[],
  ): Promise<void> {
    const dryRun = args.includes("--dry-run");
    const paths = BloomPaths.fromDeno();
    const runs = await this.expandCompositionRuns(comp, paths);
    const allTargets = runs.flatMap((r) => r.targets.map(([t]) => t));

    if (dryRun) {
      if (this.outputMode === "json") {
        this.printJson({
          ok: true,
          command: "sow",
          profile: comp.name,
          dryRun: true,
          runs: runs.map(({ profile, targets }) => ({
            profile: profile.name,
            targets: targets.map(([t]) => t),
          })),
        });
        return;
      }
      this.printHuman(this.display.fields([{
        label: "Dry run",
        value: `sow composition: ${comp.name}`,
      }]));
      this.printHuman("");
      for (const { profile, targets } of runs) {
        this.printHuman(`  ${profile.name}`);
        for (const [target, recipe] of targets) {
          this.printHuman(`    ${target}  ${this.display.dim(recipe)}`);
        }
      }
      return;
    }

    const emitter = new EventEmitter(paths.eventsFile(), paths.stateFile());
    await emitter.startRun(comp.name, "sow", allTargets);
    try {
      for (const { profile, targets } of runs) {
        const startedAt = localISOString();
        const context = await this.buildBloomContextForProfile(profile, paths);
        await this.sowTargetSpores({ context, targets, startedAt, emitter });
      }
      await emitter.finishRun();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await emitter.errorRun(msg);
      throw err;
    }

    if (this.outputMode === "human") {
      this.printHuman(
        this.display.dim(`  next: spore grow ${comp.name}`),
      );
    }
  }

  private async growCompositionProfile(
    comp: CompositionProfile,
    args: string[],
  ): Promise<void> {
    const dryRun = args.includes("--dry-run");
    const paths = BloomPaths.fromDeno();
    const runs = await this.expandCompositionRuns(comp, paths);
    const allTargets = runs.flatMap((r) => r.targets.map(([t]) => t));
    const renderer = new TemplateRenderer();

    if (!dryRun) {
      const emitter = new EventEmitter(paths.eventsFile(), paths.stateFile());
      await emitter.startRun(comp.name, "grow", allTargets);
      try {
        for (const { profile, targets } of runs) {
          for (const [target] of targets) {
            await emitter.startTarget(target);
            try {
              await renderer.renderToCache(paths, profile.name, target, false);
              await emitter.doneTarget(target);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await emitter.errorTarget(target, msg);
              throw err;
            }
          }
        }
        await emitter.finishRun();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await emitter.errorRun(msg);
        throw err;
      }
    } else {
      for (const { profile, targets } of runs) {
        for (const [target] of targets) {
          await renderer.renderToCache(paths, profile.name, target, true);
        }
      }
    }

    if (this.outputMode === "human" && !dryRun) {
      this.printHuman(
        this.display.dim(`  next: spore plant ${comp.name}`),
      );
    }
  }

  private async plantCompositionProfile(
    comp: CompositionProfile,
    args: string[],
  ): Promise<void> {
    const dryRun = args.includes("--dry-run");
    const paths = BloomPaths.fromDeno();
    const runs = await this.expandCompositionRuns(comp, paths);
    const allTargets = runs.flatMap((r) => r.targets.map(([t]) => t));
    const runner = new HookRunner();

    if (!dryRun) {
      const emitter = new EventEmitter(paths.eventsFile(), paths.stateFile());
      const workerSink: WorkerEventSink = {
        start: (t, w) => emitter.startWorker(t, w),
        progress: (t, w, p) => emitter.progressWorker(t, w, p.current, p.total, p.msg),
        done: (t, w, current, total) => emitter.doneWorker(t, w, current, total),
        error: (t, w, error) => emitter.errorWorker(t, w, error),
      };
      await emitter.startRun(comp.name, "plant", allTargets);
      try {
        for (const { profile, targets } of runs) {
          for (const [target] of targets) {
            await emitter.startTarget(target);
            try {
              const result = await runner.run(paths, profile.name, target, false, workerSink);
              if (!result.hookPath) {
                await emitter.skipTarget(target, "no plant hook");
              } else {
                await emitter.doneTarget(target, result.steps);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await emitter.errorTarget(target, msg);
              throw err;
            }
          }
        }
        await emitter.finishRun();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await emitter.errorRun(msg);
        throw err;
      }
    } else {
      for (const { profile, targets } of runs) {
        for (const [target] of targets) {
          await runner.run(paths, profile.name, target, true);
        }
      }
    }
  }

  private async expandCompositionRuns(
    comp: CompositionProfile,
    paths: BloomPaths,
  ): Promise<Array<{ profile: Profile; targets: Array<[string, string]> }>> {
    const profileLoader = new ProfileLoader();
    const result: Array<{ profile: Profile; targets: Array<[string, string]> }> = [];

    for (const run of comp.runs) {
      const entry = await profileLoader.inspect(paths.profilesDir(), run.profile);
      if (this.isCompositionProfile(entry)) {
        throw new Error(
          `Nested composition profiles are not supported: ${run.profile}`,
        );
      }
      const profile = entry;
      const targets = this.filterRunTargets(profile.targets, run);
      result.push({ profile, targets });
    }

    return result;
  }

  private filterRunTargets(
    profileTargets: Record<string, string>,
    run: CompositionRun,
  ): Array<[string, string]> {
    return Object.entries(profileTargets).filter(([target]) => {
      if (run.targets) return run.targets.includes(target);
      if (run.exclude) return !run.exclude.includes(target);
      return true;
    });
  }

  private async buildBloomContextForProfile(
    profile: Profile,
    paths: BloomPaths,
  ): Promise<BloomContext> {
    const paletteLoader = new PaletteLoader();
    const moodLoader = new MoodLoader();
    const generator = new BloomGenerator();
    const basePalette = await paletteLoader.inspect(paths.palettesDir(), profile.basePalette);
    const sourcePalette = await this.loadSourcePalette(profile);
    const mood = await moodLoader.inspect(paths.moodsDir(), profile.mood);
    const preview = generator.preview(basePalette, sourcePalette, mood, profile.name);
    return { paths, profile, basePalette, sourcePalette, moodName: mood.name, preview };
  }

  private async growProfile(args: string[]): Promise<void> {
    const positional = args.filter((arg) => !arg.startsWith("-"));
    const profileName = positional[0];
    const targetFilter = positional[1];
    const dryRun = args.includes("--dry-run");

    if (!profileName) {
      this.printUsageError(
        "Missing profile name.",
        "grow <profile> [target] [--dry-run]",
      );
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const profileLoader = new ProfileLoader();
    const profileEntry = await profileLoader.inspect(paths.profilesDir(), profileName);

    if (this.isCompositionProfile(profileEntry)) {
      await this.growCompositionProfile(profileEntry, args);
      return;
    }

    const profile = profileEntry;
    const targets = Object.entries(profile.targets).filter(([target]) =>
      targetFilter === undefined || target === targetFilter
    );

    if (targets.length === 0 && targetFilter !== undefined) {
      throw new Error(
        `Target "${targetFilter}" not in profile "${profileName}".`,
      );
    }

    const renderer = new TemplateRenderer();
    const results: Array<{ target: string; outputPath: string; reportPath: string }> = [];

    const emitter = dryRun
      ? undefined
      : new EventEmitter(paths.eventsFile(), paths.stateFile());

    if (emitter) {
      await emitter.startRun(profileName, "grow", targets.map(([t]) => t));
    }

    try {
      for (const [target] of targets) {
        await emitter?.startTarget(target);
        try {
          const { outputPath, reportPath } = await renderer.renderToCache(
            paths,
            profileName,
            target,
            dryRun,
          );
          results.push({ target, outputPath, reportPath });
          await emitter?.doneTarget(target);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await emitter?.errorTarget(target, msg);
          throw err;
        }
      }
      await emitter?.finishRun();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await emitter?.errorRun(msg);
      throw err;
    }

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "grow",
        profile: profileName,
        dryRun,
        results,
      });
      return;
    }

    if (dryRun) {
      this.printHuman(this.display.fields([
        {
          label: "Dry run",
          value: targetFilter
            ? `grow ${targetFilter} for ${profileName}`
            : `grow all targets for ${profileName}`,
        },
      ]));
      this.printHuman("");
      this.printHuman(this.display.table(results, [
        { header: "target", value: (r) => r.target },
        { header: "would write", value: (r) => r.outputPath, dim: true },
      ]));
      return;
    }

    this.printHuman(this.display.table(results, [
      { header: "target", value: (r) => r.target },
      { header: "output", value: (r) => r.outputPath, dim: true },
      { header: "report", value: (r) => r.reportPath, dim: true },
    ]));
    this.printHuman("");
    const plantArgs = [profileName, targetFilter].filter(Boolean).join(" ");
    this.printHuman(this.display.dim(`  next: spore plant ${plantArgs}`));
  }

  private async inspectBloom(profileName: string | undefined): Promise<void> {
    if (!profileName) {
      this.printUsageError("Missing profile name.", "inspect bloom <profile>");
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const bloomPath = paths.bloomFile(profileName);
    const bloom = await this.readJson(bloomPath);

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "inspect bloom",
        profile: profileName,
        bloomPath,
        bloom,
      });
      return;
    }

    const generatedAt =
      bloom !== null && typeof bloom === "object" && "generatedAt" in bloom
        ? String((bloom as { generatedAt: unknown }).generatedAt)
        : undefined;

    const colors =
      bloom !== null && typeof bloom === "object" && "colors" in bloom
        ? (bloom as { colors: Record<string, Record<string, string>> }).colors
        : {};

    const rows: Array<{ path: string; hex: string }> = [];
    for (const [group, tokens] of Object.entries(colors)) {
      for (const [token, hex] of Object.entries(tokens as Record<string, string>)) {
        rows.push({ path: `${group}.${token}`, hex });
      }
    }

    const fields: Array<{ label: string; value: string; dim?: boolean }> = [
      { label: "profile", value: profileName },
      { label: "bloom file", value: bloomPath, dim: true },
    ];
    if (generatedAt) {
      fields.push({ label: "generated", value: generatedAt, dim: true });
    }

    this.printHuman(this.display.fields(fields));
    this.printHuman("");
    this.printHuman(this.display.table(rows, [
      { header: "token", value: (row) => row.path },
      { header: "color", value: (row) => this.display.colorValue(row.hex) },
    ]));
  }

  private async inspectCachedSpore(
    profileName: string | undefined,
    target: string | undefined,
  ): Promise<void> {
    const paths = BloomPaths.fromDeno();

    if (!profileName) {
      this.printUsageError("Missing profile name.", "inspect spore <profile> <target>");
      if (this.outputMode === "human") {
        const profiles = await new ProfileLoader().list(paths.profilesDir());
        if (profiles.length > 0) {
          this.printHumanError("");
          this.printHumanError("Available profiles:");
          for (const p of profiles) {
            this.printHumanError(`  ${p.name}`);
          }
        }
      }
      Deno.exit(1);
    }
    if (!target) {
      this.printUsageError("Missing target.", "inspect spore <profile> <target>");
      if (this.outputMode === "human") {
        try {
          const profile = await new ProfileLoader().inspect(paths.profilesDir(), profileName);
          if (!this.isCompositionProfile(profile)) {
            const targets = Object.keys(profile.targets);
            if (targets.length > 0) {
              this.printHumanError("");
              this.printHumanError(`Targets in ${profileName}:`);
              for (const t of targets) {
                this.printHumanError(`  ${t}`);
              }
            }
          }
        } catch { /* profile not found — skip hint */ }
      }
      Deno.exit(1);
    }

    const sporePath = paths.sporeFile(profileName, target);
    const spore = await this.readJson(sporePath) as Spore;

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "inspect spore",
        profile: profileName,
        target,
        sporePath,
        spore,
      });
      return;
    }

    this.printHuman(this.display.fields([
      { label: "target", value: spore.target },
      { label: "profile", value: spore.profile },
      { label: "recipe", value: spore.recipe },
      { label: "generated", value: spore.generatedAt, dim: true },
      { label: "spore file", value: sporePath, dim: true },
    ]));
    this.printHuman("");
    this.printHuman(this.display.table(
      Object.entries(spore.colors).sort(([a], [b]) =>
        a.localeCompare(b, undefined, { numeric: true })
      ).map(([name, hex]) => ({
        name,
        hex,
      })),
      [
        { header: "token", value: (row) => row.name },
        { header: "color", value: (row) => this.display.colorValue(row.hex) },
      ],
    ));
  }

  private async runTargetsCommand(args: string[]): Promise<void> {
    const target = args.find((a) => !a.startsWith("-"));

    if (!target) {
      await this.listTargets();
      return;
    }

    await this.showTarget(target);
  }

  private async listTargets(): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const targetsDir = paths.recipesDir();
    const recipeLoader = new RecipeLoader();

    const targetNames: string[] = [];
    try {
      for await (const entry of Deno.readDir(targetsDir)) {
        if (entry.isDirectory) targetNames.push(entry.name);
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        throw new Error(`Targets directory not found:\n  ${targetsDir}`);
      }
      throw err;
    }
    targetNames.sort();

    const rows: Array<{ target: string; recipes: number; templates: number; hook: string }> = [];
    for (const name of targetNames) {
      const recipes = await recipeLoader.list(targetsDir, name);
      let templateCount = 0;
      try {
        for await (const entry of Deno.readDir(paths.targetTemplatesDir(name))) {
          if (entry.isFile) templateCount++;
        }
      } catch { /* no templates dir */ }
      let hasHook = false;
      try {
        await Deno.stat(`${targetsDir}/${name}/hooks/plant.json`);
        hasHook = true;
      } catch { /* ok */ }
      rows.push({
        target: name,
        recipes: recipes.length,
        templates: templateCount,
        hook: hasHook ? "yes" : "",
      });
    }

    if (this.outputMode === "json") {
      this.printJson({ ok: true, command: "targets", targets: rows });
      return;
    }

    this.printHuman(this.display.table(rows, [
      { header: "target", value: (r) => r.target },
      { header: "recipes", value: (r) => String(r.recipes), align: "right" },
      { header: "templates", value: (r) => String(r.templates), align: "right" },
      { header: "hook", value: (r) => r.hook, dim: true },
    ]));
  }

  private async showTarget(target: string): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const targetsDir = paths.recipesDir();
    const targetDir = `${targetsDir}/${target}`;

    try {
      await Deno.stat(targetDir);
    } catch {
      throw new Error(`Target "${target}" not found.\n  ${targetDir}`);
    }

    const recipeLoader = new RecipeLoader();
    const recipes = await recipeLoader.list(targetsDir, target);

    const templates: string[] = [];
    try {
      for await (const entry of Deno.readDir(paths.targetTemplatesDir(target))) {
        if (entry.isFile) templates.push(entry.name);
      }
    } catch { /* no templates */ }
    templates.sort();

    const hookPath = `${targetDir}/hooks/plant.json`;
    let hasHook = false;
    try {
      await Deno.stat(hookPath);
      hasHook = true;
    } catch { /* ok */ }

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "targets show",
        target,
        recipes: recipes.map((r) => ({ name: r.name, tokens: r.tokenCount, path: r.path })),
        templates,
        plantHook: hasHook ? hookPath : null,
      });
      return;
    }

    this.printHuman(target);
    this.printHuman("");

    if (recipes.length > 0) {
      this.printHuman(this.display.table(recipes, [
        { header: "recipe", value: (r) => r.name },
        { header: "tokens", value: (r) => String(r.tokenCount), align: "right" },
        { header: "path", value: (r) => r.path, dim: true },
      ]));
      this.printHuman("");
    }

    if (templates.length > 0) {
      this.printHuman("templates");
      for (const t of templates) {
        this.printHuman(`  ${this.display.dim(t)}`);
      }
      this.printHuman("");
    }

    this.printHuman(this.display.fields([
      { label: "plant hook", value: hasHook ? hookPath : "none", dim: !hasHook },
    ]));

    if (recipes.length > 0) {
      this.printHuman("");
      this.printHuman(this.display.dim("To see a recipe:"));
      for (const r of recipes) {
        this.printHuman(this.display.dim(`  spore recipe show ${target}/${r.name}`));
      }
    }
  }

  private async replantTarget(args: string[]): Promise<void> {
    const positional = args.filter((arg) => !arg.startsWith("-"));
    const profileName = positional[0];
    const target = positional[1];
    const recipeName = positional[2];
    const apply = args.includes("--apply");
    const plant = args.includes("--plant");

    if (!profileName || !target || !recipeName) {
      this.printUsageError(
        "Missing arguments.",
        "replant <profile> <target> <recipe> [--apply] [--plant]",
      );
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const profilePath = `${paths.profilesDir()}/${profileName}.json`;

    let raw: string;
    try {
      raw = await Deno.readTextFile(profilePath);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        throw new Error(`Profile not found:\n  ${profilePath}`);
      }
      throw err;
    }

    let profileJson: unknown;
    try {
      profileJson = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in profile:\n  ${profilePath}`);
    }

    if (
      typeof profileJson !== "object" ||
      profileJson === null ||
      !("targets" in profileJson)
    ) {
      throw new Error(`Profile "${profileName}" has no targets field`);
    }

    const targets = (profileJson as Record<string, unknown>)["targets"];
    if (typeof targets !== "object" || targets === null) {
      throw new Error(`Profile "${profileName}" targets field is not an object`);
    }

    if (!(target in (targets as Record<string, unknown>))) {
      const available = Object.keys(targets as Record<string, unknown>).join(", ");
      throw new Error(
        `Target "${target}" not in profile "${profileName}". Available: ${available}`,
      );
    }

    const recipeLoader = new RecipeLoader();
    await recipeLoader.inspect(paths.recipesDir(), `${target}/${recipeName}`);

    const previous = (targets as Record<string, string>)[target];
    (targets as Record<string, string>)[target] = recipeName;
    await Deno.writeTextFile(profilePath, `${JSON.stringify(profileJson, null, 2)}\n`);

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "replant",
        profile: profileName,
        target,
        previous,
        recipe: recipeName,
        apply,
      });
    } else {
      this.printHuman(this.display.fields([
        { label: "profile", value: profileName },
        { label: "target", value: target },
        { label: "recipe", value: `${previous} → ${recipeName}` },
      ]));
    }

    const doApply = apply || plant;

    if (doApply) {
      if (this.outputMode === "human") this.printHuman("");
      await this.sowProfile([profileName, target]);
      await this.growProfile([profileName, target]);
      if (plant) {
        await this.plantProfile([profileName, target]);
      } else if (this.outputMode === "human") {
        this.printHuman(this.display.dim(
          `  next: spore plant ${profileName} ${target}`,
        ));
      }
    } else if (this.outputMode === "human") {
      this.printHuman("");
      this.printHuman(this.display.dim(
        `  next: spore sow ${profileName} ${target}`,
      ));
      this.printHuman(this.display.dim(
        `        spore grow ${profileName} ${target}`,
      ));
      this.printHuman(this.display.dim(
        `        spore plant ${profileName} ${target}`,
      ));
    }
  }

  private async plantProfile(args: string[]): Promise<void> {
    const positional = args.filter((arg) => !arg.startsWith("-"));
    const profileName = positional[0];
    const targetFilter = positional[1];
    const dryRun = args.includes("--dry-run");

    if (!profileName) {
      this.printUsageError(
        "Missing profile name.",
        "plant <profile> [target] [--dry-run]",
      );
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const profileLoader = new ProfileLoader();
    const profileEntry = await profileLoader.inspect(paths.profilesDir(), profileName);

    if (this.isCompositionProfile(profileEntry)) {
      try {
        await this.plantCompositionProfile(profileEntry, args);
      } finally {
        if (args.includes("--bloom-osd") && !dryRun) {
          await this.notifyBloom("bloom-done");
        }
      }
      return;
    }

    const targets = Object.entries(profileEntry.targets).filter(([target]) =>
      targetFilter === undefined || target === targetFilter
    );

    if (targets.length === 0 && targetFilter !== undefined) {
      throw new Error(`Target "${targetFilter}" not in profile "${profileName}".`);
    }

    const runner = new HookRunner();
    const results: Array<{ target: string; hookPath: string | null; steps: Array<{ type: string; ok: boolean; detail: string }> }> = [];

    const emitter = dryRun
      ? undefined
      : new EventEmitter(paths.eventsFile(), paths.stateFile());

    const workerSink: WorkerEventSink | undefined = emitter
      ? {
        start: (t, w) => emitter.startWorker(t, w),
        progress: (t, w, p) => emitter.progressWorker(t, w, p.current, p.total, p.msg),
        done: (t, w, current, total) => emitter.doneWorker(t, w, current, total),
        error: (t, w, error) => emitter.errorWorker(t, w, error),
      }
      : undefined;

    if (emitter) {
      await emitter.startRun(profileName, "plant", targets.map(([t]) => t));
    }

    try {
      for (const [target] of targets) {
        await emitter?.startTarget(target);
        try {
          const result = await runner.run(paths, profileName, target, dryRun, workerSink);
          results.push(result);
          if (!result.hookPath) {
            await emitter?.skipTarget(target, "no plant hook");
          } else {
            await emitter?.doneTarget(target, result.steps);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await emitter?.errorTarget(target, msg);
          throw err;
        }
      }
      await emitter?.finishRun();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await emitter?.errorRun(msg);
      throw err;
    } finally {
      if (args.includes("--bloom-osd") && !dryRun) {
        await this.notifyBloom("bloom-done");
      }
    }

    if (this.outputMode === "json") {
      this.printJson({ ok: true, command: "plant", profile: profileName, dryRun, results });
      return;
    }

    if (dryRun) {
      this.printHuman(this.display.fields([{
        label: "Dry run",
        value: targetFilter
          ? `plant ${targetFilter} for ${profileName}`
          : `plant all targets for ${profileName}`,
      }]));
      this.printHuman("");
    }

    for (const result of results) {
      if (!result.hookPath) {
        this.printHuman(
          `  ${result.target}  ${this.display.dim("no plant hook — skipped")}`,
        );
        continue;
      }
      this.printHuman(`  ${result.target}`);
      for (const step of result.steps) {
        this.printHuman(
          `    ${step.type}  ${this.display.dim(step.detail)}`,
        );
      }
    }
  }

  private async runWorkerCommand(args: string[]): Promise<void> {
    const workerName = args[0];

    if (!workerName) {
      this.printUsageError("Missing worker name.", "worker <name> [args...]");
      Deno.exit(1);
    }

    if (workerName === "run") {
      const name = args[1];
      if (!name) {
        this.printUsageError("Missing worker name.", "worker <name> [args...]");
        Deno.exit(1);
      }
      if (this.outputMode === "human") {
        this.printHuman(this.display.dim("  note: 'worker run <name>' is deprecated — use: worker <name>"));
      }
      await this.runWorker([name, ...args.slice(2)]);
      return;
    }

    await this.runWorker(args);
  }

  private async runWorker(args: string[]): Promise<void> {
    const workerName = args[0];

    if (!workerName) {
      this.printUsageError(
        "Missing worker name.",
        "worker <name> [args...]",
      );
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const candidates = [
      `${paths.cwd}/workers/${workerName}-worker.py`,
      `${paths.cwd}/workers/${workerName}.py`,
    ];

    let workerPath: string | null = null;
    for (const candidate of candidates) {
      try {
        await Deno.stat(candidate);
        workerPath = candidate;
        break;
      } catch { /* try next */ }
    }

    if (!workerPath) {
      throw new Error(
        `Worker "${workerName}" not found. Tried:\n${
          candidates.map((c) => `  ${c}`).join("\n")
        }`,
      );
    }

    const emitter = new EventEmitter(paths.eventsFile(), paths.stateFile());
    await emitter.startRun(workerName, "worker", [workerName]);
    await emitter.startTarget(workerName);
    await emitter.startWorker(workerName, workerName);

    if (this.outputMode === "human") {
      this.printHuman(`  worker  ${this.display.dim(workerPath)}`);
    }

    const runner = new WorkerRunner();
    let lastProgress = 0;
    const workerArgs = args.slice(1);

    const result = await runner.run(
      { command: "python3", args: [workerPath, ...workerArgs] },
      async (progress) => {
        await emitter.progressWorker(
          workerName,
          workerName,
          progress.current,
          progress.total,
          progress.msg,
        );
        if (this.outputMode === "human" && progress.total > 0) {
          const pct = Math.floor((progress.current / progress.total) * 100);
          if (pct !== lastProgress) {
            lastProgress = pct;
            const encoder = new TextEncoder();
            await Deno.stdout.write(
              encoder.encode(`\r  ${pct}%  ${progress.current}/${progress.total}  ${progress.msg}   `),
            );
          }
        }
      },
    );

    if (this.outputMode === "human" && result.ok) {
      await Deno.stdout.write(new TextEncoder().encode("\r"));
    }

    if (result.ok) {
      await emitter.doneWorker(workerName, workerName, 0, 0);
      await emitter.doneTarget(workerName);
      await emitter.finishRun();
    } else {
      await emitter.errorWorker(workerName, workerName, result.stderr);
      await emitter.errorTarget(workerName, result.stderr);
      await emitter.errorRun(result.stderr);
    }

    if (this.outputMode === "json") {
      this.printJson({
        ok: result.ok,
        command: "worker",
        worker: workerName,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      return;
    }

    if (!result.ok) {
      throw new Error(
        `Worker "${workerName}" failed (exit ${result.exitCode}):\n${result.stderr}`,
      );
    }

    this.printHuman(this.display.fields([
      { label: "worker", value: workerName },
      { label: "duration", value: `${result.durationMs}ms` },
      { label: "exit", value: String(result.exitCode) },
    ]));

    if (result.stdout) {
      this.printHuman("");
      this.printHuman(this.display.dim(result.stdout));
    }
  }

  private async runPruneCommand(args: string[]): Promise<void> {
    const dryRun = args.includes("--dry-run");
    const includeRendered = args.includes("--rendered") || args.includes("--all");
    const includeWorkingCache = args.includes("--all");

    const keepIdx = args.indexOf("--keep");
    const keep = keepIdx !== -1 ? parseInt(args[keepIdx + 1] ?? "0", 10) : 0;

    const paths = BloomPaths.fromDeno();

    type PruneResult = { label: string; deleted: number; bytes: number; skipped: number };
    const results: PruneResult[] = [];

    // --- reports ---
    const reportFiles = await this.listSortedFiles(paths.reportsDir());
    const toDelete = keep > 0 ? reportFiles.slice(0, Math.max(0, reportFiles.length - keep)) : reportFiles;
    let reportBytes = 0;
    for (const f of toDelete) {
      reportBytes += f.size;
      if (!dryRun) await Deno.remove(f.path);
    }
    results.push({ label: "reports", deleted: toDelete.length, bytes: reportBytes, skipped: reportFiles.length - toDelete.length });

    // --- events.jsonl ---
    let eventsBytes = 0;
    try {
      eventsBytes = (await Deno.stat(paths.eventsFile())).size;
      if (!dryRun) await Deno.writeTextFile(paths.eventsFile(), "");
    } catch { /* file may not exist */ }
    results.push({ label: "events", deleted: eventsBytes > 0 ? 1 : 0, bytes: eventsBytes, skipped: 0 });

    // --- rendered/ ---
    if (includeRendered) {
      const renderedRoot = `${paths.cacheDir}/rendered`;
      const renderedFiles = await this.listSortedFiles(renderedRoot, true);
      let renderedBytes = 0;
      for (const f of renderedFiles) renderedBytes += f.size;
      if (!dryRun && renderedFiles.length > 0) await Deno.remove(renderedRoot, { recursive: true });
      results.push({ label: "rendered", deleted: renderedFiles.length, bytes: renderedBytes, skipped: 0 });
    }

    // --- blooms/ + spores/ ---
    if (includeWorkingCache) {
      for (const [label, dir] of [["blooms", paths.bloomsDir()], ["spores", paths.sporesDir()]] as const) {
        const files = await this.listSortedFiles(dir, true);
        let bytes = 0;
        for (const f of files) bytes += f.size;
        if (!dryRun && files.length > 0) await Deno.remove(dir, { recursive: true });
        results.push({ label, deleted: files.length, bytes, skipped: 0 });
      }
    }

    if (this.outputMode === "json") {
      this.printJson({ ok: true, command: "prune", dryRun, keep, results });
      return;
    }

    const fmtBytes = (b: number) => b < 1024 * 1024
      ? `${(b / 1024).toFixed(0)} KB`
      : `${(b / (1024 * 1024)).toFixed(1)} MB`;

    const verb = dryRun ? "would remove" : "removed";
    for (const r of results) {
      if (r.label === "events") {
        if (r.bytes === 0) {
          this.printHuman(`  ${r.label}  ${this.display.dim("empty")}`);
        } else {
          this.printHuman(`  ${r.label}  ${dryRun ? "would truncate" : "truncated"}  ${this.display.dim(fmtBytes(r.bytes))}`);
        }
      } else if (r.deleted === 0) {
        this.printHuman(`  ${r.label}  ${this.display.dim("nothing to prune")}`);
      } else {
        const kept = r.skipped > 0 ? `  ${this.display.dim(`kept ${r.skipped}`)}` : "";
        this.printHuman(`  ${r.label}  ${verb} ${r.deleted} files  ${this.display.dim(fmtBytes(r.bytes))}${kept}`);
      }
    }

    if (includeRendered && !dryRun) {
      this.printHuman(this.display.dim("\n  rendered cache cleared — run grow before next plant"));
    }
    if (includeWorkingCache && !dryRun) {
      this.printHuman(this.display.dim("  working cache cleared — run sow + grow before next plant"));
    }
  }

  private async listSortedFiles(
    dir: string,
    recursive = false,
  ): Promise<Array<{ path: string; name: string; size: number }>> {
    const files: Array<{ path: string; name: string; size: number }> = [];
    try {
      for await (const entry of Deno.readDir(dir)) {
        const full = `${dir}/${entry.name}`;
        if (entry.isFile) {
          const stat = await Deno.stat(full);
          files.push({ path: full, name: entry.name, size: stat.size });
        } else if (recursive && entry.isDirectory) {
          files.push(...await this.listSortedFiles(full, true));
        }
      }
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  }

  private printUnknownCommand(command: string): void {
    if (this.outputMode === "json") {
      this.printJson({
        ok: false,
        error: {
          message: `Unknown command: ${command}`,
          usage: "spore --help",
        },
      });
      return;
    }

    this.printHumanError(`Unknown command: ${command}`);
    this.printHumanError("");
    this.printHumanError("Run: spore --help");
  }

  private printUsageError(message: string, usage: string): void {
    if (this.outputMode === "json") {
      this.printJson({
        ok: false,
        error: {
          message,
          usage,
        },
      });
      return;
    }

    this.printHumanError(message);
    this.printHumanError("");
    this.printHumanError("Usage:");
    this.printHumanError(`  ${usage}`);
  }

  private printHuman(message: string): void {
    console.log(this.display.formatText(message));
  }

  private printHumanError(message: string): void {
    console.error(this.display.formatText(message));
  }

  private printJson(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  private async createBloomContext(profileName: string): Promise<BloomContext> {
    const paths = BloomPaths.fromDeno();
    const profileLoader = new ProfileLoader();
    const paletteLoader = new PaletteLoader();
    const moodLoader = new MoodLoader();
    const generator = new BloomGenerator();
    const profileEntry = await profileLoader.inspect(
      paths.profilesDir(),
      profileName,
    );

    if (this.isCompositionProfile(profileEntry)) {
      throw new Error(
        `createBloomContext requires a plain profile, not a composition:\n  ${profileName}`,
      );
    }

    const profile = profileEntry;
    const basePalette = await paletteLoader.inspect(
      paths.palettesDir(),
      profile.basePalette,
    );
    const sourcePalette = await this.loadSourcePalette(profile);
    const mood = await moodLoader.inspect(paths.moodsDir(), profile.mood);
    const preview = generator.preview(
      basePalette,
      sourcePalette,
      mood,
      profile.name,
    );

    return {
      paths,
      profile,
      basePalette,
      sourcePalette,
      moodName: mood.name,
      preview,
    };
  }

  private async sowTargetSpores(options: {
    readonly context: BloomContext;
    readonly targets: Array<[string, string]>;
    readonly startedAt: string;
    readonly emitter?: EventEmitter;
  }): Promise<SownSporeResult[]> {
    const { context, targets, startedAt, emitter } = options;

    const recipeLoader = new RecipeLoader();
    const generator = new SporeGenerator();
    const writer = new ReportWriter();
    const results: SownSporeResult[] = [];

    for (const [target, recipeName] of targets) {
      await emitter?.startTarget(target);
      try {
        const recipe = await recipeLoader.inspect(
          context.paths.recipesDir(),
          `${target}/${recipeName}`,
        );
        const targetBasePalette = await this.loadRecipeBasePalette(
          context.paths,
          context.profile,
          recipe,
        );
        const generatedAt = localISOString();
        const spore = generator.generate(
          targetBasePalette,
          context.sourcePalette,
          {
            profile: context.preview.profile,
            generatedAt: context.preview.generatedAt,
            colors: context.preview.colors,
          },
          recipe,
          context.profile.name,
          generatedAt,
        );
        const sporePath = context.paths.sporeFile(context.profile.name, target);
        const reportPath = context.paths.timestampedTargetSowReportFile(
          context.profile.name,
          target,
          generatedAt,
        );

        await writer.writeJson(sporePath, spore);
        await writer.write(reportPath, {
          target,
          profile: context.profile.name,
          recipe: recipe.name,
          status: "ok",
          inputs: {
            basePalette: targetBasePalette.slug,
            source: context.sourcePalette.name,
            mood: context.moodName,
            bloomGeneratedAt: context.preview.generatedAt,
          },
          outputs: [sporePath],
          warnings: [],
          errors: [],
          startedAt,
          finishedAt: localISOString(),
        });

        results.push({
          target,
          recipe: recipe.name,
          sporePath,
          reportPath,
          spore,
        });
        await emitter?.doneTarget(target);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await emitter?.errorTarget(target, msg);
        throw err;
      }
    }

    return results;
  }

  private async loadRecipeBasePalette(
    paths: BloomPaths,
    profile: Profile,
    recipe: Recipe,
  ): Promise<Palette> {
    const paletteLoader = new PaletteLoader();
    return await paletteLoader.inspect(
      paths.palettesDir(),
      recipe.basePalette ?? profile.basePalette,
    );
  }

  private async loadSourcePalette(profile: Profile): Promise<Palette> {
    if (profile.source.type === "seed") {
      return this.seedSourcePalette(profile.source.color);
    }

    return await this.loadMatugenSourcePalette(profile.source);
  }

  private seedSourcePalette(color: string): Palette {
    return {
      name: "seed",
      slug: "seed",
      kind: "dark",
      colors: {
        background: color,
        surface: color,
        surface_container_high: color,
        surface_container_highest: color,
        on_surface: color,
        on_surface_variant: color,
        outline: color,
        outline_variant: color,
        primary: color,
        secondary: color,
        tertiary: color,
        error: color,
        secondary_container: color,
        on_secondary_container: color,
      },
    };
  }

  private async loadMatugenSourcePalette(
    source: MatugenSource,
  ): Promise<Palette> {
    const path = this.expandHome(source.colorsPath);
    const raw = await this.readJson(path) as {
      colors?: Record<string, Record<string, { color?: unknown }>>;
      base16?: Record<string, Record<string, { color?: unknown }>>;
    };
    const colors: Record<string, string> = {};

    for (const [name, variants] of Object.entries(raw.colors ?? {})) {
      const color = variants[source.variant]?.color;
      if (typeof color === "string") {
        colors[name] = color;
      }
    }

    for (const [name, variants] of Object.entries(raw.base16 ?? {})) {
      const color = variants[source.variant]?.color;
      if (typeof color === "string") {
        colors[name] = color;
      }
    }

    return {
      name: `matugen:${source.variant}`,
      slug: "matugen",
      kind: source.variant === "light" ? "light" : "dark",
      colors,
    };
  }

  private async readJson(path: string): Promise<unknown> {
    let text: string;

    try {
      text = await Deno.readTextFile(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`File not found:\n  ${path}`);
      }

      throw error;
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON in:\n  ${path}`);
    }
  }

  private expandHome(path: string): string {
    const home = Deno.env.get("HOME") ?? "";
    return path.replace(/^~(?=\/|$)/, home);
  }

  private async notifyBloom(
    subcommand: string,
    profile?: string,
    wallpaper?: string,
  ): Promise<void> {
    const home = Deno.env.get("HOME") ?? "";
    const configPath = `${home}/.config/unclaimed-bloom/notify.json`;
    let cmd: string[];
    try {
      const text = await Deno.readTextFile(configPath);
      const config = JSON.parse(text);
      if (!Array.isArray(config.cmd) || config.cmd.length === 0) return;
      cmd = config.cmd as string[];
    } catch {
      return;
    }
    const finalArgs: string[] = profile ? [subcommand, profile] : [subcommand];
    if (wallpaper) finalArgs.push("--wallpaper", wallpaper);
    try {
      const proc = new Deno.Command(cmd[0], {
        args: [...cmd.slice(1), ...finalArgs],
        stdout: "null",
        stderr: "null",
      });
      await proc.output();
    } catch {
      // notification failures are non-fatal
    }
  }

  private isCompositionProfile(
    profile: ProfileEntry,
  ): profile is CompositionProfile {
    return "type" in profile && profile.type === "composition";
  }
}

const cli = new SporeCli();

try {
  await cli.run(Deno.args);
} catch (error) {
  cli.printFatalError(error);
  Deno.exit(1);
}
