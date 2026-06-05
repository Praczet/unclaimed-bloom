import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CompositionProfile, CompositionRun, Mood, Palette, Profile, ProfileEntry, Recipe, Source, Spore } from '../core/types';

// --- Generic read / write ---

export async function readJson<T>(filePath: string): Promise<T> {
    let raw: string;
    try {
        raw = await readFile(filePath, 'utf8');
    } catch {
        throw new Error(`File not found:\n  ${filePath}`);
    }
    try {
        return JSON.parse(raw) as T;
    } catch {
        throw new Error(`Invalid JSON in:\n  ${filePath}`);
    }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// --- Internal validation helpers ---

function assertString(value: unknown, field: string, file: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Missing required string field "${field}" in:\n  ${file}`);
    }
    return value;
}

function assertObject(value: unknown, field: string, file: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`Field "${field}" must be an object in:\n  ${file}`);
    }
    return value as Record<string, unknown>;
}

function assertNumber(value: unknown, field: string, file: string): number {
    if (typeof value !== 'number' || !isFinite(value)) {
        throw new Error(`Field "${field}" must be a finite number in:\n  ${file}`);
    }
    return value;
}

// --- Typed loaders ---

export async function readPalette(filePath: string): Promise<Palette> {
    const raw = await readJson<Record<string, unknown>>(filePath);
    return {
        name:   assertString(raw['name'],   'name',   filePath),
        slug:   typeof raw['slug']   === 'string' ? raw['slug']   : undefined,
        kind:   raw['kind'] === 'dark' || raw['kind'] === 'light' ? raw['kind'] : undefined,
        source: typeof raw['source'] === 'string' ? raw['source'] : undefined,
        colors: assertObject(raw['colors'], 'colors', filePath) as Record<string, string>,
    };
}

export async function readMood(filePath: string): Promise<Mood> {
    const raw = await readJson<Record<string, unknown>>(filePath);
    const weights = assertObject(raw['weights'], 'weights', filePath);
    const desc = raw['description'];
    return {
        name: assertString(raw['name'], 'name', filePath),
        ...(typeof desc === 'string' ? { description: desc } : {}),
        weights: {
            surface:    assertNumber(weights['surface'],    'weights.surface',    filePath),
            foreground: assertNumber(weights['foreground'], 'weights.foreground', filePath),
            accent:     assertNumber(weights['accent'],     'weights.accent',     filePath),
            semantic:   assertNumber(weights['semantic'],   'weights.semantic',   filePath),
        },
    };
}

export async function readRecipe(filePath: string): Promise<Recipe> {
    const raw = await readJson<Record<string, unknown>>(filePath);
    return {
        name:        assertString(raw['name'],   'name',   filePath),
        target:      assertString(raw['target'], 'target', filePath),
        basePalette: raw['basePalette'] !== undefined
            ? assertString(raw['basePalette'], 'basePalette', filePath)
            : undefined,
        tokens:      assertObject(raw['tokens'], 'tokens', filePath) as Recipe['tokens'],
        weights:     raw['weights'] as Recipe['weights'],
    };
}

export async function readSpore(filePath: string): Promise<Spore> {
    const raw = await readJson<Record<string, unknown>>(filePath);
    return {
        target:      assertString(raw['target'],      'target',      filePath),
        recipe:      assertString(raw['recipe'],      'recipe',      filePath),
        profile:     assertString(raw['profile'],     'profile',     filePath),
        generatedAt: assertString(raw['generatedAt'], 'generatedAt', filePath),
        colors:      assertObject(raw['colors'],      'colors',      filePath) as Record<string, string>,
    };
}

export async function readProfile(filePath: string): Promise<Profile> {
    const raw = await readJson<Record<string, unknown>>(filePath);
    if (raw['type'] === 'composition') {
        throw new Error(`Profile is a composition, not a normal profile:\n  ${filePath}`);
    }
    const source = assertObject(raw['source'], 'source', filePath);
    assertString(source['type'], 'source.type', filePath);
    return {
        name:        assertString(raw['name'],        'name',        filePath),
        basePalette: assertString(raw['basePalette'], 'basePalette', filePath),
        mood:        assertString(raw['mood'],         'mood',        filePath),
        source:      source as unknown as Source,
        targets:     assertObject(raw['targets'],     'targets',     filePath) as Record<string, string>,
    };
}

function readCompositionRun(value: unknown, index: number, filePath: string): CompositionRun {
    const raw = assertObject(value, `runs[${index}]`, filePath);
    const run: CompositionRun = {
        profile: assertString(raw['profile'], `runs[${index}].profile`, filePath),
    };

    if (raw['targets'] !== undefined) {
        if (!Array.isArray(raw['targets']) || raw['targets'].some(t => typeof t !== 'string' || t.length === 0)) {
            throw new Error(`Field "runs[${index}].targets" must be an array of strings in:\n  ${filePath}`);
        }
        run.targets = raw['targets'] as string[];
    }

    if (raw['exclude'] !== undefined) {
        if (!Array.isArray(raw['exclude']) || raw['exclude'].some(t => typeof t !== 'string' || t.length === 0)) {
            throw new Error(`Field "runs[${index}].exclude" must be an array of strings in:\n  ${filePath}`);
        }
        run.exclude = raw['exclude'] as string[];
    }

    return run;
}

export async function readCompositionProfile(filePath: string): Promise<CompositionProfile> {
    const raw = await readJson<Record<string, unknown>>(filePath);
    if (raw['type'] !== 'composition') {
        throw new Error(`Profile is not a composition:\n  ${filePath}`);
    }
    if (!Array.isArray(raw['runs'])) {
        throw new Error(`Field "runs" must be an array in:\n  ${filePath}`);
    }

    return {
        name: assertString(raw['name'], 'name', filePath),
        type: 'composition',
        runs: raw['runs'].map((run, index) => readCompositionRun(run, index, filePath)),
        currentProfile: raw['currentProfile'] !== undefined
            ? assertString(raw['currentProfile'], 'currentProfile', filePath)
            : undefined,
    };
}

export async function readProfileEntry(filePath: string): Promise<ProfileEntry> {
    const raw = await readJson<Record<string, unknown>>(filePath);
    if (raw['type'] === 'composition') {
        return readCompositionProfile(filePath);
    }
    return readProfile(filePath);
}
