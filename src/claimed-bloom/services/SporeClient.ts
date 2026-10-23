import type {
  BloomInspectResponse,
  CompositionProfile,
  CurrentProfileResponse,
  Palette,
  PaletteShowResponse,
  Profile,
  ProfileShowResponse,
  RecipeDetails,
  RecipePreview,
  RecipeShowResponse,
  RecipeTokenPreview,
  RecipesResponse,
  SporeRecipe,
  SporeInspectResponse,
  SporeTarget,
  StandardProfile,
  TargetsResponse,
  SporeStatusResponse,
  SporeStatus,
} from "./types";

export class SporeClient {
  constructor(private readonly executable = "spore") { }

  async execute<T>(args: string[], signal?: AbortSignal): Promise<T> {
    const process = Bun.spawn([this.executable, ...args, "--json"], {
      stdout: "pipe",
      stderr: "pipe",
      signal,
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);

    if (exitCode !== 0) {
      throw new Error(stderr.trim() || stdout.trim() || `Spore failed with exit code ${exitCode}`);
    }

    try {
      return JSON.parse(stdout) as T;
    } catch {
      throw new Error("Spore returned invalid JSON.");
    }
  }

  async getTargets(): Promise<SporeTarget[]> {
    const result = await this.execute<TargetsResponse>(["targets"]);

    if (!result.ok || !Array.isArray(result.targets)) {
      throw new Error(result.error?.message ?? "Cannot load targets.");
    }

    return result.targets;
  }

  public async getRecipes(target: string): Promise<SporeRecipe[]> {
    const result = await this.execute<RecipesResponse>(["recipe", "list", target]);

    if (!result.ok || !Array.isArray(result.recipes)) {
      throw new Error(result.error?.message ?? `Cannot load recipes for "${target}".`);
    }

    return result.recipes;
  }

  public async getRecipe(id: string): Promise<RecipeDetails> {
    const result = await this.execute<RecipeShowResponse>(["recipe", "show", id]);

    if (!result.ok || !result.recipe) {
      throw new Error(result.error?.message ?? `Cannot load recipe "${id}".`);
    }

    return result.recipe;
  }

  public async getRecipePreview(id: string): Promise<RecipePreview> {
    const recipe = await this.getRecipe(id);
    const summary = (await this.getRecipes(recipe.target)).find((candidate) => candidate.id === id);
    const warnings: string[] = [];
    let profile: StandardProfile | undefined;
    let currentProfile = "unavailable";

    try {
      currentProfile = await this.getCurrentProfile();
      profile = await this.resolveProfileForTarget(currentProfile, recipe.target);
    } catch (error: unknown) {
      warnings.push(this.errorMessage("Current profile context is unavailable", error));
    }

    const paletteSlug = recipe.basePalette ?? profile?.basePalette;
    let palette: Palette = {
      name: "Unavailable",
      slug: paletteSlug ?? "unavailable",
      kind: "unknown",
      colors: {},
    };

    if (paletteSlug) {
      try {
        palette = await this.getPalette(paletteSlug);
      } catch (error: unknown) {
        warnings.push(this.errorMessage(`Base palette "${paletteSlug}" is unavailable`, error));
      }
    } else {
      warnings.push("No recipe or current-profile base palette is available.");
    }

    let sourceColors: Record<string, string> = {};
    if (profile) {
      try {
        sourceColors = await this.loadSourceColors(profile);
      } catch (error: unknown) {
        warnings.push(
          this.errorMessage(
            `Source colors for current profile "${profile.name}" are unavailable`,
            error,
          ),
        );
      }
    }

    let bloomColors: Record<string, Record<string, string>> = {};
    if (profile) {
      try {
        bloomColors = await this.getBloomColors(profile.name);
      } catch (error: unknown) {
        warnings.push(
          this.errorMessage(
            `Cached bloom for current profile "${profile.name}" is unavailable`,
            error,
          ),
        );
      }
    }
    const resolved = new Map<string, string>();

    const tokens: RecipeTokenPreview[] = Object.entries(recipe.tokens).map(([name, token]) => {
      if ("bloom" in token) {
        const baseHex = this.getBloomColor(bloomColors, token.bloom);
        const sourceHex = token.source ? sourceColors[token.source] : undefined;
        const mix = token.mix ?? 0;
        const resultHex = token.source
          ? this.mixIfAvailable(baseHex, sourceHex ?? baseHex, mix)
          : baseHex;
        const unavailableReason = !baseHex
          ? `Bloom color "${token.bloom}" is unavailable in current profile "${profile?.name ?? currentProfile}".`
          : token.source && !sourceHex
            ? `Source color "${token.source}" is missing; result falls back to the bloom color.`
            : undefined;

        if (resultHex) resolved.set(name, resultHex);

        return {
          name,
          kind: "Bloom",
          baseLabel: `bloom.${token.bloom}`,
          baseHex,
          sourceLabel: token.source ? `source.${token.source}` : "—",
          sourceHex,
          mix,
          resultHex,
          unavailableReason,
        };
      }

      if ("token" in token) {
        const baseHex = resolved.get(token.token);
        const sourceHex = resolved.get(token.tint);
        const resultHex = this.mixIfAvailable(baseHex, sourceHex, token.mix);
        const unavailableReason = !baseHex
          ? `Earlier token "${token.token}" has no resolved color.`
          : !sourceHex
            ? `Earlier tint token "${token.tint}" has no resolved color.`
            : undefined;

        if (resultHex) resolved.set(name, resultHex);

        return {
          name,
          kind: "Derived",
          baseLabel: `token.${token.token}`,
          baseHex,
          sourceLabel: `token.${token.tint}`,
          sourceHex,
          mix: token.mix,
          resultHex,
          unavailableReason,
        };
      }

      const baseHex = palette.colors[token.base];

      if ("source" in token) {
        const sourceHex = sourceColors[token.source];
        const resultHex = this.mixIfAvailable(baseHex, sourceHex ?? baseHex, token.mix);
        const unavailableReason = !baseHex
          ? `Base color "${token.base}" is missing from palette "${palette.slug}".`
          : !sourceHex
            ? `Source color "${token.source}" is missing; result falls back to the base color.`
            : undefined;

        if (resultHex) resolved.set(name, resultHex);

        return {
          name,
          kind: "Direct mix",
          baseLabel: `base.${token.base}`,
          baseHex,
          sourceLabel: `source.${token.source}`,
          sourceHex,
          mix: token.mix,
          resultHex,
          unavailableReason,
        };
      }

      if (baseHex) resolved.set(name, baseHex);

      return {
        name,
        kind: "Base",
        baseLabel: `base.${token.base}`,
        baseHex,
        sourceLabel: "—",
        mix: 0,
        resultHex: baseHex,
        ...(!baseHex
          ? {
            unavailableReason: `Base color "${token.base}" is missing from palette "${palette.slug}".`,
          }
          : {}),
      };
    });

    let resultContext = "read-only preview from the current base/source and cached bloom";

    if (profile) {
      try {
        const cached = await this.getCachedSpore(profile.name, recipe.target);
        if (cached.recipe === recipe.name) {
          for (const token of tokens) {
            token.resultHex = cached.colors[token.name] ?? token.resultHex;
          }
          resultContext = `cached generated spore (${cached.generatedAt})`;
        } else if (tokens.some((token) => token.kind === "Bloom")) {
          warnings.push(
            `This arbitrary bloom recipe is previewed with the cached bloom for "${profile.name}" ` +
            "and the current source palette. Run sow with this recipe to obtain an exact synchronized result.",
          );
        }
      } catch (error: unknown) {
        warnings.push(
          this.errorMessage(
            `No generated spore result is available for current profile "${profile.name}"`,
            error,
          ),
        );
      }
    }

    for (const reason of new Set(tokens.map((token) => token.unavailableReason).filter(Boolean))) {
      warnings.push(reason!);
    }

    return {
      recipe,
      id,
      path: summary?.path ?? `${recipe.target}/${recipe.name}`,
      profile: profile?.name ?? currentProfile,
      palette,
      tokens,
      warnings,
      resultContext,
    };
  }

  async getStatus(): Promise<SporeStatus> {
    const result = await this.execute<SporeStatusResponse>(["status"]);

    if (!result.ok || !result.status) {
      throw new Error(result.error?.message ?? "Can not get status.");
    }

    return result.status;
  }

  private async getCurrentProfile(): Promise<string> {
    const result = await this.execute<CurrentProfileResponse>(["profile", "current"]);

    if (!result.ok || !result.profile) {
      throw new Error(result.error?.message ?? "Cannot determine the current profile.");
    }

    return result.profile;
  }

  private async getProfile(name: string): Promise<Profile> {
    const result = await this.execute<ProfileShowResponse>(["profile", "show", name]);

    if (!result.ok || !result.profile) {
      throw new Error(result.error?.message ?? `Cannot load profile "${name}".`);
    }

    return result.profile;
  }

  private async resolveProfileForTarget(name: string, target: string): Promise<StandardProfile> {
    const profile = await this.getProfile(name);

    if (!this.isCompositionProfile(profile)) {
      return profile;
    }

    let selected = profile.currentProfile ?? profile.runs[0]?.profile;

    for (const run of profile.runs) {
      if (run.targets === undefined || run.targets.includes(target)) {
        selected = run.profile;
      }
    }

    if (!selected) {
      throw new Error(`Composition profile "${name}" has no profile for target "${target}".`);
    }

    return await this.resolveProfileForTarget(selected, target);
  }

  private isCompositionProfile(profile: Profile): profile is CompositionProfile {
    return "type" in profile && profile.type === "composition";
  }

  private async getPalette(slug: string): Promise<Palette> {
    const result = await this.execute<PaletteShowResponse>(["palette", "show", slug]);

    if (!result.ok || !result.palette) {
      throw new Error(result.error?.message ?? `Cannot load palette "${slug}".`);
    }

    return result.palette;
  }

  private async getBloomColors(profile: string): Promise<Record<string, Record<string, string>>> {
    const result = await this.execute<BloomInspectResponse>(["inspect", "bloom", profile]);

    if (!result.ok || !result.bloom?.colors) {
      throw new Error(result.error?.message ?? `No cached bloom exists for "${profile}".`);
    }

    return result.bloom.colors;
  }

  private async getCachedSpore(
    profile: string,
    target: string,
  ): Promise<SporeInspectResponse["spore"]> {
    const result = await this.execute<SporeInspectResponse>(["inspect", "spore", profile, target]);

    if (!result.ok || !result.spore) {
      throw new Error(result.error?.message ?? `No cached spore exists for ${profile}/${target}.`);
    }

    return result.spore;
  }

  private async loadSourceColors(profile: StandardProfile): Promise<Record<string, string>> {
    if (profile.source.type === "seed") {
      const color = profile.source.color;
      return color
        ? Object.fromEntries(
          [
            "background",
            "surface",
            "surface_container_high",
            "surface_container_highest",
            "on_surface",
            "on_surface_variant",
            "outline",
            "outline_variant",
            "primary",
            "secondary",
            "tertiary",
            "error",
            "secondary_container",
            "on_secondary_container",
          ].map((name) => [name, color]),
        )
        : {};
    }

    if (!profile.source.colorsPath || !profile.source.variant) {
      return {};
    }

    const home = Bun.env.HOME ?? "";
    const path = profile.source.colorsPath.replace(/^~(?=\/|$)/, home);
    const raw = (await Bun.file(path).json()) as {
      colors?: Record<string, Record<string, { color?: unknown }>>;
      base16?: Record<string, Record<string, { color?: unknown }>>;
    };
    const colors: Record<string, string> = {};

    for (const collection of [raw.colors ?? {}, raw.base16 ?? {}]) {
      for (const [name, variants] of Object.entries(collection)) {
        const color = variants[profile.source.variant]?.color;
        if (typeof color === "string") colors[name] = color;
      }
    }

    return colors;
  }

  private getBloomColor(
    colors: Record<string, Record<string, string>>,
    reference: string,
  ): string | undefined {
    const [group, name] = reference.split(".", 2);
    return group && name ? colors[group]?.[name] : undefined;
  }

  private mixIfAvailable(
    base: string | undefined,
    source: string | undefined,
    mix: number,
  ): string | undefined {
    if (!base || !source) return undefined;
    return this.mixColors(base, source, mix);
  }

  private mixColors(base: string, source: string, mix: number): string {
    const toRgb = (hex: string): [number, number, number] => {
      const clean = hex.replace(/^#/, "").slice(0, 6);
      return [
        Number.parseInt(clean.slice(0, 2), 16),
        Number.parseInt(clean.slice(2, 4), 16),
        Number.parseInt(clean.slice(4, 6), 16),
      ];
    };
    const baseRgb = toRgb(base);
    const sourceRgb = toRgb(source);
    const result = baseRgb.map((value, index) =>
      Math.round(value * (1 - mix) + sourceRgb[index]! * mix),
    );
    return `#${result.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  private errorMessage(prefix: string, error: unknown): string {
    const detail = error instanceof Error ? error.message : String(error);
    return `${prefix}: ${detail}`;
  }
}
