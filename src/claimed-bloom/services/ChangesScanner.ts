import { basename, resolve } from "node:path";

import type { SporeClient } from "./SporeClient.ts";
import type {
  CacheChange,
  ChangeKind,
  ChangesReport,
  InstallChange,
  SporeStatus,
  SporeStatusStage,
  WallpaperInfo,
} from "./types.ts";

// Mirrors the directories scripts/install copies into the config dir.
const INSTALLED_DIRS = ["palettes", "moods", "profiles", "targets", "scripts"];
const STAGES = ["sow", "grow", "plant"] as const;

export const DEV_DIR = Bun.env.UB_DEV_DIR ?? resolve(import.meta.dir, "../../..");

type Stage = (typeof STAGES)[number];

export class ChangesScanner {
  private readonly home = Bun.env.HOME ?? "";

  constructor(
    private readonly spore: SporeClient,
    private readonly devDir = DEV_DIR,
  ) { }

  async scan(): Promise<ChangesReport> {
    const status = await this.spore.getStatus();
    const configDir = status.paths.dataDir;
    const sameDir = resolve(configDir) === resolve(this.devDir);
    const notes: string[] = [];

    if (sameDir) {
      notes.push("Spore reads data straight from the dev dir, so there is nothing to install.");
    }
    if (!status.profile) {
      notes.push(status.profileError ?? "No current profile, so the cache cannot be checked.");
    }

    const colorsPaths = await this.matugenColorsPaths(status);

    return {
      devDir: this.devDir,
      configDir,
      cacheDir: status.paths.cacheDir,
      profile: status.profile?.name ?? null,
      sameDir,
      wallpaper: await this.wallpaperInfo(status, colorsPaths),
      install: sameDir ? [] : await this.compareInstall(configDir, await this.usage(status)),
      cache: await this.compareCache(status, colorsPaths),
      notes,
    };
  }

  private async wallpaperInfo(
    status: SporeStatus,
    colorsPaths: Map<string, string>,
  ): Promise<WallpaperInfo> {
    const pointer = Bun.file(resolve(status.paths.cacheDir, "current-wallpaper"));
    const colorsPath = [...colorsPaths.values()][0] ?? null;
    const colorsAt = colorsPath ? await this.modifiedAt(colorsPath) : null;
    const plant = status.stages.plant;

    return {
      path: (await pointer.exists()) ? (await pointer.text()).trim() || null : null,
      pickedAt: (await pointer.exists()) ? new Date(pointer.lastModified).toISOString() : null,
      colorsPath,
      colorsAt: colorsAt === null ? null : new Date(colorsAt).toISOString(),
      plantedAt: plant?.inSync && plant.status === "done" ? plant.updated_at : null,
      planting: status.stages.plant?.status === "running",
    };
  }

  private async compareInstall(
    configDir: string,
    usage: Map<string, string[]>,
  ): Promise<InstallChange[]> {
    const changes: InstallChange[] = [];
    const add = (change: Omit<InstallChange, "usedBy">) =>
      changes.push({ ...change, usedBy: this.usedBy(change, usage) });

    for (const dir of INSTALLED_DIRS) {
      const devFiles = await this.listFiles(resolve(this.devDir, dir));
      const configFiles = await this.listFiles(resolve(configDir, dir));
      const devTargets = this.targetNames(dir, devFiles);
      const configTargets = this.targetNames(dir, configFiles);

      for (const target of devTargets) {
        if (!configTargets.has(target)) {
          add({ kind: "target", name: target, path: `targets/${target}`, state: "not-installed" });
        }
      }
      for (const target of configTargets) {
        if (!devTargets.has(target)) {
          add({ kind: "target", name: target, path: `targets/${target}`, state: "only-installed" });
        }
      }

      const isCollapsed = (file: string) => {
        const target = dir === "targets" ? file.split("/", 1)[0]! : undefined;
        return target !== undefined && devTargets.has(target) !== configTargets.has(target);
      };

      for (const file of devFiles) {
        if (isCollapsed(file)) continue;
        const path = `${dir}/${file}`;
        const { kind, name } = this.classify(path);

        if (!configFiles.has(file)) {
          add({ kind, name, path, state: "not-installed" });
        } else if (!(await this.sameContent(resolve(this.devDir, path), resolve(configDir, path)))) {
          add({ kind, name, path, state: "modified" });
        }
      }

      for (const file of configFiles) {
        if (isCollapsed(file) || devFiles.has(file)) continue;
        const path = `${dir}/${file}`;
        add({ ...this.classify(path), path, state: "only-installed" });
      }
    }

    return changes.sort((a, b) => a.path.localeCompare(b.path));
  }

  private async compareCache(
    status: SporeStatus,
    colorsPaths: Map<string, string>,
  ): Promise<CacheChange[]> {
    const { profile, stages } = status;
    if (!profile) return [];

    const configDir = status.paths.dataDir;
    const changes = new Map<string, CacheChange>();
    const record = (
      key: string,
      change: Omit<CacheChange, "targets" | "changedAt"> & { changedAt: number | string | null },
      target?: string,
    ) => {
      const existing = changes.get(key) ?? {
        ...change,
        changedAt: typeof change.changedAt === "number"
          ? new Date(change.changedAt).toISOString()
          : change.changedAt,
        targets: [],
      };
      if (target) existing.targets.push(target);
      changes.set(key, existing);
    };

    // A stage that is running, failed, ran for another profile or never ran
    // explains everything below it, so it gets one row instead of one per file.
    const usable = new Map<Stage, SporeStatusStage>();
    for (const stageName of STAGES) {
      const stage = stages[stageName];
      const base = { kind: "stage" as const, path: "", stage: stageName, lastRun: stage?.started_at ?? null };
      const pending = stage
        ? Object.entries(stage.targets).filter(([, target]) => target.status !== "done").map(([name]) => name)
        : [];

      if (!stage) {
        record(`stage:${stageName}`, { ...base, name: stageName, state: "not-run", changedAt: null });
      } else if (stage.status === "running") {
        record(`stage:${stageName}`, { ...base, name: stageName, state: "running", changedAt: stage.updated_at });
        for (const target of pending) changes.get(`stage:${stageName}`)!.targets.push(target);
      } else if (stage.status !== "done") {
        record(`stage:${stageName}`, { ...base, name: stageName, state: "failed", changedAt: stage.updated_at });
        for (const target of pending) changes.get(`stage:${stageName}`)!.targets.push(target);
      } else if (!stage.inSync) {
        record(`stage:${stageName}`, { ...base, name: `${stageName} (${stage.profile})`, state: "other-profile", changedAt: stage.updated_at });
      } else {
        usable.set(stageName, stage);
      }
    }

    if (usable.has("sow")) {
      for (const spore of status.spores) {
        const run = profile.runs.find((candidate) => candidate.profile === spore.profile);
        if (!run) continue;

        const recipe = `targets/${spore.target}/recipes/${spore.expectedRecipe}.json`;
        if (!spore.generatedAt) {
          record(`sow:${recipe}`, { ...this.classify(recipe), path: recipe, stage: "sow", state: "not-run", changedAt: null, lastRun: null }, spore.target);
          continue;
        }

        const sownAt = new Date(spore.generatedAt).getTime();
        const inputs = [
          `profiles/${run.profile}.json`,
          `palettes/${run.basePalette}.json`,
          `moods/${run.mood}.json`,
          recipe,
        ];
        if (profile.type === "composition") inputs.unshift(`profiles/${profile.name}.json`);

        for (const input of inputs) {
          const changedAt = await this.modifiedAt(resolve(configDir, input));
          if (changedAt !== null && changedAt > sownAt) {
            record(`sow:${input}`, { ...this.classify(input), path: input, stage: "sow", state: "changed-after", changedAt, lastRun: spore.generatedAt }, spore.target);
          }
        }

        const colorsPath = colorsPaths.get(run.profile);
        const colorsAt = colorsPath ? await this.modifiedAt(colorsPath) : null;
        if (colorsPath && colorsAt !== null && colorsAt > sownAt) {
          record(`sow:${colorsPath}`, { kind: "wallpaper", name: "matugen colours", path: this.tilde(colorsPath), stage: "sow", state: "changed-after", changedAt: colorsAt, lastRun: spore.generatedAt }, spore.target);
        }
      }
    }

    const fileStages: Array<[Stage, "templates" | "hooks"]> = [["grow", "templates"], ["plant", "hooks"]];
    for (const [stageName, folder] of fileStages) {
      const stage = usable.get(stageName);
      if (!stage) continue;

      for (const target of profile.runs.flatMap((run) => run.targets)) {
        for (const file of await this.listFiles(resolve(configDir, "targets", target, folder))) {
          const path = `targets/${target}/${folder}/${file}`;
          const changedAt = await this.modifiedAt(resolve(configDir, path));
          if (changedAt !== null && changedAt > new Date(stage.started_at).getTime()) {
            record(`${stageName}:${path}`, { ...this.classify(path), path, stage: stageName, state: "changed-after", changedAt, lastRun: stage.started_at }, target);
          }
        }
      }
    }

    for (let index = 1; index < STAGES.length; index++) {
      const before = usable.get(STAGES[index - 1]!);
      const after = usable.get(STAGES[index]!);
      if (before && after && new Date(before.updated_at) > new Date(after.started_at)) {
        record(`order:${STAGES[index]}`, {
          kind: "stage",
          name: `${STAGES[index - 1]} ran after ${STAGES[index]}`,
          path: "",
          stage: STAGES[index]!,
          state: "changed-after",
          changedAt: before.updated_at,
          lastRun: after.started_at,
        });
        changes.get(`order:${STAGES[index]}`)!.targets.push(...Object.keys(before.targets));
      }
    }

    return [...changes.values()].sort((a, b) =>
      STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || a.path.localeCompare(b.path)
    );
  }

  // Config-relative path → targets of the current profile that read it while
  // sowing, growing or planting. Template and hook folders are keyed by prefix.
  private async usage(status: SporeStatus): Promise<Map<string, string[]>> {
    const usage = new Map<string, string[]>();
    const use = (path: string, targets: string[]) =>
      usage.set(path, [...new Set([...(usage.get(path) ?? []), ...targets])]);
    const profile = status.profile;
    if (!profile) return usage;

    const configDir = status.paths.dataDir;
    const allTargets = profile.runs.flatMap((run) => run.targets);
    if (profile.type === "composition") use(`profiles/${profile.name}.json`, allTargets);

    for (const run of profile.runs) {
      use(`profiles/${run.profile}.json`, run.targets);
      use(`palettes/${run.basePalette}.json`, run.targets);
      use(`moods/${run.mood}.json`, run.targets);
    }

    for (const spore of status.spores) {
      const recipe = `targets/${spore.target}/recipes/${spore.expectedRecipe}.json`;
      use(recipe, [spore.target]);
      use(`targets/${spore.target}/templates/`, [spore.target]);
      use(`targets/${spore.target}/hooks/`, [spore.target]);
      use(`targets/${spore.target}`, [spore.target]);

      const override = await Bun.file(resolve(configDir, recipe)).json()
        .then((raw: { basePalette?: unknown }) => raw.basePalette)
        .catch(() => undefined);
      if (typeof override === "string") use(`palettes/${override}.json`, [spore.target]);

      for (const hook of await this.listFiles(resolve(configDir, "targets", spore.target, "hooks"))) {
        const text = await Bun.file(resolve(configDir, "targets", spore.target, "hooks", hook)).text().catch(() => "");
        for (const match of text.matchAll(/(?:\{\{data_dir\}\}|unclaimed-bloom)\/scripts\/([\w.-]+)/g)) {
          use(`scripts/${match[1]}`, [spore.target]);
        }
      }
    }

    return usage;
  }

  private usedBy(change: Omit<InstallChange, "usedBy">, usage: Map<string, string[]>): string[] {
    const exact = usage.get(change.path);
    if (exact) return exact;
    const [, target, folder] = change.path.split("/");
    if (change.kind === "template" || change.kind === "hook") {
      return usage.get(`targets/${target}/${folder}/`) ?? [];
    }
    return [];
  }

  // Run profile name → matugen colours file, read from the installed profiles.
  private async matugenColorsPaths(status: SporeStatus): Promise<Map<string, string>> {
    const paths = new Map<string, string>();
    for (const run of status.profile?.runs ?? []) {
      try {
        const profile = (await Bun.file(resolve(status.paths.dataDir, "profiles", `${run.profile}.json`)).json()) as {
          source?: { type?: string; colorsPath?: string };
        };
        if (profile.source?.type === "matugen" && profile.source.colorsPath) {
          paths.set(run.profile, profile.source.colorsPath.replace(/^~(?=\/|$)/, this.home));
        }
      } catch { /* unreadable profile is reported by spore itself */ }
    }
    return paths;
  }

  private async modifiedAt(path: string): Promise<number | null> {
    const file = Bun.file(path);
    return (await file.exists()) ? file.lastModified : null;
  }

  private async listFiles(dir: string): Promise<Set<string>> {
    const files = new Set<string>();
    try {
      for await (const file of new Bun.Glob("**/*").scan({ cwd: dir, dot: true, onlyFiles: true })) {
        if (!file.split("/").includes(".ai")) files.add(file);
      }
    } catch { /* directory does not exist */ }
    return files;
  }

  private targetNames(dir: string, files: Set<string>): Set<string> {
    return dir === "targets" ? new Set([...files].map((file) => file.split("/", 1)[0]!)) : new Set();
  }

  private async sameContent(left: string, right: string): Promise<boolean> {
    const [a, b] = await Promise.all([Bun.file(left).bytes(), Bun.file(right).bytes()]);
    return a.length === b.length && Bun.hash(a) === Bun.hash(b);
  }

  private tilde(path: string): string {
    return this.home && path.startsWith(`${this.home}/`) ? `~${path.slice(this.home.length)}` : path;
  }

  private classify(path: string): { kind: ChangeKind; name: string } {
    const parts = path.split("/");
    const stem = (file: string) => file.replace(/\.json$/, "");

    switch (parts[0]) {
      case "palettes":
        return { kind: "palette", name: stem(parts.slice(1).join("/")) };
      case "moods":
        return { kind: "mood", name: stem(parts.slice(1).join("/")) };
      case "profiles":
        return { kind: "profile", name: stem(parts.slice(1).join("/")) };
      case "scripts":
        return { kind: "script", name: parts.slice(1).join("/") };
      case "targets": {
        const [, target, folder, ...rest] = parts;
        const file = rest.join("/");
        if (folder === "recipes") return { kind: "recipe", name: `${target}/${stem(file)}` };
        if (folder === "templates") return { kind: "template", name: `${target}/${file}` };
        if (folder === "hooks") return { kind: "hook", name: `${target}/${file}` };
        return { kind: "other", name: parts.slice(1).join("/") };
      }
      default:
        return { kind: "other", name: basename(path) };
    }
  }
}
