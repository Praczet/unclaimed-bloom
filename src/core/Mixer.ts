import type { TokenRecipe } from './types';

function clamp(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

export function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.trim().replace(/^#/, '');
    if (clean.length !== 6) {
        throw new Error(`Expected #RRGGBB color, got ${JSON.stringify(hex)}`);
    }
    return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
    ];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function mixColors(base: string, tint: string, weight: number): string {
    const [br, bg, bb] = hexToRgb(base);
    const [tr, tg, tb] = hexToRgb(tint);
    const w = 1 - weight;
    return rgbToHex([
        clamp(br * w + tr * weight),
        clamp(bg * w + tg * weight),
        clamp(bb * w + tb * weight),
    ]);
}

export class Mixer {
    private readonly base: Record<string, string>;
    private readonly source: Record<string, string>;

    public constructor(base: Record<string, string>, source: Record<string, string>) {
        this.base = base;
        this.source = source;
    }

    public token(recipe: TokenRecipe): string {
        const baseColor = this.base[recipe.base];
        if (baseColor === undefined) {
            throw new Error(`Base palette missing key "${recipe.base}"`);
        }
        const sourceColor = this.source[recipe.source] ?? baseColor;
        return mixColors(baseColor, sourceColor, recipe.mix);
    }
}
