import { Mixer } from './Mixer';
import type { Bloom, BloomColors, Mood, MoodWeights, Palette } from './types';

export class BloomGenerator {

    // base keys  → palettes/tokyonight-moon.json convention
    // source keys → Matugen Material You convention
    public generate(base: Palette, source: Palette, mood: Mood, profile: string): Bloom {
        const mixer = new Mixer(base.colors, source.colors);

        const m = (b: string, s: string, group: keyof MoodWeights): string =>
            mixer.token({ base: b, source: s, mix: mood.weights[group] });

        const colors: BloomColors = {
            surface: {
                base:    m('background',           'background',                'surface'),
                dim:     m('background_dark',      'surface',                   'surface'),
                raised:  m('background_highlight', 'surface_container_high',    'surface'),
                highest: m('border',               'surface_container_highest', 'surface'),
            },
            text: {
                primary:   m('foreground',      'on_surface',         'foreground'),
                secondary: m('foreground_dark', 'on_surface_variant', 'foreground'),
                muted:     m('comment',         'outline',            'foreground'),
                disabled:  m('comment',         'outline_variant',    'foreground'),
            },
            accent: {
                primary:   m('blue',    'primary',   'accent'),
                secondary: m('magenta', 'secondary', 'accent'),
                tertiary:  m('purple',  'tertiary',  'accent'),
            },
            state: {
                success: m('green',  'primary',  'semantic'),
                warning: m('yellow', 'tertiary', 'semantic'),
                danger:  m('red',    'error',    'semantic'),
                info:    m('cyan',   'tertiary', 'semantic'),
            },
            border: {
                subtle: m('comment',        'outline_variant', 'surface'),
                strong: m('foreground_dark', 'outline',        'surface'),
            },
            selection: {
                background: m('background_highlight', 'secondary_container',    'surface'),
                foreground: m('foreground',            'on_secondary_container', 'foreground'),
            },
        };

        return {
            profile,
            generatedAt: new Date().toISOString(),
            colors,
        };
    }
}
