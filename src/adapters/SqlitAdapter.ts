import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Report, Spore } from '../core/types';

const REQUIRED_TOKENS = [
    'background', 'surface', 'panel', 'foreground',
    'primary', 'secondary', 'accent',
    'success', 'warning', 'error',
    'border', 'border_blurred',
    'footer_key', 'button_fg', 'selection_bg', 'insert_mode',
];

function requireToken(colors: Record<string, string>, key: string, recipe: string): string {
    const value = colors[key];
    if (value === undefined) throw new Error(`Recipe "${recipe}" is missing required token "${key}"`);
    return value;
}

function renderTheme(spore: Spore, themeName: string): Record<string, unknown> {
    const c = spore.colors;
    const r = (key: string) => requireToken(c, key, spore.recipe);

    const surface  = r('surface');
    const panel    = r('panel');
    const primary  = r('primary');
    const secondary = r('secondary');
    const foreground = r('foreground');
    const buttonFg = r('button_fg');
    const selectionBg = r('selection_bg');

    return {
        name:       themeName,
        primary,
        secondary,
        accent:     r('accent'),
        warning:    r('warning'),
        error:      r('error'),
        success:    r('success'),
        foreground,
        background: r('background'),
        surface,
        panel,
        dark:       true,
        variables: {
            'border':                          r('border'),
            'border-blurred':                  r('border_blurred'),
            'footer-background':               surface,
            'footer-key-foreground':           r('footer_key'),
            'footer-description-foreground':   foreground,
            'button-color-foreground':         buttonFg,
            'input-selection-background':      `${selectionBg} 40%`,
            'input-selection-foreground':      foreground,
            'mode-normal-color':               secondary,
            'mode-insert-color':               r('insert_mode'),
            'scrollbar':                       primary,
            'scrollbar-hover':                 r('accent'),
            'scrollbar-active':                primary,
            'scrollbar-color':                 primary,
            'scrollbar-color-hover':           r('accent'),
            'scrollbar-color-active':          primary,
            'scrollbar-background':            surface,
            'scrollbar-background-hover':      panel,
            'scrollbar-background-active':     panel,
            'scrollbar-corner-color':          r('background'),
            'link-color':                      primary,
            'link-background':                 r('background'),
            'block-cursor-background':         primary,
            'block-cursor-foreground':         buttonFg,
            'block-cursor-text-style':         'none',
        },
    };
}

async function updateSettings(
    settingsPath: string,
    themeName: string,
    themeFilePath: string,
): Promise<void> {
    let settings: Record<string, unknown>;
    try {
        const raw = await readFile(settingsPath, 'utf8');
        settings = JSON.parse(raw) as Record<string, unknown>;
    } catch {
        settings = { theme: themeName, custom_themes: [], custom_keymap: 'default', expanded_nodes: [] };
    }

    const existing = Array.isArray(settings['custom_themes'])
        ? (settings['custom_themes'] as unknown[]).filter((v): v is string => typeof v === 'string')
        : [];

    const deduped = existing.filter(v => {
        const s = v.trim();
        return s !== themeName && s !== `${themeName}.json` && s !== themeFilePath;
    });
    deduped.push(themeName);

    settings['theme']          = themeName;
    settings['custom_themes']  = deduped;
    settings['_ub_generated']  = new Date().toISOString();

    await mkdir(dirname(settingsPath), { recursive: true });

    // backup existing settings before overwrite
    try {
        const existing = await readFile(settingsPath, 'utf8');
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        await writeFile(`${settingsPath}.bak.${ts}`, existing, 'utf8');
    } catch { /* no existing settings — nothing to back up */ }

    await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

export interface SqlitApplyOptions {
    themePath:    string;
    settingsPath: string;
    themeName:    string;
}

export class SqlitAdapter {
    public async apply(spore: Spore, opts: SqlitApplyOptions): Promise<Report> {
        const startedAt = new Date().toISOString();

        const missing = REQUIRED_TOKENS.filter(k => spore.colors[k] === undefined);
        if (missing.length > 0) {
            throw new Error(`Recipe "${spore.recipe}" is missing tokens:\n  ${missing.join(', ')}`);
        }

        const theme = renderTheme(spore, opts.themeName);
        const themePayload = {
            _generated_by: 'spore grow / SqlitAdapter',
            _generated_at: startedAt,
            theme,
        };

        await mkdir(dirname(opts.themePath), { recursive: true });
        await writeFile(opts.themePath, JSON.stringify(themePayload, null, 2) + '\n', 'utf8');

        await updateSettings(opts.settingsPath, opts.themeName, opts.themePath);

        return {
            target:     spore.target,
            profile:    spore.profile,
            recipe:     spore.recipe,
            status:     'ok',
            inputs:     { settingsPath: opts.settingsPath },
            outputs:    [opts.themePath, opts.settingsPath],
            warnings:   [],
            errors:     [],
            startedAt,
            finishedAt: new Date().toISOString(),
        };
    }
}
