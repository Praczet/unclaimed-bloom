import type { Bloom, BloomColors } from "../blooms/BloomGenerator.ts";
import type { Palette } from "../palettes/PaletteLoader.ts";
import type {
  DirectTokenRecipe,
  Recipe,
  TokenRecipe,
} from "../recipes/RecipeLoader.ts";

export interface Spore {
  readonly target: string;
  readonly recipe: string;
  readonly profile: string;
  readonly generatedAt: string;
  readonly colors: Record<string, string>;
}

function isBloomRecipe(
  recipe: TokenRecipe,
): recipe is Extract<TokenRecipe, { bloom: string }> {
  return "bloom" in recipe;
}

function isDirectRecipe(recipe: TokenRecipe): recipe is DirectTokenRecipe {
  return "base" in recipe && "source" in recipe && "mix" in recipe;
}

export class SporeGenerator {
  public generate(
    base: Palette,
    source: Palette,
    bloom: Bloom,
    recipe: Recipe,
    profile: string,
    generatedAt = new Date().toISOString(),
  ): Spore {
    const bloomColors = this.flattenBloom(bloom.colors);
    const colors: Record<string, string> = {};

    for (const [name, tokenRecipe] of Object.entries(recipe.tokens)) {
      colors[name] = this.resolveToken(base, source, bloomColors, tokenRecipe);
    }

    return {
      target: recipe.target,
      recipe: recipe.name,
      profile,
      generatedAt,
      colors,
    };
  }

  public resolveToken(
    base: Palette,
    source: Palette,
    bloomColors: Record<string, string>,
    tokenRecipe: TokenRecipe,
  ): string {
    if (isBloomRecipe(tokenRecipe)) {
      const bloomColor = bloomColors[tokenRecipe.bloom];
      if (bloomColor === undefined) {
        throw new Error(`Bloom missing key "${tokenRecipe.bloom}"`);
      }

      if (tokenRecipe.source === undefined) {
        return bloomColor;
      }

      const sourceColor = source.colors[tokenRecipe.source] ?? bloomColor;
      return this.mixColors(bloomColor, sourceColor, tokenRecipe.mix ?? 0);
    }

    if (isDirectRecipe(tokenRecipe)) {
      return this.mixBaseSource(base, source, tokenRecipe);
    }

    const baseColor = base.colors[tokenRecipe.base];
    if (baseColor === undefined) {
      throw new Error(`Base palette missing key "${tokenRecipe.base}"`);
    }

    return baseColor;
  }

  private mixBaseSource(
    base: Palette,
    source: Palette,
    tokenRecipe: DirectTokenRecipe,
  ): string {
    const baseColor = base.colors[tokenRecipe.base];
    if (baseColor === undefined) {
      throw new Error(`Base palette missing key "${tokenRecipe.base}"`);
    }

    const sourceColor = source.colors[tokenRecipe.source] ?? baseColor;
    return this.mixColors(baseColor, sourceColor, tokenRecipe.mix);
  }

  private flattenBloom(colors: BloomColors): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const [group, tokens] of Object.entries(colors)) {
      for (
        const [token, value] of Object.entries(tokens as Record<string, string>)
      ) {
        flattened[`${group}.${token}`] = value;
      }
    }

    return flattened;
  }

  private mixColors(base: string, tint: string, weight: number): string {
    const [br, bg, bb] = this.hexToRgb(base);
    const [tr, tg, tb] = this.hexToRgb(tint);
    const baseWeight = 1 - weight;

    return this.rgbToHex([
      this.clamp(br * baseWeight + tr * weight),
      this.clamp(bg * baseWeight + tg * weight),
      this.clamp(bb * baseWeight + tb * weight),
    ]);
  }

  private hexToRgb(hex: string): [number, number, number] {
    const clean = hex.trim().replace(/^#/, "");
    const expanded = clean.length === 3 || clean.length === 4
      ? clean.split("").map((part) => `${part}${part}`).join("")
      : clean;
    const rgb = expanded.length === 8 ? expanded.slice(0, 6) : expanded;

    if (rgb.length !== 6) {
      throw new Error(`Expected hex RGB color, got ${JSON.stringify(hex)}`);
    }

    return [
      parseInt(rgb.slice(0, 2), 16),
      parseInt(rgb.slice(2, 4), 16),
      parseInt(rgb.slice(4, 6), 16),
    ];
  }

  private rgbToHex([r, g, b]: [number, number, number]): string {
    return `#${r.toString(16).padStart(2, "0")}${
      g.toString(16).padStart(2, "0")
    }${b.toString(16).padStart(2, "0")}`;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
  }
}
