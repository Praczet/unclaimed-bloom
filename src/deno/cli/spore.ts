import { BloomPaths } from "../core/paths/BloomPaths.ts";

const VERSION = "0.1.0-deno-experiment";

class SporeCli {
  public run(args: string[]): void {
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

  private printUnknownCommand(command: string): void {
    console.error(`Unknown command: ${command}`);
    console.error("");
    console.error("Run:");
    console.error("  deno task spore:dev -- --help");
  }
}

new SporeCli().run(Deno.args);
