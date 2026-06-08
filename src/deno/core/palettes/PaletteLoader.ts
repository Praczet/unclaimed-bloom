export interface Palette {
  readonly name: string;
  readonly slug: string;
  readonly kind: "dark" | "light";
  readonly source?: string;
  readonly colors: Record<string, string>;
}

export interface PaletteSummary {
  readonly name: string;
  readonly slug: string;
  readonly kind: "dark" | "light";
  readonly colorCount: number;
  readonly path: string;
}

export class PaletteLoader {
  public async list(palettesDir: string): Promise<PaletteSummary[]> {
    const files = await this.listJsonFiles(palettesDir);
    const palettes: PaletteSummary[] = [];

    for (const fileName of files) {
      const path = this.join(palettesDir, fileName);
      const palette = await this.loadFile(path);
      palettes.push({
        name: palette.name,
        slug: palette.slug,
        kind: palette.kind,
        colorCount: Object.keys(palette.colors).length,
        path,
      });
    }

    return palettes.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  public async inspect(palettesDir: string, slug: string): Promise<Palette> {
    return await this.loadFile(this.join(palettesDir, `${slug}.json`));
  }

  public async loadFile(path: string): Promise<Palette> {
    const raw = await this.readJson(path);
    return this.validatePalette(raw, path);
  }

  private async listJsonFiles(palettesDir: string): Promise<string[]> {
    try {
      const files: string[] = [];

      for await (const entry of Deno.readDir(palettesDir)) {
        if (entry.isFile && entry.name.endsWith(".json")) {
          files.push(entry.name);
        }
      }

      return files.sort();
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Palette directory not found:\n  ${palettesDir}`);
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
        throw new Error(`Palette file not found:\n  ${path}`);
      }

      throw error;
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON in palette file:\n  ${path}`);
    }
  }

  private validatePalette(raw: unknown, path: string): Palette {
    const palette = this.assertObject(raw, "palette", path);
    const name = this.assertString(palette["name"], "name", path);
    const slug = this.assertString(palette["slug"], "slug", path);
    const kind = this.assertKind(palette["kind"], path);
    const colors = this.validateColors(palette["colors"], path);
    const source = palette["source"];

    return {
      name,
      slug,
      kind,
      ...(typeof source === "string" && source.length > 0 ? { source } : {}),
      colors,
    };
  }

  private validateColors(raw: unknown, path: string): Record<string, string> {
    const colors = this.assertObject(raw, "colors", path);
    const validated: Record<string, string> = {};

    for (const [key, value] of Object.entries(colors)) {
      if (typeof value !== "string" || !this.isHexColor(value)) {
        throw new Error(
          `Invalid hex color for "colors.${key}" in palette file:\n  ${path}`,
        );
      }

      validated[key] = value;
    }

    if (Object.keys(validated).length === 0) {
      throw new Error(`Palette must define at least one color:\n  ${path}`);
    }

    return validated;
  }

  private assertKind(value: unknown, path: string): "dark" | "light" {
    if (value !== "dark" && value !== "light") {
      throw new Error(
        `Field "kind" must be "dark" or "light" in palette file:\n  ${path}`,
      );
    }

    return value;
  }

  private isHexColor(value: string): boolean {
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
      .test(value);
  }

  private assertString(value: unknown, field: string, path: string): string {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `Missing required string field "${field}" in palette file:\n  ${path}`,
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
        `Field "${field}" must be an object in palette file:\n  ${path}`,
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
