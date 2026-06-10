import { HumanDisplay } from "./HumanDisplay.ts";
import {
  BloomGenerator,
  type BloomPreview,
} from "../core/blooms/BloomGenerator.ts";
import { EventEmitter } from "../core/events/EventEmitter.ts";
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
      this.printStatus();
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

    if (command === "inspect") {
      await this.inspectProfileOrTarget(commandArgs.slice(1));
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

    if (command === "replant") {
      await this.replantTarget(commandArgs.slice(1));
      return;
    }

    if (command === "plant") {
      await this.plantProfile(commandArgs.slice(1));
      return;
    }

    if (command === "worker") {
      await this.runWorkerCommand(commandArgs.slice(1));
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

Experimental Deno CLI for Unclaimed Bloom.

Usage:
  deno task spore:dev -- --help
  deno task spore:dev -- --json status
  deno task spore:dev -- version
  deno task spore:dev -- status

Commands:
  help      Show this help.
  version   Show the experimental CLI version.
  status    Show detected runtime paths and environment overrides.
  sow       Generate bloom and spores into cache.
  grow      Render cached spores into target config files (cache only).
  inspect   Inspect generated bloom or target spore.
  palette   List or inspect palettes.
  profile   List or inspect profiles.
  recipe    List or inspect recipes.
  mood      List moods.
  replant   Change a target's recipe in a profile.
  plant     Deploy rendered files to real config paths via hooks.
  worker    Run a Python worker. Subcommands: run <name>

Global flags:
  --json          Print machine-readable JSON.
  --format json  Same as --json.`);
  }

  private printStatus(): void {
    const paths = BloomPaths.fromDeno().summary();

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        status: paths,
      });
      return;
    }

    this.printHuman("Unclaimed Bloom Deno experiment status");
    this.printHuman("");
    this.printHuman(this.display.table([
      { key: "cwd", value: paths.cwd },
      {
        key: "UB_DATA_DIR",
        value: paths.dataDirSource === "env" ? paths.dataDir : "(not set)",
      },
      {
        key: "UB_CACHE_DIR",
        value: paths.cacheDirSource === "env" ? paths.cacheDir : "(not set)",
      },
      { key: "resolved data dir", value: paths.dataDir },
      { key: "resolved cache dir", value: paths.cacheDir },
      { key: "default data dir", value: paths.defaultDataDir },
      { key: "default cache dir", value: paths.defaultCacheDir },
    ], [
      { header: "key", value: (row) => row.key },
      {
        header: "value",
        value: (row) => row.value,
        dim: true,
      },
    ]));
  }

  private async runPaletteCommand(args: string[]): Promise<void> {
    const subcommand = args[0] ?? "help";

    if (
      subcommand === "help" || subcommand === "--help" || subcommand === "-h"
    ) {
      this.printPaletteHelp();
      return;
    }

    if (subcommand === "list") {
      await this.listPalettes();
      return;
    }

    if (subcommand === "inspect") {
      await this.inspectPalette(args[1]);
      return;
    }

    this.printUnknownCommand(`palette ${subcommand}`);
    Deno.exit(1);
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
        "deno task spore:dev -- sow <profile> [target] [--dry-run]",
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
    const startedAt = new Date().toISOString();
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
      finishedAt: new Date().toISOString(),
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
    this.printHuman(this.display.dim(`  next: deno task spore:dev -- grow ${growArgs}`));
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
        const startedAt = new Date().toISOString();
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
        this.display.dim(`  next: deno task spore:dev -- grow ${comp.name}`),
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
        this.display.dim(
          `  next: deno task spore:dev -- plant ${comp.name}`,
        ),
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
                await emitter.doneTarget(target);
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

  private printPaletteHelp(): void {
    this.printHuman(`Palette commands:
  deno task spore:dev -- palette list
  deno task spore:dev -- palette inspect <slug>`);
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

  private async inspectPalette(slug: string | undefined): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new PaletteLoader();

    if (!slug) {
      this.printUsageError("Missing palette slug.", "palette inspect <slug>");
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
        command: "palette inspect",
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

  private async runProfileCommand(args: string[]): Promise<void> {
    const subcommand = args[0] ?? "help";

    if (
      subcommand === "help" || subcommand === "--help" || subcommand === "-h"
    ) {
      this.printProfileHelp();
      return;
    }

    if (subcommand === "list") {
      await this.listProfiles();
      return;
    }

    if (subcommand === "inspect") {
      await this.inspectProfile(args[1]);
      return;
    }

    this.printUnknownCommand(`profile ${subcommand}`);
    Deno.exit(1);
  }

  private printProfileHelp(): void {
    this.printHuman(`Profile commands:
  deno task spore:dev -- profile list
  deno task spore:dev -- profile inspect <name>`);
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

  private async inspectProfile(name: string | undefined): Promise<void> {
    if (!name) {
      this.printUsageError("Missing profile name.", "profile inspect <name>");
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
        command: "profile inspect",
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
      this.printHuman(this.display.table(profile.runs, [
        { header: "profile", value: (run) => run.profile },
        {
          header: "targets",
          value: (run) => run.targets?.join(", ") ?? "(all)",
          dim: true,
        },
        {
          header: "exclude",
          value: (run) => run.exclude?.join(", ") ?? "",
          dim: true,
        },
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

  private async runRecipeCommand(args: string[]): Promise<void> {
    const subcommand = args[0] ?? "help";

    if (
      subcommand === "help" || subcommand === "--help" || subcommand === "-h"
    ) {
      this.printRecipeHelp();
      return;
    }

    if (subcommand === "list") {
      await this.listRecipes(args[1]);
      return;
    }

    if (subcommand === "inspect") {
      await this.inspectRecipe(args[1]);
      return;
    }

    if (subcommand === "validate") {
      await this.validateRecipes(args[1]);
      return;
    }

    this.printUnknownCommand(`recipe ${subcommand}`);
    Deno.exit(1);
  }

  private printRecipeHelp(): void {
    this.printHuman(`Recipe commands:
  deno task dev -- recipe list [target]
  deno task dev -- recipe inspect <target/name>
  deno task dev -- recipe validate <target>`);
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

  private async inspectRecipe(id: string | undefined): Promise<void> {
    if (!id) {
      this.printUsageError(
        "Missing recipe id.",
        "recipe inspect <target/name>",
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
          "recipe inspect <target/name>",
        );
      } else {
        this.printUsageError(
          `Recipe id must include a name. Did you mean one of these?`,
          "recipe inspect <target/name>",
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
        command: "recipe inspect",
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

  private async growProfile(args: string[]): Promise<void> {
    const positional = args.filter((arg) => !arg.startsWith("-"));
    const profileName = positional[0];
    const targetFilter = positional[1];
    const dryRun = args.includes("--dry-run");

    if (!profileName) {
      this.printUsageError(
        "Missing profile name.",
        "deno task spore:dev -- grow <profile> [target] [--dry-run]",
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
    this.printHuman(this.display.dim(`  next: deno task spore:dev -- plant ${plantArgs}`));
  }

  private async inspectProfileOrTarget(args: string[]): Promise<void> {
    const profileName = args[0] ?? "daily";
    const target = args[1];

    if (target) {
      await this.inspectCachedSpore(profileName, target);
      return;
    }

    await this.inspectBloom(profileName);
  }

  private async inspectBloom(profileName: string): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const bloomPath = paths.bloomFile(profileName);
    const bloom = await this.readJson(bloomPath);

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "inspect",
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
    profileName: string,
    target: string,
  ): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const sporePath = paths.sporeFile(profileName, target);
    const spore = await this.readJson(sporePath) as Spore;

    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "inspect",
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

  private async runMoodCommand(args: string[]): Promise<void> {
    const subcommand = args[0] ?? "list";

    if (subcommand === "list") {
      await this.listMoods();
      return;
    }

    this.printUnknownCommand(`mood ${subcommand}`);
    Deno.exit(1);
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
        "deno task spore:dev -- replant <profile> <target> <recipe> [--apply] [--plant]",
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
          `  next: deno task spore:dev -- plant ${profileName} ${target}`,
        ));
      }
    } else if (this.outputMode === "human") {
      this.printHuman("");
      this.printHuman(this.display.dim(
        `  next: deno task spore:dev -- sow ${profileName} ${target}`,
      ));
      this.printHuman(this.display.dim(
        `        deno task spore:dev -- grow ${profileName} ${target}`,
      ));
      this.printHuman(this.display.dim(
        `        deno task spore:dev -- plant ${profileName} ${target}`,
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
        "deno task spore:dev -- plant <profile> [target] [--dry-run]",
      );
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const profileLoader = new ProfileLoader();
    const profileEntry = await profileLoader.inspect(paths.profilesDir(), profileName);

    if (this.isCompositionProfile(profileEntry)) {
      await this.plantCompositionProfile(profileEntry, args);
      if (args.includes("--bloom-osd") && !dryRun) {
        await this.notifyBloom("bloom-done");
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
            await emitter?.doneTarget(target);
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
    }

    if (args.includes("--bloom-osd") && !dryRun) {
      await this.notifyBloom("bloom-done");
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
    const subcommand = args[0];

    if (subcommand === "run") {
      await this.runWorker(args.slice(1));
      return;
    }

    this.printUsageError(
      subcommand ? `Unknown worker subcommand: ${subcommand}` : "Missing subcommand.",
      "deno task spore:dev -- worker run <name>",
    );
    Deno.exit(1);
  }

  private async runWorker(args: string[]): Promise<void> {
    const workerName = args[0];

    if (!workerName) {
      this.printUsageError(
        "Missing worker name.",
        "deno task spore:dev -- worker run <name>",
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
        command: "worker run",
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

  private printUnknownCommand(command: string): void {
    if (this.outputMode === "json") {
      this.printJson({
        ok: false,
        error: {
          message: `Unknown command: ${command}`,
          usage: "deno task spore:dev -- --help",
        },
      });
      return;
    }

    this.printHumanError(`Unknown command: ${command}`);
    this.printHumanError("");
    this.printHumanError("Run:");
    this.printHumanError("  deno task spore:dev -- --help");
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
        const generatedAt = new Date().toISOString();
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
          finishedAt: new Date().toISOString(),
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
