export interface TargetInfo {
  name: string;
}
export interface SporeTarget {
  target: string;
  recipes: number;
  templates: number;
  hook: string;
}

export interface TargetsResponse {
  ok: boolean;
  command: string;
  targets: SporeTarget[];
  error?: { message: string };
}

export interface SporeRecipe {
  name: string;
  target: string;
  id: string;
  basePalette?: string;
  tokenCount: number;
  path: string;
}

export interface RecipesResponse {
  ok: boolean;
  command: string;
  target: string;
  recipes: SporeRecipe[];
  error?: { message: string };
}

export type RecipeToken =
  | { base: string }
  | { base: string; source: string; mix: number }
  | { bloom: string; source?: string; mix?: number }
  | { token: string; tint: string; mix: number };

export interface RecipeDetails {
  name: string;
  target: string;
  basePalette?: string;
  tokens: Record<string, RecipeToken>;
}

export interface RecipeShowResponse {
  ok: boolean;
  command: string;
  recipe: RecipeDetails;
  error?: { message: string };
}

export interface Palette {
  name: string;
  slug: string;
  kind: string;
  source?: string;
  colors: Record<string, string>;
}

export interface PaletteShowResponse {
  ok: boolean;
  command: string;
  palette: Palette;
  error?: { message: string };
}

export interface ProfileSource {
  type: "matugen" | "seed";
  colorsPath?: string;
  variant?: "dark" | "light" | "default";
  color?: string;
}

export interface StandardProfile {
  name: string;
  basePalette: string;
  mood: string;
  source: ProfileSource;
  targets: Record<string, string>;
}

export interface CompositionRun {
  profile: string;
  targets?: string[];
}

export interface CompositionProfile {
  name: string;
  type: "composition";
  runs: CompositionRun[];
  currentProfile?: string;
}

export type Profile = StandardProfile | CompositionProfile;

export interface ProfileShowResponse {
  ok: boolean;
  command: string;
  profile: Profile;
  error?: { message: string };
}

export interface CurrentProfileResponse {
  ok: boolean;
  command: string;
  profile: string;
  error?: { message: string };
}

export interface BloomInspectResponse {
  ok: boolean;
  command: string;
  bloom: {
    colors: Record<string, Record<string, string>>;
  };
  error?: { message: string };
}

export interface SporeInspectResponse {
  ok: boolean;
  command: string;
  spore: {
    recipe: string;
    generatedAt: string;
    colors: Record<string, string>;
  };
  error?: { message: string };
}

export interface RecipeTokenPreview {
  name: string;
  kind: "Base" | "Direct mix" | "Bloom" | "Derived";
  baseLabel: string;
  baseHex?: string;
  sourceLabel: string;
  sourceHex?: string;
  mix: number;
  resultHex?: string;
  unavailableReason?: string;
}

export interface RecipePreview {
  recipe: RecipeDetails;
  id: string;
  path: string;
  profile: string;
  palette: Palette;
  tokens: RecipeTokenPreview[];
  warnings: string[];
  resultContext: string;
}

export interface SporeStatusStage {
  run_id: string;
  profile: string;
  stage: string;
  status: string;
  started_at: string;
  updated_at: string;
  inSync: boolean;
  targets: {
    [target: string]: {
      status: string;
      duration_ms?: number;
    };
  };
}

export interface SporeStatusPaths {
  cwd: string;
  home: string;
  dataDir: string;
  cacheDir: string;
  defaultDataDir: string;
  defaultCacheDir: string;
  dataDirSource: "env" | "default";
  cacheDirSource: "env" | "default";
}

export interface SporeStatusRun {
  profile: string;
  basePalette: string;
  mood: string;
  targets: string[];
}

export interface SporeStatusProfile {
  name: string;
  type: "profile" | "composition";
  sourceProfile: string;
  runs: SporeStatusRun[];
}

export interface SporeStatusSpore {
  target: string;
  profile: string;
  expectedRecipe: string;
  recipe: string | null;
  generatedAt: string | null;
  colors: Record<string, string>;
}

export interface SporeStatus {
  paths: SporeStatusPaths;
  currentProfile: string | null;
  profile: SporeStatusProfile | null;
  profileError?: string;
  stages: {
    sow: SporeStatusStage | null;
    grow: SporeStatusStage | null;
    plant: SporeStatusStage | null;
  };
  spores: SporeStatusSpore[];
  stray: { profile: string; target: string }[];
}

export interface SporeStatusResponse {
  ok: boolean;
  command: string;
  status: SporeStatus;
  error?: { message: string };
}
