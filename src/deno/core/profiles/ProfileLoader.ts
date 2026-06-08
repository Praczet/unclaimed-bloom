export interface MatugenSource {
  readonly type: "matugen";
  readonly colorsPath: string;
  readonly variant: "dark" | "light" | "default";
}

export interface SeedSource {
  readonly type: "seed";
  readonly color: string;
}

export type ProfileSource = MatugenSource | SeedSource;

export interface Profile {
  readonly name: string;
  readonly source: ProfileSource;
  readonly basePalette: string;
  readonly mood: string;
  readonly targets: Record<string, string>;
}

export interface CompositionRun {
  readonly profile: string;
  readonly targets?: string[];
  readonly exclude?: string[];
}

export interface CompositionProfile {
  readonly name: string;
  readonly type: "composition";
  readonly runs: CompositionRun[];
  readonly currentProfile?: string;
}

export type ProfileEntry = Profile | CompositionProfile;

export interface ProfileSummary {
  readonly name: string;
  readonly type: "profile" | "composition";
  readonly basePalette?: string;
  readonly mood?: string;
  readonly targetCount?: number;
  readonly runCount?: number;
  readonly path: string;
}

export class ProfileLoader {
  public async list(profilesDir: string): Promise<ProfileSummary[]> {
    const files = await this.listJsonFiles(profilesDir);
    const profiles: ProfileSummary[] = [];

    for (const fileName of files) {
      const path = this.join(profilesDir, fileName);
      const profile = await this.loadFile(path);
      profiles.push(this.toSummary(profile, path));
    }

    return profiles.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async inspect(
    profilesDir: string,
    name: string,
  ): Promise<ProfileEntry> {
    return await this.loadFile(this.join(profilesDir, `${name}.json`));
  }

  public async loadFile(path: string): Promise<ProfileEntry> {
    const raw = await this.readJson(path);
    return this.validateProfileEntry(raw, path);
  }

  private toSummary(profile: ProfileEntry, path: string): ProfileSummary {
    if (this.isCompositionProfile(profile)) {
      return {
        name: profile.name,
        type: "composition",
        runCount: profile.runs.length,
        path,
      };
    }

    return {
      name: profile.name,
      type: "profile",
      basePalette: profile.basePalette,
      mood: profile.mood,
      targetCount: Object.keys(profile.targets).length,
      path,
    };
  }

  private isCompositionProfile(
    profile: ProfileEntry,
  ): profile is CompositionProfile {
    return "type" in profile && profile.type === "composition";
  }

  private validateProfileEntry(raw: unknown, path: string): ProfileEntry {
    const profile = this.assertObject(raw, "profile", path);

    if (profile["type"] === "composition") {
      return this.validateCompositionProfile(profile, path);
    }

    return this.validateProfile(profile, path);
  }

  private validateProfile(raw: Record<string, unknown>, path: string): Profile {
    return {
      name: this.assertString(raw["name"], "name", path),
      basePalette: this.assertString(raw["basePalette"], "basePalette", path),
      mood: this.assertString(raw["mood"], "mood", path),
      source: this.validateSource(raw["source"], path),
      targets: this.validateStringMap(raw["targets"], "targets", path),
    };
  }

  private validateCompositionProfile(
    raw: Record<string, unknown>,
    path: string,
  ): CompositionProfile {
    const runs = raw["runs"];

    if (!Array.isArray(runs) || runs.length === 0) {
      throw new Error(
        `Field "runs" must be a non-empty array in profile file:\n  ${path}`,
      );
    }

    return {
      name: this.assertString(raw["name"], "name", path),
      type: "composition",
      runs: runs.map((run, index) =>
        this.validateCompositionRun(run, index, path)
      ),
      ...(typeof raw["currentProfile"] === "string"
        ? { currentProfile: raw["currentProfile"] }
        : {}),
    };
  }

  private validateCompositionRun(
    value: unknown,
    index: number,
    path: string,
  ): CompositionRun {
    const run = this.assertObject(value, `runs[${index}]`, path);
    const targets = run["targets"];
    const exclude = run["exclude"];

    return {
      profile: this.assertString(
        run["profile"],
        `runs[${index}].profile`,
        path,
      ),
      ...(targets !== undefined
        ? {
          targets: this.validateStringArray(
            targets,
            `runs[${index}].targets`,
            path,
          ),
        }
        : {}),
      ...(exclude !== undefined
        ? {
          exclude: this.validateStringArray(
            exclude,
            `runs[${index}].exclude`,
            path,
          ),
        }
        : {}),
    };
  }

  private validateSource(raw: unknown, path: string): ProfileSource {
    const source = this.assertObject(raw, "source", path);
    const type = this.assertString(source["type"], "source.type", path);

    if (type === "matugen") {
      const variant = source["variant"];
      if (variant !== "dark" && variant !== "light" && variant !== "default") {
        throw new Error(
          `Field "source.variant" must be "dark", "light", or "default" in profile file:\n  ${path}`,
        );
      }

      return {
        type,
        colorsPath: this.assertString(
          source["colorsPath"],
          "source.colorsPath",
          path,
        ),
        variant,
      };
    }

    if (type === "seed") {
      return {
        type,
        color: this.assertString(source["color"], "source.color", path),
      };
    }

    throw new Error(
      `Field "source.type" must be "matugen" or "seed" in profile file:\n  ${path}`,
    );
  }

  private validateStringMap(
    raw: unknown,
    field: string,
    path: string,
  ): Record<string, string> {
    const value = this.assertObject(raw, field, path);
    const result: Record<string, string> = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = this.assertString(item, `${field}.${key}`, path);
    }

    return result;
  }

  private validateStringArray(
    raw: unknown,
    field: string,
    path: string,
  ): string[] {
    if (!Array.isArray(raw) || raw.some((value) => typeof value !== "string")) {
      throw new Error(
        `Field "${field}" must be an array of strings in profile file:\n  ${path}`,
      );
    }

    return raw;
  }

  private async listJsonFiles(dir: string): Promise<string[]> {
    try {
      const files: string[] = [];

      for await (const entry of Deno.readDir(dir)) {
        if (entry.isFile && entry.name.endsWith(".json")) {
          files.push(entry.name);
        }
      }

      return files.sort();
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Profile directory not found:\n  ${dir}`);
      }

      throw error;
    }
  }

  private async readJson(path: string): Promise<unknown> {
    let text: string;

    try {
      text = await Deno.readTextFile(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Profile file not found:\n  ${path}`);
      }

      throw error;
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON in profile file:\n  ${path}`);
    }
  }

  private assertString(value: unknown, field: string, path: string): string {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `Missing required string field "${field}" in profile file:\n  ${path}`,
      );
    }

    return value;
  }

  private assertObject(
    value: unknown,
    field: string,
    path: string,
  ): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(
        `Field "${field}" must be an object in profile file:\n  ${path}`,
      );
    }

    return value as Record<string, unknown>;
  }

  private join(basePath: string, relativePath: string): string {
    if (!basePath) {
      return relativePath;
    }

    return `${basePath.replace(/\/+$/, "")}/${
      relativePath.replace(/^\/+/, "")
    }`;
  }
}
