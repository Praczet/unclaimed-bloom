import { homedir } from 'node:os';
import { readJson, readPalette } from './fs.js';
import { Paths } from './paths.js';
import type { Palette, Profile, Recipe } from '../core/types.js';

interface MatugenColorEntry { color: string; }
interface MatugenVariants   { dark: MatugenColorEntry; light: MatugenColorEntry; default: MatugenColorEntry; }
export interface MatugenColorsJson { colors: Record<string, MatugenVariants>; base16?: Record<string, MatugenVariants>; }

export function expandHome(p: string): string {
    return p.replace(/^~/, homedir());
}

export async function loadSourcePalette(profile: Profile): Promise<Palette> {
    if (profile.source.type !== 'matugen') {
        throw new Error(`Source type "${profile.source.type}" is not supported yet.`);
    }
    const { colorsPath, variant } = profile.source;
    const raw = await readJson<MatugenColorsJson>(expandHome(colorsPath));
    const colors: Record<string, string> = {};
    for (const [name, variants] of Object.entries(raw.colors)) {
        const entry = variants[variant];
        if (entry !== undefined) colors[name] = entry.color;
    }
    if (raw.base16 !== undefined) {
        for (const [name, variants] of Object.entries(raw.base16)) {
            const entry = variants[variant];
            if (entry !== undefined) colors[name] = entry.color;
        }
    }
    return { name: 'matugen', colors };
}

export async function loadBasePalette(profile: Profile, recipe: Pick<Recipe, 'basePalette'>): Promise<Palette> {
    return readPalette(Paths.palette(recipe.basePalette ?? profile.basePalette));
}

export async function loadSourceColors(
    colorsPath: string,
    variant: 'dark' | 'light' | 'default',
): Promise<Record<string, string>> {
    const raw = await readJson<MatugenColorsJson>(expandHome(colorsPath));
    const colors: Record<string, string> = {};
    for (const [name, variants] of Object.entries(raw.colors)) {
        const entry = variants[variant];
        if (entry !== undefined) colors[name] = entry.color;
    }
    if (raw.base16 !== undefined) {
        for (const [name, variants] of Object.entries(raw.base16)) {
            const entry = variants[variant];
            if (entry !== undefined) colors[name] = entry.color;
        }
    }
    return colors;
}
