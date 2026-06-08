export interface DirectTokenRecipe {
  readonly source: string;
  readonly base: string;
  readonly mix: number;
}

export interface BaseTokenRecipe {
  readonly base: string;
}

export interface BloomTokenRecipe {
  readonly bloom: string;
  readonly source?: string;
  readonly mix?: number;
}

export type TokenRecipe =
  | DirectTokenRecipe
  | BaseTokenRecipe
  | BloomTokenRecipe;

export interface MoodWeights {
  readonly surface: number;
  readonly foreground: number;
  readonly accent: number;
  readonly semantic: number;
}

export interface Recipe {
  readonly name: string;
  readonly target: string;
  readonly basePalette?: string;
  readonly weights?: Partial<MoodWeights>;
  readonly tokens: Record<string, TokenRecipe>;
}

export interface RecipeSummary {
  readonly name: string;
  readonly target: string;
  readonly id: string;
  readonly basePalette?: string;
  readonly tokenCount: number;
  readonly path: string;
}

export class RecipeLoader {
  public async list(
    targetsDir: string,
    target?: string,
  ): Promise<RecipeSummary[]> {
    const targets = target ? [target] : await this.listTargetDirs(targetsDir);
    const recipes: RecipeSummary[] = [];

    for (const targetName of targets) {
      const recipesDir = this.join(
        this.join(targetsDir, targetName),
        "recipes",
      );
      const files = await this.listJsonFilesIfExists(recipesDir);

      for (const fileName of files) {
        const path = this.join(recipesDir, fileName);
        const recipe = await this.loadFile(path);
        recipes.push(this.toSummary(recipe, path));
      }
    }

    return recipes.sort((a, b) => a.id.localeCompare(b.id));
  }

  public async inspect(targetsDir: string, id: string): Promise<Recipe> {
    const [target, recipeName] = this.parseRecipeId(id);
    return await this.loadFile(
      this.join(
        this.join(this.join(targetsDir, target), "recipes"),
        `${recipeName}.json`,
      ),
    );
  }

  public async loadFile(path: string): Promise<Recipe> {
    const raw = await this.readJson(path);
    return this.validateRecipe(raw, path);
  }

  private toSummary(recipe: Recipe, path: string): RecipeSummary {
    return {
      name: recipe.name,
      target: recipe.target,
      id: `${recipe.target}/${recipe.name}`,
      ...(recipe.basePalette ? { basePalette: recipe.basePalette } : {}),
      tokenCount: Object.keys(recipe.tokens).length,
      path,
    };
  }

  private validateRecipe(raw: unknown, path: string): Recipe {
    const recipe = this.assertObject(raw, "recipe", path);
    const name = this.assertString(recipe["name"], "name", path);
    const target = this.assertString(recipe["target"], "target", path);
    const basePalette = recipe["basePalette"];
    const weights = recipe["weights"];

    return {
      name,
      target,
      ...(basePalette !== undefined
        ? { basePalette: this.assertString(basePalette, "basePalette", path) }
        : {}),
      ...(weights !== undefined
        ? { weights: this.validateWeights(weights, path) }
        : {}),
      tokens: this.validateTokens(recipe["tokens"], path),
    };
  }

  private validateWeights(raw: unknown, path: string): Partial<MoodWeights> {
    const weights = this.assertObject(raw, "weights", path);
    const result: {
      surface?: number;
      foreground?: number;
      accent?: number;
      semantic?: number;
    } = {};

    for (
      const key of ["surface", "foreground", "accent", "semantic"] as const
    ) {
      if (weights[key] !== undefined) {
        result[key] = this.assertMix(weights[key], `weights.${key}`, path);
      }
    }

    return result;
  }

  private validateTokens(
    raw: unknown,
    path: string,
  ): Record<string, TokenRecipe> {
    const tokens = this.assertObject(raw, "tokens", path);
    const result: Record<string, TokenRecipe> = {};

    for (const [name, token] of Object.entries(tokens)) {
      result[name] = this.validateToken(token, `tokens.${name}`, path);
    }

    if (Object.keys(result).length === 0) {
      throw new Error(`Recipe must define at least one token:\n  ${path}`);
    }

    return result;
  }

  private validateToken(
    raw: unknown,
    field: string,
    path: string,
  ): TokenRecipe {
    const token = this.assertObject(raw, field, path);
    const bloom = token["bloom"];
    const base = token["base"];
    const source = token["source"];
    const mix = token["mix"];

    if (bloom !== undefined) {
      return {
        bloom: this.assertString(bloom, `${field}.bloom`, path),
        ...(source !== undefined
          ? { source: this.assertString(source, `${field}.source`, path) }
          : {}),
        ...(mix !== undefined
          ? { mix: this.assertMix(mix, `${field}.mix`, path) }
          : {}),
      };
    }

    if (base !== undefined && source !== undefined) {
      return {
        base: this.assertString(base, `${field}.base`, path),
        source: this.assertString(source, `${field}.source`, path),
        mix: this.assertMix(mix, `${field}.mix`, path),
      };
    }

    if (base !== undefined) {
      return {
        base: this.assertString(base, `${field}.base`, path),
      };
    }

    throw new Error(
      `Token "${field}" must define "bloom" or "base" in recipe file:\n  ${path}`,
    );
  }

  private assertMix(value: unknown, field: string, path: string): number {
    if (
      typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
      value > 1
    ) {
      throw new Error(
        `Field "${field}" must be a number from 0.0 to 1.0 in recipe file:\n  ${path}`,
      );
    }

    return value;
  }

  private async listTargetDirs(targetsDir: string): Promise<string[]> {
    try {
      const targets: string[] = [];

      for await (const entry of Deno.readDir(targetsDir)) {
        if (entry.isDirectory) {
          targets.push(entry.name);
        }
      }

      return targets.sort();
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Targets directory not found:\n  ${targetsDir}`);
      }

      throw error;
    }
  }

  private async listJsonFilesIfExists(dir: string): Promise<string[]> {
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
        return [];
      }

      throw error;
    }
  }

  private parseRecipeId(id: string): [string, string] {
    const parts = id.split("/");

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        `Recipe id must look like <target>/<name>. Received: ${id}`,
      );
    }

    return [parts[0], parts[1]];
  }

  private async readJson(path: string): Promise<unknown> {
    let text: string;

    try {
      text = await Deno.readTextFile(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Recipe file not found:\n  ${path}`);
      }

      throw error;
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON in recipe file:\n  ${path}`);
    }
  }

  private assertString(value: unknown, field: string, path: string): string {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `Missing required string field "${field}" in recipe file:\n  ${path}`,
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
        `Field "${field}" must be an object in recipe file:\n  ${path}`,
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
