import { BloomGenerator } from "../core/blooms/BloomGenerator.ts";
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
import { RecipeLoader } from "../core/recipes/RecipeLoader.ts";
import { ReportWriter } from "../core/reports/ReportWriter.ts";

const VERSION = "0.1.0-deno-experiment";

class SporeCli {
  public async run(args: string[]): Promise<void> {
    const commandArgs = args[0] === "--" ? args.slice(1) : args;
    const command = commandArgs[0] ?? "--help";

    if (command === "--help" || command === "-h" || command === "help") {
      this.printHelp();
      return;
    }

    if (command === "--version" || command === "-v" || command === "version") {
      console.log(`spore ${VERSION}`);
      return;
    }

    if (command === "status") {
      this.printStatus();
      return;
    }

    if (command === "grow") {
      await this.growProfile(commandArgs.slice(1));
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

  private printHelp(): void {
    console.log(`spore ${VERSION}

Experimental Deno CLI for Unclaimed Bloom.

Usage:
  deno task spore:dev -- --help
  deno task spore:dev -- version
  deno task spore:dev -- status

Commands:
  help      Show this help.
  version   Show the experimental CLI version.
  status    Show detected runtime paths and environment overrides.
  grow      Generate a bloom into cache.
  palette   List or inspect palettes.
  profile   List or inspect profiles.
  recipe    List or inspect recipes.`);
  }

  private printStatus(): void {
    const paths = BloomPaths.fromDeno().summary();

    console.log(`Unclaimed Bloom Deno experiment status

cwd:
  ${paths.cwd}

UB_DATA_DIR:
  ${paths.dataDirSource === "env" ? paths.dataDir : "(not set)"}

UB_CACHE_DIR:
  ${paths.cacheDirSource === "env" ? paths.cacheDir : "(not set)"}

resolved data dir:
  ${paths.dataDir}

resolved cache dir:
  ${paths.cacheDir}

default data dir:
  ${paths.defaultDataDir}

default cache dir:
  ${paths.defaultCacheDir}`);
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

  private async growProfile(args: string[]): Promise<void> {
    const profileName = args.find((arg) => !arg.startsWith("-"));
    const dryRun = args.includes("--dry-run");

    if (!profileName) {
      console.error("Missing profile name.");
      console.error("");
      console.error("Usage:");
      console.error("  deno task spore:dev -- grow <profile> [--dry-run]");
      Deno.exit(1);
    }

    const startedAt = new Date().toISOString();
    const paths = BloomPaths.fromDeno();
    const profileLoader = new ProfileLoader();
    const paletteLoader = new PaletteLoader();
    const moodLoader = new MoodLoader();
    const generator = new BloomGenerator();
    const writer = new ReportWriter();
    const profileEntry = await profileLoader.inspect(
      paths.profilesDir(),
      profileName,
    );

    if (this.isCompositionProfile(profileEntry)) {
      throw new Error(
        `Deno grow does not handle composition profiles yet:\n  ${profileName}`,
      );
    }

    const profile = profileEntry;
    const basePalette = await paletteLoader.inspect(
      paths.palettesDir(),
      profile.basePalette,
    );
    const sourcePalette = await this.loadSourcePalette(profile);
    const mood = await moodLoader.inspect(paths.moodsDir(), profile.mood);
    const generatedAt = new Date().toISOString();
    const preview = generator.preview(
      basePalette,
      sourcePalette,
      mood,
      profile.name,
      generatedAt,
    );
    const bloomPath = paths.bloomFile(profile.name);
    const reportPath = paths.timestampedGrowReportFile(
      profile.name,
      generatedAt,
    );

    if (dryRun) {
      console.log(`Dry run: bloom for ${profile.name}`);
      console.log(`base palette: ${basePalette.slug}`);
      console.log(`source: ${sourcePalette.name}`);
      console.log(`mood: ${mood.name}`);
      console.log(`would write bloom: ${bloomPath}`);
      console.log(`would write report: ${reportPath}`);
      console.log("");

      for (const row of preview.rows) {
        console.log(
          `  ${
            row.path.padEnd(22)
          } ${row.result}  base:${row.baseKey} ${row.baseHex} source:${row.sourceKey} ${row.sourceHex} mix:${row.weight}`,
        );
      }

      return;
    }

    await writer.writeJson(bloomPath, {
      profile: preview.profile,
      generatedAt: preview.generatedAt,
      colors: preview.colors,
    });
    await writer.write(reportPath, {
      target: "bloom",
      profile: profile.name,
      recipe: "(bloom)",
      status: "ok",
      inputs: {
        basePalette: basePalette.slug,
        source: sourcePalette.name,
        mood: mood.name,
      },
      outputs: [bloomPath],
      warnings: [],
      errors: [],
      startedAt,
      finishedAt: new Date().toISOString(),
    });

    console.log(`Bloom written: ${bloomPath}`);
    console.log(`Report written: ${reportPath}`);
  }

  private printPaletteHelp(): void {
    console.log(`Palette commands:
  deno task spore:dev -- palette list
  deno task spore:dev -- palette inspect <slug>`);
  }

  private async listPalettes(): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new PaletteLoader();
    const palettes = await loader.list(paths.palettesDir());

    for (const palette of palettes) {
      console.log(
        `  ${palette.slug.padEnd(28)} ${
          palette.kind.padEnd(6)
        } ${palette.name}  ${palette.colorCount} colors`,
      );
    }
  }

  private async inspectPalette(slug: string | undefined): Promise<void> {
    if (!slug) {
      console.error("Missing palette slug.");
      console.error("");
      this.printPaletteHelp();
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const loader = new PaletteLoader();
    const palette = await loader.inspect(paths.palettesDir(), slug);

    console.log(`${palette.name} (${palette.slug})`);
    console.log(`kind: ${palette.kind}`);
    if (palette.source) {
      console.log(`source: ${palette.source}`);
    }
    console.log(`colors: ${Object.keys(palette.colors).length}`);
    console.log("");

    for (const [name, hex] of Object.entries(palette.colors).sort()) {
      console.log(`  ${name.padEnd(24)} ${hex}`);
    }
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
    console.log(`Profile commands:
  deno task spore:dev -- profile list
  deno task spore:dev -- profile inspect <name>`);
  }

  private async listProfiles(): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new ProfileLoader();
    const profiles = await loader.list(paths.profilesDir());

    for (const profile of profiles) {
      if (profile.type === "composition") {
        console.log(
          `  ${profile.name.padEnd(24)} composition  ${profile.runCount} runs`,
        );
        continue;
      }

      console.log(
        `  ${
          profile.name.padEnd(24)
        } profile      base:${profile.basePalette} mood:${profile.mood} targets:${profile.targetCount}`,
      );
    }
  }

  private async inspectProfile(name: string | undefined): Promise<void> {
    if (!name) {
      console.error("Missing profile name.");
      console.error("");
      this.printProfileHelp();
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const loader = new ProfileLoader();
    const profile = await loader.inspect(paths.profilesDir(), name);
    console.log(JSON.stringify(profile, null, 2));
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
    console.log(`Recipe commands:
  deno task spore:dev -- recipe list [target]
  deno task spore:dev -- recipe inspect <target/name>`);
  }

  private async listRecipes(target: string | undefined): Promise<void> {
    const paths = BloomPaths.fromDeno();
    const loader = new RecipeLoader();
    const recipes = await loader.list(paths.recipesDir(), target);

    for (const recipe of recipes) {
      const base = recipe.basePalette
        ? `base:${recipe.basePalette}`
        : "base:(profile)";
      console.log(
        `  ${recipe.id.padEnd(32)} ${
          base.padEnd(24)
        } ${recipe.tokenCount} tokens`,
      );
    }
  }

  private async inspectRecipe(id: string | undefined): Promise<void> {
    if (!id) {
      console.error("Missing recipe id.");
      console.error("");
      this.printRecipeHelp();
      Deno.exit(1);
    }

    const paths = BloomPaths.fromDeno();
    const loader = new RecipeLoader();
    const recipe = await loader.inspect(paths.recipesDir(), id);
    console.log(JSON.stringify(recipe, null, 2));
  }

  private printUnknownCommand(command: string): void {
    console.error(`Unknown command: ${command}`);
    console.error("");
    console.error("Run:");
    console.error("  deno task spore:dev -- --help");
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

await new SporeCli().run(Deno.args);
