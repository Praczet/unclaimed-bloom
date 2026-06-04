import { Mixer } from './Mixer';
import type { Palette, Recipe, Spore } from './types';

export class SporeGenerator {
    public generate(base: Palette, source: Palette, recipe: Recipe, profile: string): Spore {
        const mixer = new Mixer(base.colors, source.colors);
        const colors: Record<string, string> = {};

        for (const [name, tokenRecipe] of Object.entries(recipe.tokens)) {
            colors[name] = mixer.token(tokenRecipe);
        }

        return {
            target:      recipe.target,
            recipe:      recipe.name,
            profile,
            generatedAt: new Date().toISOString(),
            colors,
        };
    }
}
