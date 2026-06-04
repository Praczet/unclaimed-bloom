import { Mixer } from './Mixer';
import { mixColors } from './Mixer';
import type { Bloom, DirectTokenRecipe, Palette, Recipe, Spore, TokenRecipe } from './types';

function isBloomRecipe(recipe: TokenRecipe): recipe is Extract<TokenRecipe, { bloom: string }> {
    return 'bloom' in recipe;
}

function isDirectRecipe(recipe: TokenRecipe): recipe is DirectTokenRecipe {
    return 'base' in recipe && 'source' in recipe && 'mix' in recipe;
}

function flattenBloom(bloom: Bloom): Record<string, string> {
    const colors: Record<string, string> = {};
    for (const [group, tokens] of Object.entries(bloom.colors)) {
        for (const [token, value] of Object.entries(tokens as Record<string, string>)) {
            colors[`${group}.${token}`] = value;
        }
    }
    return colors;
}

export class SporeGenerator {
    public generate(base: Palette, source: Palette, bloom: Bloom, recipe: Recipe, profile: string): Spore {
        const mixer = new Mixer(base.colors, source.colors);
        const bloomColors = flattenBloom(bloom);
        const colors: Record<string, string> = {};

        for (const [name, tokenRecipe] of Object.entries(recipe.tokens)) {
            colors[name] = this.resolveToken(mixer, source, bloomColors, tokenRecipe);
        }

        return {
            target:      recipe.target,
            recipe:      recipe.name,
            profile,
            generatedAt: new Date().toISOString(),
            colors,
        };
    }

    public resolveToken(
        mixer: Mixer,
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
            return mixColors(bloomColor, sourceColor, tokenRecipe.mix ?? 0);
        }

        if (isDirectRecipe(tokenRecipe)) {
            return mixer.token(tokenRecipe);
        }

        const baseColor = mixer.baseColor(tokenRecipe.base);
        if (baseColor === undefined) {
            throw new Error(`Base palette missing key "${tokenRecipe.base}"`);
        }
        return baseColor;
    }
}
