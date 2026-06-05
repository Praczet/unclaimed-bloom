import { Mixer } from './Mixer';
import type { Bloom, BloomColors, Mood, MoodWeights, Palette } from './types';

export interface BloomPreviewRow {
    path: string;
    group: keyof BloomColors;
    name: string;
    baseKey: string;
    baseHex: string;
    sourceKey: string;
    sourceHex: string;
    weight: number;
    result: string;
}

export interface BloomPreview {
    profile: string;
    generatedAt: string;
    colors: BloomColors;
    rows: BloomPreviewRow[];
}

interface BloomStep {
    group: keyof BloomColors;
    name: string;
    base: string;
    source: string;
    moodGroup: keyof MoodWeights;
}

const BLOOM_STEPS: BloomStep[] = [
    { group: 'surface', name: 'base',    base: 'background',           source: 'background',                moodGroup: 'surface' },
    { group: 'surface', name: 'dim',     base: 'background_dark',      source: 'surface',                   moodGroup: 'surface' },
    { group: 'surface', name: 'raised',  base: 'background_highlight', source: 'surface_container_high',    moodGroup: 'surface' },
    { group: 'surface', name: 'highest', base: 'border',               source: 'surface_container_highest', moodGroup: 'surface' },
    { group: 'text',    name: 'primary',   base: 'foreground',      source: 'on_surface',         moodGroup: 'foreground' },
    { group: 'text',    name: 'secondary', base: 'foreground_dark', source: 'on_surface_variant', moodGroup: 'foreground' },
    { group: 'text',    name: 'muted',     base: 'comment',         source: 'outline',            moodGroup: 'foreground' },
    { group: 'text',    name: 'disabled',  base: 'comment',         source: 'outline_variant',    moodGroup: 'foreground' },
    { group: 'accent',  name: 'primary',   base: 'blue',    source: 'primary',   moodGroup: 'accent' },
    { group: 'accent',  name: 'secondary', base: 'magenta', source: 'secondary', moodGroup: 'accent' },
    { group: 'accent',  name: 'tertiary',  base: 'purple',  source: 'tertiary',  moodGroup: 'accent' },
    { group: 'state',   name: 'success', base: 'green',  source: 'primary',  moodGroup: 'semantic' },
    { group: 'state',   name: 'warning', base: 'yellow', source: 'tertiary', moodGroup: 'semantic' },
    { group: 'state',   name: 'danger',  base: 'red',    source: 'error',    moodGroup: 'semantic' },
    { group: 'state',   name: 'info',    base: 'cyan',   source: 'tertiary', moodGroup: 'semantic' },
    { group: 'border',  name: 'subtle', base: 'comment',        source: 'outline_variant', moodGroup: 'surface' },
    { group: 'border',  name: 'strong', base: 'foreground_dark', source: 'outline',        moodGroup: 'surface' },
    { group: 'selection', name: 'background', base: 'background_highlight', source: 'secondary_container',    moodGroup: 'surface' },
    { group: 'selection', name: 'foreground', base: 'foreground',            source: 'on_secondary_container', moodGroup: 'foreground' },
];

export class BloomGenerator {
    // base keys  → palettes/tokyonight-moon.json convention
    // source keys → Matugen Material You convention
    public generate(base: Palette, source: Palette, mood: Mood, profile: string): Bloom {
        return {
            profile,
            generatedAt: new Date().toISOString(),
            colors: this.build(base, source, mood).colors,
        };
    }

    public preview(base: Palette, source: Palette, mood: Mood, profile: string): BloomPreview {
        return {
            profile,
            generatedAt: new Date().toISOString(),
            ...this.build(base, source, mood),
        };
    }

    private build(base: Palette, source: Palette, mood: Mood): { colors: BloomColors; rows: BloomPreviewRow[] } {
        const mixer = new Mixer(base.colors, source.colors);
        const rows: BloomPreviewRow[] = [];
        const colors: BloomColors = {
            surface: { base: '', dim: '', raised: '', highest: '' },
            text: { primary: '', secondary: '', muted: '', disabled: '' },
            accent: { primary: '', secondary: '', tertiary: '' },
            state: { success: '', warning: '', danger: '', info: '' },
            border: { subtle: '', strong: '' },
            selection: { background: '', foreground: '' },
        };

        for (const step of BLOOM_STEPS) {
            const baseHex = base.colors[step.base];
            if (baseHex === undefined) {
                throw new Error(`Base palette missing key "${step.base}"`);
            }
            const sourceHex = source.colors[step.source] ?? baseHex;
            const weight = mood.weights[step.moodGroup];
            const result = mixer.token({ base: step.base, source: step.source, mix: weight });

            (colors[step.group] as Record<string, string>)[step.name] = result;
            rows.push({
                path: `${step.group}.${step.name}`,
                group: step.group,
                name: step.name,
                baseKey: step.base,
                baseHex,
                sourceKey: step.source,
                sourceHex,
                weight,
                result,
            });
        }

        return { colors, rows };
    }
}
