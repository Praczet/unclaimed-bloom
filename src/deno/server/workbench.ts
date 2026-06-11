import { BloomGenerator } from "../core/blooms/BloomGenerator.ts";
import { MoodLoader } from "../core/moods/MoodLoader.ts";
import { BloomPaths } from "../core/paths/BloomPaths.ts";
import { type Palette, PaletteLoader } from "../core/palettes/PaletteLoader.ts";
import {
  type CompositionProfile,
  type Profile,
  type ProfileEntry,
  ProfileLoader,
} from "../core/profiles/ProfileLoader.ts";
import { RecipeLoader } from "../core/recipes/RecipeLoader.ts";

const PORT = 7865;
const HOST = "127.0.0.1";

const UI_DIR = new URL("../../../workbench/ui/", import.meta.url).pathname;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function notFound(path: string): Response {
  return jsonResponse({ ok: false, error: `No route: ${path}` }, 404);
}

// --- Color mixing (mirrors BloomGenerator internals) ---

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/, "");
  const expanded = raw.length === 3 || raw.length === 4
    ? raw.split("").map((c) => `${c}${c}`).join("")
    : raw;
  const s = expanded.length === 8 ? expanded.slice(0, 6) : expanded;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function mixColors(base: string, tint: string, weight: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const [tr, tg, tb] = hexToRgb(tint);
  const w0 = 1 - weight;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(br * w0 + tr * weight);
  const g = clamp(bg * w0 + tg * weight);
  const b = clamp(bb * w0 + tb * weight);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// --- Small file helpers ---

async function readJsonFile(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await Deno.readTextFile(path));
  } catch {
    return null;
  }
}

function isCompositionProfile(p: ProfileEntry): p is CompositionProfile {
  return "type" in p && p.type === "composition";
}

// --- Source palette loader (mirrors spore.ts) ---

async function loadSourcePalette(profile: Profile): Promise<Palette> {
  if (profile.source.type === "seed") {
    const c = profile.source.color;
    return {
      name: "seed", slug: "seed", kind: "dark",
      colors: {
        background: c, surface: c, surface_container_high: c,
        surface_container_highest: c, on_surface: c, on_surface_variant: c,
        outline: c, outline_variant: c, primary: c, secondary: c,
        tertiary: c, error: c, secondary_container: c, on_secondary_container: c,
      },
    };
  }

  const src = profile.source;
  const path = src.colorsPath.replace(/^~(?=\/|$)/, Deno.env.get("HOME") ?? "");
  const raw = await readJsonFile(path) as {
    colors?: Record<string, Record<string, { color?: unknown }>>;
    base16?: Record<string, Record<string, { color?: unknown }>>;
  } | null;

  if (!raw) throw new Error(`Could not read matugen colors: ${path}`);

  const colors: Record<string, string> = {};
  for (const [name, variants] of Object.entries(raw.colors ?? {})) {
    const color = variants[src.variant]?.color;
    if (typeof color === "string") colors[name] = color;
  }
  for (const [name, variants] of Object.entries(raw.base16 ?? {})) {
    const color = variants[src.variant]?.color;
    if (typeof color === "string") colors[name] = color;
  }

  return { name: `matugen:${src.variant}`, slug: "matugen", kind: src.variant === "light" ? "light" : "dark", colors };
}

// --- Handlers ---

async function handleStatus(): Promise<Response> {
  return jsonResponse({ ok: true, status: BloomPaths.fromDeno().summary() });
}

async function handlePalettes(): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const palettes = await new PaletteLoader().list(paths.palettesDir());
  return jsonResponse({ ok: true, palettes });
}

async function handleProfiles(): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const loader = new ProfileLoader();
  const summaries = await loader.list(paths.profilesDir());
  const profiles = [];

  for (const summary of summaries) {
    const entry = await loader.inspect(paths.profilesDir(), summary.name);

    if (isCompositionProfile(entry)) {
      const sourceProfileName = entry.currentProfile ?? entry.runs[0]?.profile ?? entry.name;
      const sourceEntry = await loader.inspect(paths.profilesDir(), sourceProfileName);
      const sourceProfile = isCompositionProfile(sourceEntry) ? null : sourceEntry;
      const bloom = await readJsonFile(paths.bloomFile(sourceProfileName)) as Record<string, unknown> | null;

      const targets = [];
      for (const run of entry.runs) {
        const runEntry = await loader.inspect(paths.profilesDir(), run.profile);
        if (isCompositionProfile(runEntry)) continue;
        for (const [target, recipe] of Object.entries(runEntry.targets)) {
          const spore = await readJsonFile(paths.sporeFile(run.profile, target)) as Record<string, unknown> | null;
          targets.push({
            name: target,
            recipe,
            profile: run.profile,
            sownAt: typeof spore?.["generatedAt"] === "string" ? spore["generatedAt"] : undefined,
          });
        }
      }

      profiles.push({
        name: entry.name,
        type: "composition",
        basePalette: sourceProfile?.basePalette ?? "",
        mood: sourceProfile?.mood ?? "",
        source: sourceProfile?.source.type ?? "matugen",
        bloomAt: typeof bloom?.["generatedAt"] === "string" ? bloom["generatedAt"] : undefined,
        bloomPath: paths.bloomFile(sourceProfileName),
        currentProfile: entry.currentProfile,
        runs: entry.runs.map((r) => ({ profile: r.profile, targets: r.targets, exclude: r.exclude })),
        targets,
      });
      continue;
    }

    const bloom = await readJsonFile(paths.bloomFile(entry.name)) as Record<string, unknown> | null;
    const targets = [];

    for (const [target, recipe] of Object.entries(entry.targets)) {
      const spore = await readJsonFile(paths.sporeFile(entry.name, target)) as Record<string, unknown> | null;
      targets.push({
        name: target,
        recipe,
        profile: entry.name,
        sownAt: typeof spore?.["generatedAt"] === "string" ? spore["generatedAt"] : undefined,
      });
    }

    profiles.push({
      name: entry.name,
      type: "profile",
      basePalette: entry.basePalette,
      mood: entry.mood,
      source: entry.source.type,
      sourcePath: entry.source.type === "matugen" ? entry.source.colorsPath : undefined,
      bloomAt: typeof bloom?.["generatedAt"] === "string" ? bloom["generatedAt"] : undefined,
      bloomPath: paths.bloomFile(entry.name),
      targets,
    });
  }

  return jsonResponse({ profiles });
}

async function handleRecipes(url: URL): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const loader = new RecipeLoader();
  const target = url.searchParams.get("target") ?? undefined;
  const summaries = await loader.list(paths.recipesDir(), target);

  // build usage map from all profiles
  const profileLoader = new ProfileLoader();
  const profileSummaries = await profileLoader.list(paths.profilesDir());
  const usage: Record<string, Array<{ profile: string; target: string; composition?: string }>> = {};

  for (const ps of profileSummaries) {
    const entry = await profileLoader.inspect(paths.profilesDir(), ps.name);
    if (isCompositionProfile(entry)) {
      for (const run of entry.runs) {
        const runEntry = await profileLoader.inspect(paths.profilesDir(), run.profile);
        if (isCompositionProfile(runEntry)) continue;
        for (const [t, r] of Object.entries(runEntry.targets)) {
          const id = `${t}/${r}`;
          usage[id] = [...(usage[id] ?? []), { profile: run.profile, target: t, composition: entry.name }];
        }
      }
    } else {
      for (const [t, r] of Object.entries(entry.targets)) {
        const id = `${t}/${r}`;
        usage[id] = [...(usage[id] ?? []), { profile: entry.name, target: t }];
      }
    }
  }

  const recipes = await Promise.all(summaries.map(async (s) => {
    const recipe = await loader.inspect(paths.recipesDir(), s.id);
    return {
      id: s.id,
      name: s.name,
      target: s.target,
      path: s.path,
      tokenCount: s.tokenCount,
      basePalette: s.basePalette,
      usages: usage[s.id] ?? [],
      raw: recipe,
    };
  }));

  return jsonResponse({ recipes });
}

async function handleBlooms(): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const bloomsDir = paths.bloomsDir();
  const result: Record<string, unknown> = {};

  try {
    for await (const entry of Deno.readDir(bloomsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const profile = entry.name.replace(/\.json$/, "");
        const data = await readJsonFile(`${bloomsDir}/${entry.name}`);
        if (data !== null) result[profile] = data;
      }
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }

  return jsonResponse(result);
}

async function handleBloomPreview(profileName: string): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const profileLoader = new ProfileLoader();
  const entry = await profileLoader.inspect(paths.profilesDir(), profileName);

  if (isCompositionProfile(entry)) {
    const sourceProfileName = entry.currentProfile ?? entry.runs[0]?.profile ?? profileName;
    const data = await buildBloomPreview(paths, sourceProfileName) as Record<string, unknown>;
    return jsonResponse({ ...data, profile: profileName });
  }

  return jsonResponse(await buildBloomPreview(paths, profileName));
}

async function buildBloomPreview(
  paths: BloomPaths,
  profileName: string,
): Promise<unknown> {
  const profileLoader = new ProfileLoader();
  const paletteLoader = new PaletteLoader();
  const moodLoader = new MoodLoader();

  const entry = await profileLoader.inspect(paths.profilesDir(), profileName);
  if (isCompositionProfile(entry)) {
    throw new Error(`Expected a normal profile, got composition: ${profileName}`);
  }

  const basePalette = await paletteLoader.inspect(paths.palettesDir(), entry.basePalette);
  const sourcePalette = await loadSourcePalette(entry);
  const mood = await moodLoader.inspect(paths.moodsDir(), entry.mood);
  const preview = new BloomGenerator().preview(basePalette, sourcePalette, mood, profileName);

  const colors: Record<string, Record<string, string>> = {};
  for (const [group, tokens] of Object.entries(preview.colors)) {
    colors[group] = tokens as Record<string, string>;
  }

  return {
    profile: profileName,
    basePalette: entry.basePalette,
    mood: entry.mood,
    source: entry.source.type,
    generatedAt: preview.generatedAt,
    colors,
    rows: preview.rows,
  };
}

async function handlePipeline(profileName: string): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const profileLoader = new ProfileLoader();
  const entry = await profileLoader.inspect(paths.profilesDir(), profileName);

  if (isCompositionProfile(entry)) {
    return jsonResponse(await buildCompositionPipeline(paths, profileLoader, entry, profileName));
  }

  return jsonResponse(await buildPipeline(paths, profileName));
}

async function buildPipeline(paths: BloomPaths, profileName: string): Promise<unknown> {
  const profileLoader = new ProfileLoader();
  const paletteLoader = new PaletteLoader();
  const moodLoader = new MoodLoader();
  const recipeLoader = new RecipeLoader();

  const entry = await profileLoader.inspect(paths.profilesDir(), profileName) as Profile;
  const basePalette = await paletteLoader.inspect(paths.palettesDir(), entry.basePalette);
  const sourcePalette = await loadSourcePalette(entry);
  const mood = await moodLoader.inspect(paths.moodsDir(), entry.mood);
  const bloom = new BloomGenerator().generate(basePalette, sourcePalette, mood, profileName);

  const bloomColors: Record<string, Record<string, string>> = {};
  for (const [group, tokens] of Object.entries(bloom.colors)) {
    bloomColors[group] = tokens as Record<string, string>;
  }

  const targets: Record<string, unknown> = {};
  for (const [target, recipeName] of Object.entries(entry.targets)) {
    const recipe = await recipeLoader.inspect(paths.recipesDir(), `${target}/${recipeName}`);
    const targetBase = await paletteLoader.inspect(
      paths.palettesDir(),
      recipe.basePalette ?? entry.basePalette,
    );

    const tokens = Object.entries(recipe.tokens).map(([name, tr]) => {
      if ("bloom" in tr) {
        const [group, tokenName] = tr.bloom.split(".");
        const baseHex = bloomColors[group]?.[tokenName] ?? "#000000";
        const srcKey = tr.source ?? "(none)";
        const srcHex = tr.source ? (sourcePalette.colors[tr.source] ?? baseHex) : baseHex;
        const mix = tr.mix ?? 0;
        return {
          name,
          baseKey: `bloom:${tr.bloom}`,
          baseHex,
          srcKey,
          srcHex,
          mix,
          result: tr.source ? mixColors(baseHex, srcHex, mix) : baseHex,
        };
      }
      if ("source" in tr) {
        const baseHex = targetBase.colors[tr.base] ?? "#000000";
        const srcHex = sourcePalette.colors[tr.source] ?? baseHex;
        return {
          name,
          baseKey: `base:${tr.base}`,
          baseHex,
          srcKey: tr.source,
          srcHex,
          mix: tr.mix,
          result: mixColors(baseHex, srcHex, tr.mix),
        };
      }
      const baseHex = targetBase.colors[tr.base] ?? "#000000";
      return { name, baseKey: `base:${tr.base}`, baseHex, srcKey: "(none)", srcHex: baseHex, mix: 0, result: baseHex };
    });

    targets[target] = { recipe: recipeName, profile: profileName, basePalette: entry.basePalette, mood: entry.mood, source: entry.source.type, bloom: bloomColors, tokens };
  }

  return { profile: profileName, basePalette: entry.basePalette, mood: entry.mood, source: entry.source.type, bloom: bloomColors, targets };
}

async function buildCompositionPipeline(
  paths: BloomPaths,
  profileLoader: ProfileLoader,
  composition: CompositionProfile,
  profileName: string,
): Promise<unknown> {
  const sourceProfileName = composition.currentProfile ?? composition.runs[0]?.profile ?? profileName;
  const sourceData = await buildPipeline(paths, sourceProfileName) as Record<string, unknown>;
  const targets: Record<string, unknown> = {};

  for (const run of composition.runs) {
    const runEntry = await profileLoader.inspect(paths.profilesDir(), run.profile);
    if (isCompositionProfile(runEntry)) continue;
    const runData = await buildPipeline(paths, run.profile) as { targets: Record<string, unknown> };
    for (const [target, data] of Object.entries(runData.targets)) {
      targets[target] = data;
    }
  }

  return { ...sourceData, profile: profileName, targets };
}

async function handleDocs(): Promise<Response> {
  return jsonResponse({ defaultDoc: null, docs: [] });
}

async function handleRun(req: Request): Promise<Response> {
  const body = await req.json() as { action?: string; profile?: string; target?: string };
  const { action, profile, target } = body;

  if (!action || !profile || !["sow", "grow"].includes(action)) {
    return jsonResponse({ ok: false, error: "action must be 'sow' or 'grow', profile is required" }, 400);
  }

  const sporeTs = new URL("../cli/spore.ts", import.meta.url).pathname;
  const cmdArgs = [
    "run", "--allow-read", "--allow-write", "--allow-env", "--allow-run",
    sporeTs, action, profile,
    ...(target ? [target] : []),
  ];

  const cmd = new Deno.Command("deno", { args: cmdArgs, stdout: "piped", stderr: "piped" });
  const { code, stdout, stderr } = await cmd.output();

  return jsonResponse({
    ok: code === 0,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  });
}

async function serveFile(filePath: string, contentType: string): Promise<Response> {
  try {
    const body = await Deno.readFile(filePath);
    return new Response(body, { headers: { "Content-Type": contentType } });
  } catch {
    return new Response(`Not found: run 'deno task workbench:build' first`, { status: 404 });
  }
}

// --- Router ---

async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method === "POST" && url.pathname === "/api/run") {
    try { return await handleRun(req); }
    catch (err) { return jsonResponse({ ok: false, error: String(err) }, 500); }
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return await serveFile(`${UI_DIR}index.html`, "text/html; charset=utf-8");
    }
    if (url.pathname === "/main.js") {
      return await serveFile(`${UI_DIR}main.js`, "application/javascript");
    }
    if (url.pathname === "/style.css") {
      return await serveFile(`${UI_DIR}style.css`, "text/css");
    }

    if (url.pathname === "/api/status") return await handleStatus();
    if (url.pathname === "/api/palettes") return await handlePalettes();
    if (url.pathname === "/api/profiles") return await handleProfiles();
    if (url.pathname === "/api/recipes") return await handleRecipes(url);
    if (url.pathname === "/api/blooms") return await handleBlooms();
    if (url.pathname === "/api/docs") return await handleDocs();

    const pipelineMatch = url.pathname.match(/^\/api\/pipeline\/(.+)$/);
    if (pipelineMatch) return await handlePipeline(decodeURIComponent(pipelineMatch[1]));

    const previewMatch = url.pathname.match(/^\/api\/bloom-preview\/(.+)$/);
    if (previewMatch) return await handleBloomPreview(decodeURIComponent(previewMatch[1]));

    return notFound(url.pathname);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error: message }, 500);
  }
}

console.log(`Workbench listening on http://${HOST}:${PORT}`);
console.log(`  UI  http://${HOST}:${PORT}/`);

Deno.serve({ hostname: HOST, port: PORT }, router);
