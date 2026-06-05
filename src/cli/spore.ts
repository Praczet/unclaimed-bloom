#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, readdir, writeFile, unlink as fsUnlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
import { AgsAdapter }     from '../adapters/AgsAdapter';
import { IcedAdapter }    from '../adapters/IcedAdapter';
import { SddmAdapter }    from '../adapters/SddmAdapter';
import { SwayncAdapter }  from '../adapters/SwayncAdapter';
import { WaybarAdapter }  from '../adapters/WaybarAdapter';
import { WlogoutAdapter } from '../adapters/WlogoutAdapter';
import { GhosttyAdapter } from '../adapters/GhosttyAdapter';
import { GtkAdapter } from '../adapters/GtkAdapter';
import { HyprlandAdapter } from '../adapters/HyprlandAdapter';
import { IconsAdapter } from '../adapters/IconsAdapter';
import { MycliAdapter } from '../adapters/MycliAdapter';
import { NvimAdapter } from '../adapters/NvimAdapter';
import { PotatoAdapter } from '../adapters/PotatoAdapter';
import { RofiAdapter }   from '../adapters/RofiAdapter';
import { SqlitAdapter }  from '../adapters/SqlitAdapter';
import { YaziAdapter }   from '../adapters/YaziAdapter';
import { CANONICAL_KEYS } from '../core/canonical.js';
import { BloomGenerator } from '../core/BloomGenerator';
import { SporeGenerator } from '../core/SporeGenerator';
import { hexToRgb, mixColors } from '../core/Mixer';
import type { BloomColors, MatugenSource, Profile, Recipe, Report, Spore, TokenRecipe } from '../core/types';
import { readJson, readMood, readPalette, readProfile, readRecipe, readSpore, writeJson } from '../node/fs';
import { expandHome, loadBasePalette, loadSourcePalette } from '../node/loader';
import { CACHE_DIR, DATA_DIR, Paths } from '../node/paths';

const ICONS_DIR = process.env['UB_ICONS_DIR']
    ?? `${homedir()}/Development/Hyprland/icon-themes/adart-matugener-icons`;
const GTK_DIR = process.env['UB_GTK_DIR']
    ?? `${homedir()}/Development/Hyprland/gtk-themes/adart-matugener-gtk-theme`;

const bloomGen = new BloomGenerator();
const sporeGen = new SporeGenerator();
const TTY      = process.stdout.isTTY ?? false;

const BLOOM_KEYS = [
    'surface.base',
    'surface.dim',
    'surface.raised',
    'surface.highest',
    'text.primary',
    'text.secondary',
    'text.muted',
    'text.disabled',
    'accent.primary',
    'accent.secondary',
    'accent.tertiary',
    'state.success',
    'state.warning',
    'state.danger',
    'state.info',
    'border.subtle',
    'border.strong',
    'selection.background',
    'selection.foreground',
] as const;

const BLOOM_KEY_SET = new Set<string>(BLOOM_KEYS);

const REQUIRED_RECIPE_TOKENS: Record<string, string[]> = {
    ags: [
        'background', 'surface', 'surface_variant',
        'primary', 'secondary', 'tertiary',
        'on_background', 'on_surface',
        'outline', 'error',
    ],
    ghostty: [
        'background', 'foreground',
        'cursor_color', 'cursor_text',
        'selection_background', 'selection_foreground',
        ...Array.from({ length: 16 }, (_, i) => `palette_${i}`),
    ],
    hyprland: ['primary', 'secondary', 'tertiary', 'error', 'background', 'on_surface'],
    iced: ['background', 'text', 'primary', 'success', 'danger'],
    rofi: ['background', 'background_alt', 'foreground', 'accent1', 'selected', 'active', 'urgent'],
    sddm: ['primary', 'on_primary', 'secondary', 'error'],
    swaync: [
        'background', 'surface', 'surface_variant',
        'primary', 'secondary', 'tertiary',
        'on_background', 'on_surface',
        'outline', 'error',
    ],
    waybar: [
        'background', 'surface', 'surface_variant',
        'surface_container_high',
        'primary', 'secondary', 'tertiary',
        'on_background', 'on_surface',
        'outline', 'error',
    ],
    wlogout: ['primary', 'foreground'],
};

// --- Argv parsing (strips --flag value pairs before positionals) ---

const rawArgs = process.argv.slice(2);
const wallpaperIdx = rawArgs.indexOf('--wallpaper');
const wallpaperFlag = wallpaperIdx !== -1 ? rawArgs[wallpaperIdx + 1] : undefined;
const moodIdx = rawArgs.indexOf('--mood');
const moodFlag = moodIdx !== -1 ? rawArgs[moodIdx + 1] : undefined;
const applyFlag = rawArgs.includes('--apply');
const positional = rawArgs.filter((a, i) =>
    !a.startsWith('--') &&
    rawArgs[i - 1] !== '--wallpaper' &&
    rawArgs[i - 1] !== '--mood',
);
const [command, arg, targetArg] = positional;

try {
    switch (command) {
        case 'sow':     await sow(arg ?? 'daily', targetArg, wallpaperFlag, moodFlag); break;
        case 'grow':    await grow(arg ?? 'daily', targetArg); break;
        case 'inspect': await inspect(arg ?? 'daily', targetArg); break;
        case 'status':  await status(arg, targetArg); break;
        case 'cache':   await cacheCommand(arg, targetArg); break;
        case 'set':     await setCommand(arg, targetArg); break;
        case 'replant': await setCommand(arg, targetArg); break;
        case 'palette':
            if (arg === 'list')     { await listPalettes();          break; }
            if (arg === 'validate') { await validatePalettes(targetArg); break; }
            // fall through
        case 'mood':    if (arg === 'list') { await listMoods();    break; } // fall through
        case 'profile': if (arg === 'list') { await listProfiles(); break; } // fall through
        case 'recipe':
            if (arg === 'list')     { await listRecipes(targetArg); break; }
            if (arg === 'validate') { await validateRecipes(targetArg); break; }
            // fall through
        default:
            console.error(`Unknown command: ${command ?? '(none)'}`);
            console.error('Usage: spore sow     <profile> [target] [--wallpaper <path>] [--mood <name>]');
            console.error('       spore grow    <profile> [target]');
            console.error('       spore inspect <profile> [target]');
            console.error('       spore status  [profile] [target]');
            console.error('       spore palette list');
            console.error('       spore palette validate [name]');
            console.error('       spore mood    list');
            console.error('       spore profile list');
            console.error('       spore recipe  list [target]');
            console.error('       spore recipe  validate [target]');
            process.exit(1);
    }
} catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
}

// --- Shared helpers ---

async function runMatugen(wallpaperPath: string, outputPath: string, variant: 'dark' | 'light' | 'default'): Promise<void> {
    const prefer  = variant === 'light' ? 'lightness' : 'darkness';
    const expanded = expandHome(wallpaperPath);

    // Full run: processes all remaining matugen templates (hyprland, waybar, etc.) and sets wallpaper.
    // stdout is template processing logs — not JSON, so we don't capture it.
    async function fullRun(idx: number): Promise<void> {
        await execFileAsync('matugen', [
            `--source-color-index=${idx}`,
            'image', expanded,
            `--prefer=${prefer}`,
        ]);
    }

    // Dry run: extracts colors as JSON without re-running templates.
    async function jsonRun(idx: number): Promise<string> {
        const { stdout } = await execFileAsync('matugen', [
            `--source-color-index=${idx}`,
            'image', expanded,
            '--json', 'hex',
            '--dry-run',
            `--prefer=${prefer}`,
        ]);
        return stdout;
    }

    console.log(`  matugen ← ${wallpaperPath}  (prefer ${prefer})`);

    let usedIndex = 1;
    try {
        await fullRun(1);
        console.log(`  matugen source-color-index 1`);
    } catch {
        console.log(`  matugen index 1 failed, retrying with index 0`);
        try {
            await fullRun(0);
            usedIndex = 0;
        } catch (err) {
            throw new Error(`matugen failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const json = await jsonRun(usedIndex);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json, 'utf8');
    console.log(`  matugen → ${outputPath}`);
}

// --- Adapter dispatch ---

async function runAdapter(target: string, spore: Spore, profile: Profile): Promise<Report> {
    switch (target) {
        case 'hyprland': {
            if (profile.source.type !== 'matugen') {
                throw new Error('Hyprland adapter requires a matugen source profile');
            }
            const src = profile.source as MatugenSource;
            return new HyprlandAdapter().apply(spore, {
                luaPath:          `${homedir()}/.config/hypr/colors/matugen.lua`,
                confPath:         `${homedir()}/.config/hypr/colors/matugen.conf`,
                sourceColorsPath: src.colorsPath,
                variant:          src.variant,
                postHook:         'hyprctl reload',
            });
        }
        case 'ghostty': {
            const outputPath = `${homedir()}/.config/ghostty/themes/Unclaimed-Bloom`;
            return new GhosttyAdapter().apply(spore, outputPath);
        }
        case 'mycli': {
            return new MycliAdapter().apply(spore, {
                iniPath:      Paths.ini('mycli'),
                baseConfPath: `${homedir()}/.config/mycli/base.conf`,
                outputPath:   `${homedir()}/.myclirc`,
                workerPath:   Paths.script('ub-mycli-apply'),
            });
        }
        case 'sqlit': {
            return new SqlitAdapter().apply(spore, {
                themePath:    `${homedir()}/.config/sqlit/themes/unclaimed-bloom.json`,
                settingsPath: `${homedir()}/.config/sqlit/settings.json`,
                themeName:    'unclaimed-bloom',
            });
        }
        case 'gtk': {
            const gtkTheme = 'ADArt-Unclaimed-Bloom';
            const gtkInstall = `${homedir()}/.local/share/themes/${gtkTheme}`;
            return new GtkAdapter().apply(spore, {
                templatePath: Paths.template('gtk', 'unclaimed-bloom.css'),
                themeName:    gtkTheme,
                outputPaths: [
                    join(GTK_DIR,    'themes', gtkTheme, 'gtk-3.0', 'gtk-adart-unclaimed-bloom.css'),
                    join(GTK_DIR,    'themes', gtkTheme, 'gtk-4.0', 'gtk-adart-unclaimed-bloom.css'),
                    join(gtkInstall, 'gtk-3.0', 'gtk-adart-unclaimed-bloom.css'),
                    join(gtkInstall, 'gtk-4.0', 'gtk-adart-unclaimed-bloom.css'),
                    `${homedir()}/.config/gtk-4.0/gtk.css`,
                ],
            });
        }
        case 'icons': {
            const iconsTheme = 'ADArt-Papirus-Unclaimed-Bloom';
            return new IconsAdapter().apply(spore, {
                runtimePath:  join(CACHE_DIR, 'icons-runtime.json'),
                workerPath:   join(ICONS_DIR, 'scripts', 'icons-generate'),
                templatePath: join(ICONS_DIR, 'themes', 'Adart-Papirus-Matugen-template'),
                outputPath:   `${homedir()}/.local/share/icons/${iconsTheme}`,
                themeName:    iconsTheme,
            });
        }
        case 'nvim': {
            return new NvimAdapter().apply(spore, {
                outputPath: `${homedir()}/.config/nvim/lua/generated/matugen-colors.lua`,
            });
        }
        case 'ags': {
            if (profile.source.type !== 'matugen') {
                throw new Error('AGS adapter requires a matugen source profile');
            }
            const src = profile.source as MatugenSource;
            return new AgsAdapter().apply(spore, {
                outputPath:       `${homedir()}/Development/Hyprland/ags/shared/styles/matugen.css`,
                sourceColorsPath: src.colorsPath,
                variant:          src.variant,
                postHook:         `${homedir()}/.local/bin/ags-ensure.sh --reload adart ${homedir()}/Development/Hyprland/ags/src/app.ts`,
            });
        }
        case 'swaync': {
            if (profile.source.type !== 'matugen') {
                throw new Error('Swaync adapter requires a matugen source profile');
            }
            const src = profile.source as MatugenSource;
            return new SwayncAdapter().apply(spore, {
                outputPath:       `${homedir()}/.config/swaync/colors/matugen.css`,
                sourceColorsPath: src.colorsPath,
                variant:          src.variant,
            });
        }
        case 'waybar': {
            if (profile.source.type !== 'matugen') {
                throw new Error('Waybar adapter requires a matugen source profile');
            }
            const src = profile.source as MatugenSource;
            return new WaybarAdapter().apply(spore, {
                outputPath:       `${homedir()}/.config/waybar/colors/matugen.css`,
                sourceColorsPath: src.colorsPath,
                variant:          src.variant,
            });
        }
        case 'rofi': {
            return new RofiAdapter().apply(spore, {
                outputPath:          `${homedir()}/.config/rofi/shared/matugen.rasi`,
                wallpaperCachePath:  Paths.currentWallpaper(),
            });
        }
        case 'potato': {
            return new PotatoAdapter().apply(spore, {
                outputPath: `${homedir()}/.config/potato/theme.json`,
                postHook:   `${homedir()}/.local/bin/potato-sync`,
            });
        }
        case 'yazi': {
            return new YaziAdapter().apply(spore, {
                outputPath: `${homedir()}/.config/yazi/theme.toml`,
            });
        }
        case 'wlogout': {
            if (profile.source.type !== 'matugen') {
                throw new Error('Wlogout adapter requires a matugen source profile');
            }
            const src = profile.source as MatugenSource;
            return new WlogoutAdapter().apply(spore, {
                outputPath:       `${homedir()}/.config/wlogout/styles/matugen.css`,
                sourceColorsPath: src.colorsPath,
                variant:          src.variant,
            });
        }
        case 'iced': {
            if (profile.source.type !== 'matugen') {
                throw new Error('Iced adapter requires a matugen source profile');
            }
            const src = profile.source as MatugenSource;
            return new IcedAdapter().apply(spore, {
                outputPath:       `${homedir()}/.config/rusty-screen/theme/matugen.json`,
                sourceColorsPath: src.colorsPath,
                variant:          src.variant,
            });
        }
        case 'sddm': {
            if (profile.source.type !== 'matugen') {
                throw new Error('SDDM adapter requires a matugen source profile');
            }
            const src = profile.source as MatugenSource;
            return new SddmAdapter().apply(spore, {
                outputPath:       '/usr/local/share/sddm-adart-matugener/theme.conf',
                sourceColorsPath: src.colorsPath,
                variant:          src.variant,
            });
        }
        default:
            throw new Error(`No adapter registered for target "${target}"`);
    }
}

// --- Target filtering ---

function filterTargets(
    all: Record<string, string>,
    filter: string | undefined,
    profileName: string,
): [string, string][] {
    const entries = Object.entries(all);
    if (filter === undefined) {
        const order: Record<string, number> = {
            hyprland: 0,
            ghostty:  1,
            nvim:     2,
            ags:      3,
            swaync:   4,
            waybar:   5,
            potato:   6,
            icons:    7,
        };
        return entries.sort(([a], [b]) => (order[a] ?? 2) - (order[b] ?? 2));
    }
    const match = entries.filter(([t]) => t === filter);
    if (match.length === 0) {
        throw new Error(
            `Target "${filter}" not in profile "${profileName}". Available: ${entries.map(([t]) => t).join(', ')}`,
        );
    }
    return match;
}

// --- sow (cache only) ---

async function sow(profileName: string, targetFilter?: string, wallpaperPath?: string, moodOverride?: string): Promise<void> {
    console.log(`profile:  ${profileName}`);
    console.log(`data dir: ${DATA_DIR}`);

    const profile = await readProfile(Paths.profile(profileName));

    if (wallpaperPath !== undefined) {
        if (profile.source.type !== 'matugen') {
            throw new Error(`--wallpaper requires a matugen source, but profile "${profileName}" uses "${profile.source.type}"`);
        }
        await runMatugen(wallpaperPath, expandHome(profile.source.colorsPath), profile.source.variant);
        await writeFile(Paths.currentWallpaper(), expandHome(wallpaperPath), 'utf8');
    }

    const profileBase   = await readPalette(Paths.palette(profile.basePalette));
    const missingKeys   = CANONICAL_KEYS.filter(k => !(k in profileBase.colors));
    if (missingKeys.length > 0) {
        console.warn(`  ⚠  palette "${profile.basePalette}" missing canonical keys: ${missingKeys.join(', ')}`);
    }
    const sourcePalette = await loadSourcePalette(profile);
    const moodName      = moodOverride ?? profile.mood;
    const mood          = await readMood(Paths.mood(moodName));
    if (moodOverride) console.log(`  mood override: ${moodOverride}`);

    const bloom = bloomGen.generate(profileBase, sourcePalette, mood, profileName);
    await writeJson(Paths.bloom(profileName), {
        _generated_by: 'spore sow',
        _generated_at: bloom.generatedAt,
        ...bloom,
    });
    console.log(`  bloom → ${Paths.bloom(profileName)}`);

    for (const [target, recipeName] of filterTargets(profile.targets, targetFilter, profileName)) {
        const recipe     = await readRecipe(Paths.recipe(target, recipeName));
        const targetBase = await loadBasePalette(profile, recipe);
        const spore      = sporeGen.generate(targetBase, sourcePalette, bloom, recipe, profileName);

        await writeJson(Paths.spore(profileName, target), {
            _generated_by: 'spore sow',
            _generated_at: spore.generatedAt,
            ...spore,
        });
        const baseNote = targetBase.name !== profileBase.name ? ` (base: ${targetBase.name})` : '';
        console.log(`  spore → ${Paths.spore(profileName, target)}${baseNote}`);
    }

    await writeFile(Paths.currentProfile(), profileName, 'utf8');

    const growHint = targetFilter !== undefined
        ? `spore grow ${profileName} ${targetFilter}`
        : `spore grow ${profileName}`;
    console.log(`done.  run: ${growHint}`);
}

// --- grow (cache → config) ---

async function grow(profileName: string, targetFilter?: string): Promise<void> {
    console.log(`profile:  ${profileName}`);
    console.log(`cache:    ${CACHE_DIR}`);

    const profile = await readProfile(Paths.profile(profileName));

    for (const [target] of filterTargets(profile.targets, targetFilter, profileName)) {
        let spore: Spore;
        try {
            spore = await readSpore(Paths.spore(profileName, target));
        } catch {
            console.warn(`  ${target.padEnd(8)} ⚠  not sown — run: spore sow ${profileName}`);
            continue;
        }

        const report = await runAdapter(target, spore, profile);
        await writeJson(Paths.report(profileName, target), report);

        const out = report.outputs[report.outputs.length - 1] ?? '?';
        if (report.status === 'ok') {
            console.log(`  ${target.padEnd(8)} → ${out}`);
        } else {
            console.warn(`  ${target.padEnd(8)} ⚠  ${report.warnings[0] ?? 'unknown warning'}`);
        }
    }

    // notify workbench server if running
    notifyWorkbench(profileName, targetFilter).catch(() => {});

    console.log('done.');
}

async function notifyWorkbench(profileName: string, target?: string): Promise<void> {
    const port = process.env['UB_WORKBENCH_PORT'] ?? '7865';
    const url = `http://localhost:${port}/api/notify`;
    const body = JSON.stringify({ profile: profileName, target: target ?? '' });
    try {
        if (typeof fetch === 'function') {
            await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        } else {
            // fallback to curl if fetch not available
            await execFileAsync('curl', ['-s', '-X', 'POST', '-H', 'Content-Type: application/json', '-d', body, url]);
        }
    } catch (err) {
        // silently ignore notification failures
    }
}

// --- status ---

function fmtTs(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16) + ' UTC';
}

async function status(profileName?: string, targetFilter?: string): Promise<void> {

    let profileNames: string[];

    if (profileName !== undefined) {
        profileNames = [profileName];
    } else {
        const profilesDir = join(DATA_DIR, 'profiles');
        try {
            const files = await readdir(profilesDir);
            profileNames = files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
        } catch {
            console.log('No profiles found.');
            return;
        }
    }

    for (const name of profileNames) {
        console.log(`\n${bold(name)}`);

        // bloom
        try {
            const bloom = await readJson<Record<string, unknown>>(Paths.bloom(name));
            const ts    = typeof bloom['generatedAt'] === 'string' ? bloom['generatedAt'] : '?';
            console.log(`  ${'bloom'.padEnd(10)} grown   ${dim(fmtTs(ts))}`);
        } catch {
            console.log(`  ${'bloom'.padEnd(10)} ${dim('not sown — run: spore sow ' + name)}`);
            continue;
        }

        // spores — list what's in cache
        let profile: Profile;
        try {
            profile = await readProfile(Paths.profile(name));
        } catch {
            continue;
        }

        const targets = targetFilter !== undefined
            ? Object.entries(profile.targets).filter(([t]) => t === targetFilter)
            : Object.entries(profile.targets);

        for (const [target] of targets) {
            try {
                const spore = await readJson<Record<string, unknown>>(Paths.spore(name, target));
                const ts    = typeof spore['generatedAt'] === 'string' ? spore['generatedAt'] : '?';
                console.log(`  ${target.padEnd(10)} grown   ${dim(fmtTs(ts))}`);
            } catch {
                console.log(`  ${target.padEnd(10)} ${dim('not grown')}`);
            }
        }
    }

    console.log('');
}

// --- cache commands ---

async function setCommand(arg?: string, restArg?: string): Promise<void> {
    // usage: spore set <profile> <target> <recipe>
    const sub = arg; // unused placeholder
    const prof = positional[1];
    const tgt  = positional[2];
    const rcp  = positional[3];
    if (!prof || !tgt || !rcp) {
        console.error('usage: spore set <profile> <target> <recipe>');
        process.exit(1);
    }

    // Read profile, validate recipe exists, update and write
    const profilePath = Paths.profile(prof);
    let profile;
    try {
        profile = await readProfile(profilePath);
    } catch (err) {
        console.error(`Failed to read profile ${prof}: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    // ensure target exists in profile.targets
    if (!profile.targets || typeof profile.targets !== 'object' || !(tgt in profile.targets)) {
        console.error(`Profile "${prof}" does not have target "${tgt}"`);
        process.exit(1);
    }

    // validate recipe file exists
    try {
        await readRecipe(Paths.recipe(tgt, rcp));
    } catch (err) {
        // Try to list available variants for the target to help the user
        try {
            const dir = join(DATA_DIR, 'recipes', tgt);
            const files = (await readdir(dir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
            if (files.length > 0) {
                console.error(`Recipe "${rcp}" for target "${tgt}" not found. Available: ${files.join(', ')}`);
            } else {
                console.error(`Recipe "${rcp}" for target "${tgt}" not found and no recipes present for target "${tgt}".`);
            }
        } catch {
            console.error(`Recipe "${rcp}" for target "${tgt}" not found: ${err instanceof Error ? err.message : String(err)}`);
        }
        process.exit(1);
    }

    // update and write
    profile.targets[tgt] = rcp;
    await writeJson(profilePath, profile);
    console.log(`Profile ${prof}: set ${tgt} -> ${rcp}`);

    if (applyFlag) {
        console.log('apply flag present — running sow + grow for the changed target');
        try {
            await sow(prof, tgt);
            await grow(prof, tgt);
            console.log(`Applied and regenerated target ${tgt} for profile ${prof}`);
        } catch (err) {
            console.error(`Failed to apply after set: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    }

    // Notify the workbench server (if running) so UI can refresh without page reload
    notifyWorkbench(prof, tgt).catch(() => {});
}

// --- list commands ---

// --- list commands ---

async function cacheCommand(arg?: string, restArg?: string): Promise<void> {
    // usage: spore cache create <profile> <target> <variant>
    //        spore cache list   <profile>
    //        spore cache apply  <profile> <target> <variant>
    //        spore cache remove <profile> <target> <variant>
    const sub = arg;
    if (!sub) {
        console.error('usage: spore cache create|list|apply|remove ...');
        process.exit(1);
    }

    switch (sub) {
        case 'create': {
            // restArg is profile; positional args after are from raw positional array
            // positional: [ 'cache', 'create', '<profile>', '<target>', '<variant>' ]
            const prof = positional[2];
            const tgt = positional[3];
            const varnt = positional[4];
            if (!prof || !tgt || !varnt) {
                console.error('usage: spore cache create <profile> <target> <variant>');
                process.exit(1);
            }

            const profile = await readProfile(Paths.profile(prof));
            const profileBase = await readPalette(Paths.palette(profile.basePalette));
            const sourcePalette = await loadSourcePalette(profile);
            const mood = await readMood(Paths.mood(profile.mood));

            const recipe = await readRecipe(Paths.recipe(tgt, varnt));
            const targetBase = await loadBasePalette(profile, recipe);
            const spore = sporeGen.generate(targetBase, sourcePalette, bloomGen.generate(profileBase, sourcePalette, mood, prof), recipe, prof);

            const outPath = Paths.cachedSpore(prof, tgt, varnt);
            await mkdir(dirname(outPath), { recursive: true });
            await writeJson(outPath, {
                _generated_by: 'spore cache create',
                _generated_at: spore.generatedAt,
                ...spore,
            });
            console.log(`cached spore → ${outPath}`);
            break;
        }
        case 'list': {
            const profileName = restArg;
            if (!profileName) {
                console.error('usage: spore cache list <profile>');
                process.exit(1);
            }
            const dir = join(CACHE_DIR, 'spores', profileName);
            try {
                const files = await readdir(dir);
                for (const f of files.filter(f => f.endsWith('.json')).sort()) {
                    console.log(`  ${f}`);
                }
            } catch {
                console.log('No cached spores.');
            }
            break;
        }
        case 'apply': {
            // positional: [ 'cache', 'apply', '<profile>', '<target>', '<variant>' ]
            const aProf = positional[2];
            const aTgt  = positional[3];
            const aVar  = positional[4];
            if (!aProf || !aTgt || !aVar) {
                console.error('usage: spore cache apply <profile> <target> <variant>');
                process.exit(1);
            }
            const src = Paths.cachedSpore(aProf, aTgt, aVar);
            try {
                const s = await readJson(src);
                // copy to active spore path for profile/target
                await writeJson(Paths.spore(aProf, aTgt), s);
                console.log(`applied cached spore ${src} → ${Paths.spore(aProf, aTgt)}`);
            } catch (err) {
                console.error(`failed to apply cached spore: ${err instanceof Error ? err.message : String(err)}`);
                process.exit(1);
            }
            break;
        }
        case 'remove': {
            // positional: [ 'cache', 'remove', '<profile>', '<target>', '<variant>' ]
            const rProf = positional[2];
            const rTgt  = positional[3];
            const rVar  = positional[4];
            if (!rProf || !rTgt || !rVar) {
                console.error('usage: spore cache remove <profile> <target> <variant>');
                process.exit(1);
            }
            const src = Paths.cachedSpore(rProf, rTgt, rVar);
            try {
                await fsUnlink(src);
                console.log(`removed ${src}`);
            } catch (err) {
                console.error(`failed to remove cached spore: ${err instanceof Error ? err.message : String(err)}`);
                process.exit(1);
            }
            break;
        }
        default:
            console.error(`Unknown cache subcommand: ${sub}`);
            process.exit(1);
    }
}

// --- list commands ---

async function listPalettes(): Promise<void> {
    const dir = join(DATA_DIR, 'palettes');
    const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
    for (const file of files.sort()) {
        const p = await readPalette(join(dir, file));
        const slug = file.slice(0, -5);
        const kind = p.kind ?? '    ';
        const count = Object.keys(p.colors).length;
        console.log(`  ${slug.padEnd(28)} ${kind.padEnd(6)} ${dim(p.name)}  ${dim(`${count} colors`)}`);
    }
}

async function validatePalettes(name?: string): Promise<void> {
    const dir = join(DATA_DIR, 'palettes');
    const names = name
        ? [name]
        : (await readdir(dir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();

    let anyFailed = false;
    for (const n of names) {
        let palette;
        try { palette = await readPalette(join(dir, `${n}.json`)); }
        catch { console.log(`  ${n.padEnd(28)} ✗  not found`); anyFailed = true; continue; }

        const missing = CANONICAL_KEYS.filter(k => !(k in palette.colors));
        if (missing.length === 0) {
            console.log(`  ${n.padEnd(28)} ✓  ${CANONICAL_KEYS.length}/${CANONICAL_KEYS.length} canonical keys`);
        } else {
            console.log(`  ${n.padEnd(28)} ✗  missing (${missing.length}): ${missing.join(', ')}`);
            anyFailed = true;
        }
    }
    if (anyFailed) process.exit(1);
}

async function listMoods(): Promise<void> {
    const dir = join(DATA_DIR, 'moods');
    const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
    for (const file of files.sort()) {
        const m = await readMood(join(dir, file));
        const w = m.weights;
        const weights =
            `surface:${String(w.surface).padEnd(5)} ` +
            `foreground:${String(w.foreground).padEnd(5)} ` +
            `accent:${String(w.accent).padEnd(5)} ` +
            `semantic:${String(w.semantic)}`;
        const desc = m.description ? `  — ${m.description}` : '';
        console.log(`  ${m.name.padEnd(20)} ${weights}${desc}`);
    }
}

async function listProfiles(): Promise<void> {
    const dir = join(DATA_DIR, 'profiles');
    const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
    for (const file of files.sort()) {
        const p = await readProfile(join(dir, file));
        const targets = Object.keys(p.targets).join(' ');
        console.log(
            `  ${p.name.padEnd(16)} ` +
            `base:${p.basePalette.padEnd(20)} ` +
            `mood:${p.mood.padEnd(12)} ` +
            dim(`[${targets}]`),
        );
    }
}

async function listRecipes(targetFilter?: string): Promise<void> {
    const recipesDir = join(DATA_DIR, 'recipes');
    let targetDirs: string[];
    try {
        targetDirs = (await readdir(recipesDir)).sort();
    } catch {
        console.log('No recipes found.');
        return;
    }

    if (targetFilter !== undefined) {
        targetDirs = targetDirs.filter(d => d === targetFilter);
        if (targetDirs.length === 0) {
            throw new Error(`No recipes for target "${targetFilter}".`);
        }
    }

    for (const targetDir of targetDirs) {
        const targetPath = join(recipesDir, targetDir);
        let files: string[];
        try {
            files = (await readdir(targetPath)).filter(f => f.endsWith('.json')).sort();
        } catch { continue; }

        for (const file of files) {
            const r = await readRecipe(join(targetPath, file));
            const slug = file.slice(0, -5);
            const base = r.basePalette !== undefined ? `base:${r.basePalette}` : dim('base: (profile)');
            const count = Object.keys(r.tokens).length;
            console.log(`  ${`${targetDir}/${slug}`.padEnd(28)} ${base.padEnd(30)} ${dim(`${count} tokens`)}`);
        }
    }
}

async function recipeFiles(targetFilter?: string): Promise<Array<{ target: string; file: string; path: string }>> {
    const recipesDir = join(DATA_DIR, 'recipes');
    let targetDirs: string[];
    try {
        targetDirs = (await readdir(recipesDir)).sort();
    } catch {
        return [];
    }

    if (targetFilter !== undefined) {
        targetDirs = targetDirs.filter(d => d === targetFilter);
        if (targetDirs.length === 0) {
            throw new Error(`No recipes for target "${targetFilter}".`);
        }
    }

    const files: Array<{ target: string; file: string; path: string }> = [];
    for (const target of targetDirs) {
        const targetPath = join(recipesDir, target);
        let entries: string[];
        try {
            entries = (await readdir(targetPath)).filter(f => f.endsWith('.json')).sort();
        } catch { continue; }

        for (const file of entries) {
            files.push({ target, file, path: join(targetPath, file) });
        }
    }

    return files;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMix(value: unknown, field: string, errors: string[]): void {
    if (typeof value !== 'number' || !isFinite(value) || value < 0 || value > 1) {
        errors.push(`${field} must be a number from 0 to 1`);
    }
}

function validateTokenRecipe(tokenName: string, recipe: TokenRecipe, errors: string[]): void {
    if (!isObject(recipe)) {
        errors.push(`${tokenName}: token recipe must be an object`);
        return;
    }

    if ('base' in recipe && !('source' in recipe) && !('mix' in recipe)) {
        if (typeof recipe.base !== 'string' || recipe.base.length === 0) {
            errors.push(`${tokenName}: base must be a non-empty string`);
        } else if (!CANONICAL_KEYS.includes(recipe.base as (typeof CANONICAL_KEYS)[number])) {
            errors.push(`${tokenName}: unknown base palette key "${recipe.base}"`);
        }
        return;
    }

    if ('base' in recipe) {
        errors.push(`${tokenName}: direct base/source mix tokens are not allowed in shipped recipes; use bloom or pure base`);
    }

    if (!('bloom' in recipe)) {
        errors.push(`${tokenName}: missing bloom path or pure base token`);
        return;
    }

    if (typeof recipe.bloom !== 'string' || recipe.bloom.length === 0) {
        errors.push(`${tokenName}: bloom must be a non-empty string`);
    } else if (!BLOOM_KEY_SET.has(recipe.bloom)) {
        errors.push(`${tokenName}: unknown bloom path "${recipe.bloom}"`);
    }

    if ('source' in recipe && recipe.source !== undefined && typeof recipe.source !== 'string') {
        errors.push(`${tokenName}: source must be a string when present`);
    }

    if ('mix' in recipe && recipe.mix !== undefined) {
        validateMix(recipe.mix, `${tokenName}.mix`, errors);
    }

    if (recipe.source !== undefined && recipe.mix === undefined) {
        errors.push(`${tokenName}: source tint requires mix`);
    }

    if (recipe.source === undefined && recipe.mix !== undefined) {
        errors.push(`${tokenName}: mix requires source`);
    }
}

function validateRecipeShape(recipe: Recipe, expectedTarget: string): string[] {
    const errors: string[] = [];

    if (recipe.target !== expectedTarget) {
        errors.push(`target mismatch: directory is "${expectedTarget}" but recipe says "${recipe.target}"`);
    }

    if (!isObject(recipe.tokens)) {
        errors.push('tokens must be an object');
        return errors;
    }

    const required = REQUIRED_RECIPE_TOKENS[expectedTarget] ?? [];
    for (const token of required) {
        if (recipe.tokens[token] === undefined) {
            errors.push(`missing required token "${token}"`);
        }
    }

    for (const [tokenName, tokenRecipe] of Object.entries(recipe.tokens)) {
        validateTokenRecipe(tokenName, tokenRecipe, errors);
    }

    return errors;
}

async function validateRecipes(targetFilter?: string): Promise<void> {
    const files = await recipeFiles(targetFilter);
    if (files.length === 0) {
        console.log('No recipes found.');
        return;
    }

    let anyFailed = false;
    for (const entry of files) {
        const label = `${entry.target}/${entry.file.slice(0, -5)}`;
        let recipe: Recipe;
        try {
            recipe = await readRecipe(entry.path);
        } catch (err) {
            console.log(`  ${label.padEnd(32)} ✗  ${err instanceof Error ? err.message : String(err)}`);
            anyFailed = true;
            continue;
        }

        const errors = validateRecipeShape(recipe, entry.target);
        if (errors.length === 0) {
            const tokenRecipes = Object.values(recipe.tokens);
            const bloomCount = tokenRecipes.filter(token => 'bloom' in token).length;
            const baseCount = tokenRecipes.filter(token => 'base' in token && !('source' in token)).length;
            const baseNote = baseCount > 0 ? `, ${baseCount} base` : '';
            console.log(`  ${label.padEnd(32)} ✓  ${bloomCount} bloom${baseNote} tokens`);
        } else {
            console.log(`  ${label.padEnd(32)} ✗  ${errors.length} issue${errors.length === 1 ? '' : 's'}`);
            for (const error of errors) {
                console.log(`    - ${error}`);
            }
            anyFailed = true;
        }
    }

    if (anyFailed) process.exit(1);
}

// --- inspect display helpers ---

function fg(hex: string): string {
    if (!TTY) return '';
    const [r, g, b] = hexToRgb(hex);
    return `\x1b[38;2;${r};${g};${b}m`;
}

function reset(): string { return TTY ? '\x1b[0m' : ''; }
function dim(s: string): string { return TTY ? `\x1b[2m${s}\x1b[0m` : s; }
function bold(s: string): string { return TTY ? `\x1b[1m${s}\x1b[0m` : s; }
function swatch(hex: string): string { return `${fg(hex)}██${reset()}`; }

function tokenRow(
    outputName: string,
    baseKey: string, baseHex: string,
    srcKey: string,  srcHex: string,
    mix: number,
    rendered: string,
    nameWidth: number,
): void {
    const nameCol   = `  ${outputName}`.padEnd(nameWidth + 2);
    const baseCol   = `base:${dim(baseKey.padEnd(28))}${swatch(baseHex)} ${baseHex}`;
    const srcCol    = `src:${dim(srcKey.padEnd(29))}${swatch(srcHex)} ${srcHex}`;
    const mixCol    = `mix:${mix.toFixed(2)}`;
    const renderCol = `→ ${swatch(rendered)} ${rendered}`;
    console.log(`${nameCol}  ${baseCol}  │  ${srcCol}  │  ${mixCol}  │  ${renderCol}`);
}

function commonPrefix(strs: string[]): string {
    if (strs.length === 0) return '';
    let pfx: string = strs[0]!;
    for (const s of strs.slice(1)) {
        while (!s.startsWith(pfx)) pfx = pfx.slice(0, -1);
        if (pfx === '') return '';
    }
    return pfx;
}

function printBloom(colors: BloomColors): void {
    console.log(`\n${bold('bloom')}`);
    for (const [group, tokens] of Object.entries(colors)) {
        console.log(`  ${dim(group)}`);
        for (const [token, value] of Object.entries(tokens as Record<string, string>)) {
            console.log(`    ${token.padEnd(22)}${swatch(value)}  ${value}`);
        }
    }
}

function printSource(colors: Record<string, string>): void {
    console.log(`\n${bold('source')}`);
    const keys = Object.keys(colors).sort();
    for (const k of keys) {
        const v = colors[k];
        console.log(`  ${k.padEnd(36)}${swatch(v)}  ${v}`);
    }
}

function bloomValue(colors: BloomColors, path: string): string | undefined {
    const [group, token] = path.split('.');
    if (group === undefined || token === undefined) return undefined;
    const groupColors = (colors as unknown as Record<string, Record<string, string>>)[group];
    return groupColors?.[token];
}

// --- inspect ---

async function inspect(profileName: string, targetFilter?: string): Promise<void> {
    const profile       = await readProfile(Paths.profile(profileName));
    const profileBase   = await readPalette(Paths.palette(profile.basePalette));
    const sourcePalette = await loadSourcePalette(profile);
    const mood          = await readMood(Paths.mood(profile.mood));

    console.log(`profile:      ${profile.name}`);
    console.log(`base palette: ${profile.basePalette}`);
    console.log(`mood:         ${profile.mood}`);
    console.log(`source:       ${profile.source.type}`);

    const bloom = bloomGen.generate(profileBase, sourcePalette, mood, profileName);

    // Always show bloom and source palette so inspect reflects all source colors
    printBloom(bloom.colors);
    printSource(sourcePalette.colors);

    for (const [target, recipeName] of filterTargets(profile.targets, targetFilter, profileName)) {
        const recipe     = await readRecipe(Paths.recipe(target, recipeName));
        const targetBase = await loadBasePalette(profile, recipe);
        const baseNote   = targetBase.name !== profileBase.name ? `  ${dim(`base: ${targetBase.name}`)}` : '';

        console.log(`\n${bold(target)}  ${dim(recipeName)}${baseNote}`);

        const tokenEntries = Object.entries(recipe.tokens);
        const pfx = commonPrefix(tokenEntries.map(([n]) => n));
        const stripPfx = pfx.length > 3 ? pfx : '';
        if (stripPfx) {
            console.log(`  ${dim(`token prefix: ${stripPfx}`)}`);
        }

        const displayNames = tokenEntries.map(([n]) =>
            stripPfx ? n.slice(stripPfx.length).replace(/__+$/, '').toLowerCase() : n
        );
        const nameWidth = Math.max(...displayNames.map(n => n.length), 10);

        for (let i = 0; i < tokenEntries.length; i++) {
            const [, tr]      = tokenEntries[i]!;
            const displayName = displayNames[i]!;
            if ('bloom' in tr) {
                const bloomHex = bloomValue(bloom.colors, tr.bloom) ?? '#000000';
                const srcKey   = tr.source ?? '(none)';
                const srcHex   = tr.source !== undefined ? sourcePalette.colors[tr.source] ?? bloomHex : bloomHex;
                const mix      = tr.mix ?? 0;
                const rendered = tr.source !== undefined ? mixColors(bloomHex, srcHex, mix) : bloomHex;
                tokenRow(displayName, `bloom:${tr.bloom}`, bloomHex, srcKey, srcHex, mix, rendered, nameWidth);
            } else {
                const baseHex  = targetBase.colors[tr.base] ?? '#000000';
                if ('source' in tr && 'mix' in tr) {
                    const srcHex   = sourcePalette.colors[tr.source] ?? baseHex;
                    const rendered = mixColors(baseHex, srcHex, tr.mix);
                    tokenRow(displayName, `base:${tr.base}`, baseHex, tr.source, srcHex, tr.mix, rendered, nameWidth);
                } else {
                    tokenRow(displayName, `base:${tr.base}`, baseHex, '(none)', baseHex, 0, baseHex, nameWidth);
                }
            }
        }
    }
}
