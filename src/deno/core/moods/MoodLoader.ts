export interface MoodSummary {
  readonly name: string;
  readonly description: string;
  readonly weights: MoodWeights;
  readonly path: string;
}

export interface MoodWeights {
  readonly surface: number;
  readonly foreground: number;
  readonly accent: number;
  readonly semantic: number;
}

export interface Mood {
  readonly name: string;
  readonly description?: string;
  readonly weights: MoodWeights;
}

export class MoodLoader {
  public async list(moodsDir: string): Promise<MoodSummary[]> {
    const summaries: MoodSummary[] = [];

    try {
      for await (const entry of Deno.readDir(moodsDir)) {
        if (entry.isFile && entry.name.endsWith(".json")) {
          const path = this.join(moodsDir, entry.name);
          const mood = await this.loadFile(path);
          summaries.push({
            name: mood.name,
            description: mood.description ?? "",
            weights: mood.weights,
            path,
          });
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        throw new Error(`Moods directory not found:\n  ${moodsDir}`);
      }
      throw err;
    }

    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async inspect(moodsDir: string, name: string): Promise<Mood> {
    return await this.loadFile(this.join(moodsDir, `${name}.json`));
  }

  public async loadFile(path: string): Promise<Mood> {
    const raw = await this.readJson(path);
    return this.validateMood(raw, path);
  }

  private validateMood(raw: unknown, path: string): Mood {
    const mood = this.assertObject(raw, "mood", path);
    const weights = this.assertObject(mood["weights"], "weights", path);
    const description = mood["description"];

    return {
      name: this.assertString(mood["name"], "name", path),
      ...(typeof description === "string" ? { description } : {}),
      weights: {
        surface: this.assertWeight(weights["surface"], "weights.surface", path),
        foreground: this.assertWeight(
          weights["foreground"],
          "weights.foreground",
          path,
        ),
        accent: this.assertWeight(weights["accent"], "weights.accent", path),
        semantic: this.assertWeight(
          weights["semantic"],
          "weights.semantic",
          path,
        ),
      },
    };
  }

  private async readJson(path: string): Promise<unknown> {
    let text: string;

    try {
      text = await Deno.readTextFile(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Mood file not found:\n  ${path}`);
      }

      throw error;
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON in mood file:\n  ${path}`);
    }
  }

  private assertWeight(value: unknown, field: string, path: string): number {
    if (
      typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
      value > 1
    ) {
      throw new Error(
        `Field "${field}" must be a number from 0.0 to 1.0 in mood file:\n  ${path}`,
      );
    }

    return value;
  }

  private assertString(value: unknown, field: string, path: string): string {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `Missing required string field "${field}" in mood file:\n  ${path}`,
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
        `Field "${field}" must be an object in mood file:\n  ${path}`,
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
