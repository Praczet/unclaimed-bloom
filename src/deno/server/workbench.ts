import { BloomPaths } from "../core/paths/BloomPaths.ts";
import { PaletteLoader } from "../core/palettes/PaletteLoader.ts";
import { ProfileLoader } from "../core/profiles/ProfileLoader.ts";
import { RecipeLoader } from "../core/recipes/RecipeLoader.ts";

const PORT = 7865;
const HOST = "127.0.0.1";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function notFound(path: string): Response {
  return jsonResponse({ ok: false, error: `No route: ${path}` }, 404);
}

async function handleStatus(): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  return jsonResponse({ ok: true, status: paths.summary() });
}

async function handlePalettes(): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const loader = new PaletteLoader();
  const palettes = await loader.list(paths.palettesDir());
  return jsonResponse({ ok: true, palettes });
}

async function handleProfiles(): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const loader = new ProfileLoader();
  const profiles = await loader.list(paths.profilesDir());
  return jsonResponse({ ok: true, profiles });
}

async function handleRecipes(url: URL): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const loader = new RecipeLoader();
  const target = url.searchParams.get("target") ?? undefined;
  const recipes = await loader.list(paths.recipesDir(), target);
  return jsonResponse({ ok: true, target: target ?? null, recipes });
}

async function handleBloomsCurrent(): Promise<Response> {
  const paths = BloomPaths.fromDeno();
  const bloomsDir = paths.bloomsDir();
  const blooms: Array<{ profile: string; bloom: unknown }> = [];

  try {
    for await (const entry of Deno.readDir(bloomsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const profile = entry.name.replace(/\.json$/, "");
        try {
          const raw = await Deno.readTextFile(`${bloomsDir}/${entry.name}`);
          blooms.push({ profile, bloom: JSON.parse(raw) });
        } catch {
          blooms.push({ profile, bloom: null });
        }
      }
    }
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return jsonResponse({ ok: true, blooms: [] });
    }
    throw err;
  }

  blooms.sort((a, b) => a.profile.localeCompare(b.profile));
  return jsonResponse({ ok: true, blooms });
}

async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    if (url.pathname === "/api/status") return await handleStatus();
    if (url.pathname === "/api/palettes") return await handlePalettes();
    if (url.pathname === "/api/profiles") return await handleProfiles();
    if (url.pathname === "/api/recipes") return await handleRecipes(url);
    if (url.pathname === "/api/blooms/current") return await handleBloomsCurrent();
    return notFound(url.pathname);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error: message }, 500);
  }
}

console.log(`Workbench API listening on http://${HOST}:${PORT}`);
console.log(`  GET /api/status`);
console.log(`  GET /api/palettes`);
console.log(`  GET /api/profiles`);
console.log(`  GET /api/recipes[?target=<name>]`);
console.log(`  GET /api/blooms/current`);

Deno.serve({ hostname: HOST, port: PORT }, router);
