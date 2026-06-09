import { HumanDisplay } from "./HumanDisplay.ts";
import {
  BloomGenerator,
  type BloomPreview,
} from "../core/blooms/BloomGenerator.ts";
import { MoodLoader } from "../core/moods/MoodLoader.ts";
import { BloomPaths } from "../core/paths/BloomPaths.ts";
import { type Palette, PaletteLoader } from "../core/palettes/PaletteLoader.ts";
import {
  type CompositionProfile,
  type MatugenSource,
  type Profile,
  type ProfileEntry,
  ProfileLoader,
} from "../core/profiles/ProfileLoader.ts";
import { type Recipe, RecipeLoader } from "../core/recipes/RecipeLoader.ts";
import { ReportWriter } from "../core/reports/ReportWriter.ts";
import { type Spore, SporeGenerator } from "../core/spores/SporeGenerator.ts";

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
      this.printGrowReserved(commandArgs.slice(1));
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
  grow      Reserved for applying cached spores later.
  inspect   Inspect generated bloom or target spore.
  palette   List or inspect palettes.
  profile   List or inspect profiles.
  recipe    List or inspect recipes.

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
      targetFilter,
      startedAt,
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

    this.printHuman(JSON.stringify(profile, null, 2));
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

    this.printUnknownCommand(`recipe ${subcommand}`);
    Deno.exit(1);
  }

  private printRecipeHelp(): void {
    this.printHuman(`Recipe commands:
  deno task spore:dev -- recipe list [target]
  deno task spore:dev -- recipe inspect <target/name>`);
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
    const recipe = await loader.inspect(paths.recipesDir(), id);
    if (this.outputMode === "json") {
      this.printJson({
        ok: true,
        command: "recipe inspect",
        recipe,
      });
      return;
    }

    this.printHuman(JSON.stringify(recipe, null, 2));
  }

  private printGrowReserved(args: string[]): void {
    const profile = args.find((arg) => !arg.startsWith("-")) ?? "daily";
    const target = args.find((arg, index) => index > 0 && !arg.startsWith("-"));

    if (this.outputMode === "json") {
      this.printJson({
        ok: false,
        error: {
          message: "Deno grow is reserved for applying cached spores later.",
          usage: "deno task spore:dev -- sow <profile> [target]",
          profile,
          target,
        },
      });
      Deno.exit(1);
    }

    this.printHumanError(
      "Deno grow is reserved for applying cached spores later.",
    );
    this.printHumanError("");
    this.printHumanError("Cache generation is:");
    this.printHumanError(
      `  deno task spore:dev -- sow ${profile}${target ? ` ${target}` : ""}`,
    );
    Deno.exit(1);
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

    this.printHuman(this.display.fields([
      { label: "profile", value: profileName },
      { label: "bloom file", value: bloomPath, dim: true },
    ]));
    this.printHuman("");
    this.printHuman(JSON.stringify(bloom, null, 2));
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
        `Deno sow does not handle composition profiles yet:\n  ${profileName}`,
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
    readonly targetFilter?: string;
    readonly startedAt: string;
  }): Promise<SownSporeResult[]> {
    const { context, targetFilter, startedAt } = options;
    const targets = Object.entries(context.profile.targets).filter(([target]) =>
      targetFilter === undefined || target === targetFilter
    );

    if (targets.length === 0 && targetFilter !== undefined) {
      throw new Error(
        `Target "${targetFilter}" not in profile "${context.profile.name}".`,
      );
    }

    const recipeLoader = new RecipeLoader();
    const generator = new SporeGenerator();
    const writer = new ReportWriter();
    const results: SownSporeResult[] = [];

    for (const [target, recipeName] of targets) {
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
