export const SYNC_KINDS = [
  "palettes",
  "moods",
  "profiles",
  "recipes",
  "templates",
  "hooks",
  "scripts",
] as const;

export type SyncKind = (typeof SYNC_KINDS)[number];

// Theme data only; scripts are copied when asked for by name.
export const DEFAULT_SYNC_KINDS: SyncKind[] = SYNC_KINDS.filter((kind) =>
  kind !== "scripts"
);

export type SyncAction = "add" | "update" | "config-only";

export interface SyncEntry {
  readonly kind: SyncKind;
  readonly path: string;
  readonly action: SyncAction;
}

export interface SyncPlan {
  readonly devDir: string;
  readonly configDir: string;
  readonly kinds: SyncKind[];
  readonly entries: SyncEntry[];
}

export interface SyncResult {
  readonly copied: SyncEntry[];
  readonly pruned: SyncEntry[];
  readonly kept: SyncEntry[];
}

export class DataSync {
  public constructor(
    private readonly devDir: string,
    private readonly configDir: string,
  ) {}

  public static isKind(value: string): value is SyncKind {
    return (SYNC_KINDS as readonly string[]).includes(value);
  }

  public async plan(kinds: SyncKind[]): Promise<SyncPlan> {
    const entries: SyncEntry[] = [];

    for (const kind of kinds) {
      const devFiles = await this.listKind(this.devDir, kind);
      const configFiles = await this.listKind(this.configDir, kind);

      for (const path of devFiles) {
        if (!configFiles.has(path)) {
          entries.push({ kind, path, action: "add" });
        } else if (!(await this.sameContent(path))) {
          entries.push({ kind, path, action: "update" });
        }
      }

      for (const path of configFiles) {
        if (!devFiles.has(path)) {
          entries.push({ kind, path, action: "config-only" });
        }
      }
    }

    entries.sort((a, b) => a.path.localeCompare(b.path));
    return { devDir: this.devDir, configDir: this.configDir, kinds, entries };
  }

  public async apply(plan: SyncPlan, prune: boolean): Promise<SyncResult> {
    const copied: SyncEntry[] = [];
    const pruned: SyncEntry[] = [];
    const kept: SyncEntry[] = [];
    const now = new Date();

    for (const entry of plan.entries) {
      const target = this.join(this.configDir, entry.path);

      if (entry.action === "config-only") {
        if (!prune) {
          kept.push(entry);
          continue;
        }
        await Deno.remove(target);
        await this.removeEmptyParents(target);
        pruned.push(entry);
        continue;
      }

      await Deno.mkdir(this.dirname(target), { recursive: true });
      await Deno.copyFile(this.join(this.devDir, entry.path), target);
      // Stamp the install time so a sow that ran before this copy is seen as
      // older than its inputs, even when the dev file was edited long ago.
      await Deno.utime(target, now, now);
      copied.push(entry);
    }

    return { copied, pruned, kept };
  }

  private async listKind(root: string, kind: SyncKind): Promise<Set<string>> {
    if (kind === "recipes" || kind === "templates" || kind === "hooks") {
      const files = new Set<string>();
      for (const target of await this.listDirs(this.join(root, "targets"))) {
        for (
          const file of await this.listFiles(
            this.join(root, `targets/${target}/${kind}`),
          )
        ) {
          files.add(`targets/${target}/${kind}/${file}`);
        }
      }
      return files;
    }

    const files = await this.listFiles(this.join(root, kind));
    return new Set([...files].map((file) => `${kind}/${file}`));
  }

  private async listDirs(dir: string): Promise<string[]> {
    const dirs: string[] = [];
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.isDirectory && entry.name !== ".ai") dirs.push(entry.name);
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    return dirs;
  }

  // Relative file paths below dir, skipping .ai folders like scripts/install.
  private async listFiles(dir: string, prefix = ""): Promise<Set<string>> {
    const files = new Set<string>();
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.name === ".ai") continue;
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        const stat = await Deno.stat(this.join(dir, entry.name));
        if (stat.isDirectory) {
          for (
            const file of await this.listFiles(
              this.join(dir, entry.name),
              relative,
            )
          ) {
            files.add(file);
          }
        } else if (stat.isFile) {
          files.add(relative);
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    return files;
  }

  private async sameContent(path: string): Promise<boolean> {
    const [dev, config] = await Promise.all([
      Deno.readFile(this.join(this.devDir, path)),
      Deno.readFile(this.join(this.configDir, path)),
    ]);
    return dev.length === config.length &&
      dev.every((byte, index) => byte === config[index]);
  }

  // Removes folders emptied by a prune, but keeps top-level ones like palettes/.
  private async removeEmptyParents(path: string): Promise<void> {
    const root = `${this.configDir.replace(/\/+$/, "")}/`;
    let dir = this.dirname(path);
    while (dir.startsWith(root) && dir.slice(root.length).includes("/")) {
      try {
        await Deno.remove(dir);
      } catch {
        return;
      }
      dir = this.dirname(dir);
    }
  }

  private join(basePath: string, relativePath: string): string {
    return `${basePath.replace(/\/+$/, "")}/${
      relativePath.replace(/^\/+/, "")
    }`;
  }

  private dirname(path: string): string {
    const index = path.lastIndexOf("/");
    return index === -1 ? "." : path.slice(0, index);
  }
}
