import { basename, resolve } from "node:path";

import type { SporeClient } from "./SporeClient.ts";
import type { SporeStatus } from "./types.ts";

export interface CatalogPlainProfile {
  type: "profile";
  name: string;
  path: string;
  basePalette: string;
  mood: string;
  source: { type: string; color?: string; variant?: string };
  targets: Record<string, string>;
}

export interface CatalogCompositionProfile {
  type: "composition";
  name: string;
  path: string;
  runs: { profile: string; targets?: string[]; exclude?: string[] }[];
  sourceProfile?: string;
}

export type CatalogProfile = CatalogPlainProfile | CatalogCompositionProfile;

export interface CatalogPalette {
  slug: string;
  name: string;
  kind: string;
  source: string;
  path: string;
  colors: Record<string, string>;
}

export interface CatalogMood {
  name: string;
  description: string;
  path: string;
  weights: Record<string, number>;
}

export interface CatalogHookStep {
  type: string;
  dest: string[];
  command?: string;
  args: string[];
}

export interface CatalogTarget {
  name: string;
  recipes: { name: string; basePalette?: string; tokenCount: number }[];
  templates: string[];
  hookSteps: CatalogHookStep[];
}

export interface CachedSpore {
  recipe: string;
  generatedAt: string;
  colors: Record<string, string>;
}

// Which plain profile planted a target in a composition, in run order.
export interface ResolvedRun {
  profile: string;
  targets: string[];
}

// Everything the Show screens need, read once from the installed config dir.
// spore is asked only for status (what is live); the files are read directly
// because one spore call per profile would take seconds.
export class Catalog {
  constructor(
    readonly status: SporeStatus,
    readonly profiles: CatalogProfile[],
    readonly palettes: CatalogPalette[],
    readonly moods: CatalogMood[],
    readonly targets: CatalogTarget[],
  ) { }

  get currentName(): string | null {
    return this.status.profile?.name ?? null;
  }

  // The current profile plus every run profile it is made of.
  get liveProfiles(): Set<string> {
    const profile = this.status.profile;
    if (!profile) return new Set();
    return new Set([profile.name, ...profile.runs.map((run) => run.profile)]);
  }

  // Target → run profile that plants it now.
  get liveTargets(): Map<string, string> {
    const live = new Map<string, string>();
    for (const run of this.status.profile?.runs ?? []) {
      for (const target of run.targets) live.set(target, run.profile);
    }
    return live;
  }

  profile(name: string): CatalogProfile | undefined {
    return this.profiles.find((profile) => profile.name === name);
  }

  palette(slug: string): CatalogPalette | undefined {
    return this.palettes.find((palette) => palette.slug === slug);
  }

  mood(name: string): CatalogMood | undefined {
    return this.moods.find((mood) => mood.name === name);
  }

  target(name: string): CatalogTarget | undefined {
    return this.targets.find((target) => target.name === name);
  }

  plainProfiles(): CatalogPlainProfile[] {
    return this.profiles.filter((profile): profile is CatalogPlainProfile => profile.type === "profile");
  }

  compositionsContaining(profile: string): string[] {
    return this.profiles
      .filter((entry) => entry.type === "composition" && entry.runs.some((run) => run.profile === profile))
      .map((entry) => entry.name);
  }

  profilesUsingPalette(slug: string): string[] {
    return this.plainProfiles().filter((profile) => profile.basePalette === slug).map((profile) => profile.name);
  }

  recipesUsingPalette(slug: string): string[] {
    return this.targets.flatMap((target) =>
      target.recipes.filter((recipe) => recipe.basePalette === slug).map((recipe) => `${target.name}/${recipe.name}`)
    );
  }

  profilesUsingMood(name: string): string[] {
    return this.plainProfiles().filter((profile) => profile.mood === name).map((profile) => profile.name);
  }

  // Plain profile → recipe it picks for this target.
  profilesUsingTarget(target: string): { profile: string; recipe: string }[] {
    return this.plainProfiles()
      .filter((profile) => target in profile.targets)
      .map((profile) => ({ profile: profile.name, recipe: profile.targets[target]! }));
  }

  // Mirrors spore's expandCompositionRuns: each run plants the targets its
  // filter lets through; a later run planting the same target wins.
  resolveRuns(composition: CatalogCompositionProfile): ResolvedRun[] {
    return composition.runs.map((run) => {
      const profile = this.profile(run.profile);
      const all = profile?.type === "profile" ? Object.keys(profile.targets) : [];
      const targets = all.filter((target) =>
        run.targets ? run.targets.includes(target) : !(run.exclude ?? []).includes(target)
      );
      return { profile: run.profile, targets };
    });
  }

  async cachedSpore(profile: string, target: string): Promise<CachedSpore | undefined> {
    try {
      return (await Bun.file(resolve(this.status.paths.cacheDir, "spores", profile, `${target}.json`)).json()) as CachedSpore;
    } catch {
      return undefined;
    }
  }
}

export class CatalogService {
  constructor(private readonly spore: SporeClient) { }

  async load(): Promise<Catalog> {
    const status = await this.spore.getStatus();
    const dataDir = status.paths.dataDir;
    const [profiles, palettes, moods, targets] = await Promise.all([
      this.loadProfiles(resolve(dataDir, "profiles")),
      this.loadPalettes(resolve(dataDir, "palettes")),
      this.loadMoods(resolve(dataDir, "moods")),
      this.loadTargets(resolve(dataDir, "targets")),
    ]);
    return new Catalog(status, profiles, palettes, moods, targets);
  }

  private async loadProfiles(dir: string): Promise<CatalogProfile[]> {
    const profiles: CatalogProfile[] = [];
    for (const path of await this.jsonFiles(dir)) {
      const raw = await this.readJson(path);
      if (!raw) continue;
      const name = typeof raw.name === "string" ? raw.name : basename(path, ".json");

      if (raw.type === "composition" && Array.isArray(raw.runs)) {
        profiles.push({
          type: "composition",
          name,
          path,
          runs: raw.runs as CatalogCompositionProfile["runs"],
          ...(typeof raw.currentProfile === "string" ? { sourceProfile: raw.currentProfile } : {}),
        });
      } else {
        profiles.push({
          type: "profile",
          name,
          path,
          basePalette: String(raw.basePalette ?? ""),
          mood: String(raw.mood ?? ""),
          source: (raw.source ?? { type: "unknown" }) as CatalogPlainProfile["source"],
          targets: (raw.targets ?? {}) as Record<string, string>,
        });
      }
    }
    return profiles.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "composition" ? -1 : 1
    );
  }

  private async loadPalettes(dir: string): Promise<CatalogPalette[]> {
    const palettes: CatalogPalette[] = [];
    for (const path of await this.jsonFiles(dir)) {
      const raw = await this.readJson(path);
      if (!raw) continue;
      palettes.push({
        slug: typeof raw.slug === "string" ? raw.slug : basename(path, ".json"),
        name: String(raw.name ?? basename(path, ".json")),
        kind: String(raw.kind ?? "unknown"),
        source: typeof raw.source === "string" ? raw.source : "",
        path,
        colors: (raw.colors ?? {}) as Record<string, string>,
      });
    }
    return palettes.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async loadMoods(dir: string): Promise<CatalogMood[]> {
    const moods: CatalogMood[] = [];
    for (const path of await this.jsonFiles(dir)) {
      const raw = await this.readJson(path);
      if (!raw) continue;
      moods.push({
        name: String(raw.name ?? basename(path, ".json")),
        description: typeof raw.description === "string" ? raw.description : "",
        path,
        weights: (raw.weights ?? {}) as Record<string, number>,
      });
    }
    // Least to most wallpaper influence reads naturally as a scale.
    const total = (mood: CatalogMood) => Object.values(mood.weights).reduce((sum, value) => sum + value, 0);
    return moods.sort((a, b) => total(a) - total(b));
  }

  private async loadTargets(dir: string): Promise<CatalogTarget[]> {
    const targets: CatalogTarget[] = [];
    for await (const name of new Bun.Glob("*").scan({ cwd: dir, onlyFiles: false })) {
      const targetDir = resolve(dir, name);
      const recipes = [];
      for (const path of await this.jsonFiles(resolve(targetDir, "recipes"))) {
        const raw = await this.readJson(path);
        if (!raw) continue;
        recipes.push({
          name: String(raw.name ?? basename(path, ".json")),
          ...(typeof raw.basePalette === "string" ? { basePalette: raw.basePalette } : {}),
          tokenCount: Object.keys((raw.tokens ?? {}) as object).length,
        });
      }

      const templates: string[] = [];
      try {
        for await (const file of new Bun.Glob("**/*").scan({ cwd: resolve(targetDir, "templates") })) {
          templates.push(file);
        }
      } catch { /* no templates */ }

      const hook = await this.readJson(resolve(targetDir, "hooks", "plant.json"));
      const hookSteps = Array.isArray(hook?.steps)
        ? (hook.steps as Record<string, unknown>[]).map((step) => ({
          type: String(step.type ?? ""),
          dest: Array.isArray(step.dest) ? step.dest.map(String) : [],
          ...(typeof step.command === "string" ? { command: step.command } : {}),
          args: Array.isArray(step.args) ? step.args.map(String) : [],
        }))
        : [];

      if (recipes.length > 0 || templates.length > 0) {
        targets.push({
          name,
          recipes: recipes.sort((a, b) => a.name.localeCompare(b.name)),
          templates: templates.sort(),
          hookSteps,
        });
      }
    }
    return targets.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async jsonFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      for await (const file of new Bun.Glob("*.json").scan({ cwd: dir })) files.push(resolve(dir, file));
    } catch { /* folder does not exist */ }
    return files.sort();
  }

  private async readJson(path: string): Promise<Record<string, unknown> | undefined> {
    try {
      return (await Bun.file(path).json()) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}
