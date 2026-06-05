// --- Palette ---

export interface Palette {
    name: string;
    slug?: string;
    kind?: 'dark' | 'light';
    source?: string;
    colors: Record<string, string>;
}

// --- Source ---

export interface MatugenSource {
    type: 'matugen';
    colorsPath: string;
    variant: 'dark' | 'light' | 'default';
}

export interface SeedSource {
    type: 'seed';
    color: string;
}

export type Source = MatugenSource | SeedSource;

// --- Mood ---

export interface MoodWeights {
    surface: number;
    foreground: number;
    accent: number;
    semantic: number;
}

export interface Mood {
    name: string;
    description?: string;
    weights: MoodWeights;
}

// --- Recipe ---

export interface DirectTokenRecipe {
    source: string;
    base: string;
    mix: number;    // 0.0 = pure base palette, 1.0 = pure source palette
}

export interface BaseTokenRecipe {
    base: string;   // pure base palette token, for example "background"
}

export interface BloomTokenRecipe {
    bloom: string;  // semantic bloom path, for example "surface.base"
    source?: string;
    mix?: number;   // 0.0 = pure bloom token, 1.0 = pure source palette
}

export type TokenRecipe = BaseTokenRecipe | DirectTokenRecipe | BloomTokenRecipe;

export interface Recipe {
    name: string;
    target: string;
    basePalette?: string;   // omit to inherit from profile; set to override per-target
    weights?: Partial<MoodWeights>;
    tokens: Record<string, TokenRecipe>;
}

// --- Bloom ---

export interface BloomColors {
    surface: {
        base: string;
        dim: string;
        raised: string;
        highest: string;
    };
    text: {
        primary: string;
        secondary: string;
        muted: string;
        disabled: string;
    };
    accent: {
        primary: string;
        secondary: string;
        tertiary: string;
    };
    state: {
        success: string;
        warning: string;
        danger: string;
        info: string;
    };
    border: {
        subtle: string;
        strong: string;
    };
    selection: {
        background: string;
        foreground: string;
    };
}

export interface Bloom {
    profile: string;
    generatedAt: string;
    colors: BloomColors;
}

// --- Spore ---

export interface Spore {
    target: string;
    recipe: string;
    profile: string;
    generatedAt: string;
    colors: Record<string, string>;
}

// --- Profile ---

export interface Profile {
    name: string;
    source: Source;
    basePalette: string;
    mood: string;
    targets: Record<string, string>;    // target name → recipe name
}

export interface CompositionRun {
    profile: string;
    targets?: string[];
    exclude?: string[];
}

export interface CompositionProfile {
    name: string;
    type: 'composition';
    runs: CompositionRun[];
    currentProfile?: string;
}

export type ProfileEntry = Profile | CompositionProfile;

// --- Worker ---

export interface WorkerConfig {
    command: string;
    args: string[];
}

// --- Report ---

export type ReportStatus = 'ok' | 'error' | 'warning';

export interface Report {
    target: string;
    profile: string;
    recipe: string;
    status: ReportStatus;
    inputs: Record<string, unknown>;
    outputs: string[];
    warnings: string[];
    errors: string[];
    startedAt: string;
    finishedAt: string;
}
