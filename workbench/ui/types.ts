/**
 * A group of named color tokens mapped to hex color values.
 * Example: { "bg": "#1f1f1f", "fg": "#ffffff" }
 */
type ColorGroup = Record<string, string>;

/**
 * Represents a generated bloom (color set) for a profile.
 *
 * - profile: profile name used to generate the bloom
 * - generatedAt: ISO timestamp when the bloom was generated
 * - colors: mapping of group name -> ColorGroup
 */
interface Bloom {
  profile: string;
  generatedAt: string;
  colors: Record<string, ColorGroup>;
}

/**
 * Mapping of bloom identifier -> Bloom
 */
type Blooms = Record<string, Bloom>;

/**
 * Status information for a single target within a profile.
 *
 * - name: friendly name of the target
 * - recipe: recipe used to produce the target
 * - sownAt: optional ISO timestamp when the target was sown/started
 * - grownAt: optional ISO timestamp when the target finished
 * - status: optional textual status (e.g. "ok", "failed", "running")
 */
interface TargetStatus {
  name: string;
  recipe: string;
  profile?: string;
  sownAt?: string;
  grownAt?: string;
  status?: string;
}

interface CompositionRunStatus {
  profile: string;
  targets?: string[];
  exclude?: string[];
}

/**
 * Summary status for a profile.
 *
 * - name: profile identifier
 * - basePalette: base palette name used by the profile
 * - mood: mood/variant used for generation
 * - source: source identifier for the profile (e.g. repo or path)
 * - bloomAt: optional ISO timestamp of last bloom
 * - targets: list of targets and their statuses
 */
interface ProfileStatus {
  name: string;
  type?: 'profile' | 'composition';
  basePalette: string;
  basePalettePath?: string;
  mood: string;
  source: string;
  sourcePath?: string;
  bloomAt?: string;
  bloomPath?: string;
  currentProfile?: string;
  runs?: CompositionRunStatus[];
  targets: TargetStatus[];
}

/**
 * Response shape for profile list endpoints.
 *
 * - currentProfile: optional currently active profile
 * - profiles: array of ProfileStatus entries
 */
interface ProfilesResponse {
  currentProfile?: string;
  profiles: ProfileStatus[];
}

/**
 * Generic run/action response from the backend/CLI.
 *
 * - ok: whether the action succeeded
 * - error: optional error message when ok is false
 * - action: optional action name executed
 * - profile: optional profile affected by the action
 * - target: optional target affected by the action
 * - stdout/stderr: optional captured command output
 * - profiles: optional ProfilesResponse payload
 * - blooms: optional Blooms payload
 */
interface RunResponse {
  ok: boolean;
  error?: string;
  action?: string;
  profile?: string;
  target?: string;
  stdout?: string;
  stderr?: string;
  profiles?: ProfilesResponse;
  blooms?: Blooms;
}

/**
 * Single documentation index entry.
 *
 * - id: document identifier (used to fetch the doc)
 * - title: display title
 */
interface DocsIndexItem {
  id: string;
  title: string;
}

/**
 * Documentation index response.
 *
 * - defaultDoc: id of the default doc to show
 * - docs: list of docs available
 */
interface DocsIndexResponse {
  defaultDoc: string;
  docs: DocsIndexItem[];
}

/**
 * Full document response containing rendered markdown.
 *
 * - id: document identifier
 * - title: document title
 * - markdown: markdown content of the document
 */
interface DocResponse {
  id: string;
  title: string;
  markdown: string;
}

/**
 * A single token row used when inspecting blends/mixes.
 *
 * - name: token name/path
 * - baseKey/baseHex: key and hex from the base palette
 * - srcKey/srcHex: key and hex from the source palette
 * - mix: numeric weight of the mix (0..1 or 0..100 depending on API)
 * - result: resulting hex color after mixing
 */
interface TokenRow {
  name: string;
  baseKey: string;
  baseHex: string;
  srcKey: string;
  srcHex: string;
  mix: number;
  result: string;
}

/**
 * Inspection result for a single target.
 *
 * - recipe: recipe string used to produce the target
 * - tokens: rows describing each token mix
 */
interface TargetInspect {
  recipe: string;
  profile?: string;
  basePalette?: string;
  mood?: string;
  source?: string;
  bloom?: Record<string, Record<string, string>>;
  tokens: TokenRow[];
}

/**
 * Full inspect payload for a profile.
 *
 * - profile/basePalette/mood/source: metadata used for the inspect
 * - bloom: nested mapping group -> token -> hex for the generated bloom
 * - targets: mapping of target name -> TargetInspect
 */
interface InspectData {
  profile: string;
  basePalette: string;
  mood: string;
  source: string;
  bloom: Record<string, Record<string, string>>;
  targets: Record<string, TargetInspect>;
}

/**
 * Row used in bloom preview tables.
 *
 * - path: file path or token path
 * - group: color group name
 * - name: token name
 * - baseKey/baseHex: base palette key and hex
 * - sourceKey/sourceHex: source palette key and hex
 * - weight: mix weight
 * - result: resulting hex color
 */
interface BloomPreviewRow {
  path: string;
  group: string;
  name: string;
  baseKey: string;
  baseHex: string;
  sourceKey: string;
  sourceHex: string;
  weight: number;
  result: string;
}

/**
 * Response for bloom preview generation.
 *
 * - profile/basePalette/mood/source: metadata
 * - generatedAt: ISO timestamp for preview generation
 * - colors: generated colors mapping (group -> token -> hex)
 * - rows: list of BloomPreviewRow items for tabular preview
 */
interface BloomPreviewResponse {
  profile: string;
  basePalette: string;
  mood: string;
  source: string;
  generatedAt: string;
  colors: Record<string, Record<string, string>>;
  rows: BloomPreviewRow[];
}

type TokenRecipe =
  | { base: string }
  | { bloom: string; source?: string; mix?: number }
  | { base: string; source: string; mix: number };

interface RecipeUsage {
  profile: string;
  target: string;
  composition?: string;
}

interface WorkbenchRecipeSummary {
  id: string;
  name: string;
  target: string;
  path: string;
  tokenCount: number;
  basePalette?: string;
  usages: RecipeUsage[];
  raw: {
    name?: string;
    target?: string;
    basePalette?: string;
    tokens?: Record<string, TokenRecipe>;
    weights?: Partial<Record<string, number>>;
  };
}

interface RecipesResponse {
  recipes: WorkbenchRecipeSummary[];
}

interface MoodFull {
  name: string;
  description?: string;
  weights: { surface: number; foreground: number; accent: number; semantic: number };
  path: string;
}

interface PaletteWithColors {
  name: string;
  slug: string;
  kind: 'dark' | 'light';
  colors: Record<string, string>;
  path: string;
}

interface SaveResult {
  ok: boolean;
  path?: string;
  error?: string;
}

interface RecipeEditToken {
  _id: string;
  name: string;
  base: string;
  baseHex: string;
  bloom: string;
  bloomHex: string;
  source: string;
  sourceHex: string;
  mix: number;
}

interface RecipeEditState {
  name: string;
  basePalette: string;
  tokens: RecipeEditToken[];
}

type StageStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

interface TargetRunState {
  status: StageStatus;
  duration_ms?: number;
}

interface RunStateData {
  run_id: string;
  profile: string;
  stage: string;
  status: 'running' | 'done' | 'error';
  started_at: string;
  updated_at: string;
  targets: Record<string, TargetRunState>;
}
