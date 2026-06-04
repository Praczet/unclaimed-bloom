import { mkdir, writeFile }  from 'node:fs/promises';
import { dirname }           from 'node:path';
import { loadSourceColors }  from '../node/loader.js';
import type { Report, Spore } from '../core/types';

const PALETTE_TOKENS = ['background', 'text', 'primary', 'success', 'danger'];

const EXTRA_KEYS = [
    'surface', 'surface_dim', 'surface_bright', 'surface_container', 'surface_variant',
    'on_surface', 'on_surface_variant',
    'outline', 'outline_variant',
    'secondary', 'tertiary', 'scrim', 'shadow',
];

export interface IcedAdapterConfig {
    outputPath:       string;
    sourceColorsPath: string;
    variant:          'dark' | 'light' | 'default';
}

export class IcedAdapter {
    public async apply(spore: Spore, config: IcedAdapterConfig): Promise<Report> {
        const startedAt = new Date().toISOString();

        const missing = PALETTE_TOKENS.filter(k => spore.colors[k] === undefined);
        if (missing.length > 0) {
            throw new Error(`Recipe "${spore.recipe}" is missing iced tokens: ${missing.join(', ')}`);
        }

        const sourceColors = await loadSourceColors(config.sourceColorsPath, config.variant);
        const merged = { ...sourceColors, ...spore.colors };

        const mode = config.variant === 'light' ? 'light' : 'dark';

        const palette: Record<string, string> = {};
        for (const k of PALETTE_TOKENS) palette[k] = merged[k]!;

        const extra: Record<string, string> = {};
        for (const k of EXTRA_KEYS) {
            if (merged[k] !== undefined) extra[k] = merged[k]!;
        }

        const json = JSON.stringify({ name: 'matugen', mode, palette, extra }, null, 2) + '\n';

        await mkdir(dirname(config.outputPath), { recursive: true });
        await writeFile(config.outputPath, json, 'utf8');

        return {
            target:     spore.target,
            profile:    spore.profile,
            recipe:     spore.recipe,
            status:     'ok',
            inputs:     { basePalette: spore.recipe, sourceColorsPath: config.sourceColorsPath },
            outputs:    [config.outputPath],
            warnings:   [],
            errors:     [],
            startedAt,
            finishedAt: new Date().toISOString(),
        };
    }
}
