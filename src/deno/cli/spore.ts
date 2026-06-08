import { BloomPaths } from "../core/paths/BloomPaths.ts";
import { PaletteLoader } from "../core/palettes/PaletteLoader.ts";

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

    if (command === "palette") {
      await this.runPaletteCommand(commandArgs.slice(1));
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
  status    Show detected runtime paths and environment overrides.`);
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

  private printUnknownCommand(command: string): void {
    console.error(`Unknown command: ${command}`);
    console.error("");
    console.error("Run:");
    console.error("  deno task spore:dev -- --help");
  }
}

await new SporeCli().run(Deno.args);
