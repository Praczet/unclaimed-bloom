import { createServer, type IncomingMessage } from 'node:http';
import { execFile } from 'node:child_process';
import { watch } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { WebSocketServer, WebSocket } from 'ws';
import { BloomGenerator } from '../core/BloomGenerator.js';
import { mixColors } from '../core/Mixer.js';
import { readMood, readPalette, readProfile, readRecipe } from '../node/fs.js';
import { loadBasePalette, loadSourcePalette } from '../node/loader.js';
import { CACHE_DIR, DATA_DIR, Paths } from '../node/paths.js';
import type { Profile } from '../core/types.js';

const PORT = Number(process.env['UB_WORKBENCH_PORT'] ?? 7865);
const BLOOMS_DIR = join(CACHE_DIR, 'blooms');
const bloomGen = new BloomGenerator();
const execFileAsync = promisify(execFile);

// --- Bloom loading ---

async function loadBlooms(): Promise<Record<string, unknown>> {
  let files: string[];
  try { files = await readdir(BLOOMS_DIR); } catch { return {}; }
  const out: Record<string, unknown> = {};
  for (const f of files.filter(f => f.endsWith('.json'))) {
    try {
      out[f.replace('.json', '')] = JSON.parse(await readFile(join(BLOOMS_DIR, f), 'utf8'));
    } catch { /* skip malformed */ }
  }
  return out;
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

async function readTextFile(path: string): Promise<string | undefined> {
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch {
    return undefined;
  }
}

interface TargetStatus {
  name: string;
  recipe: string;
  sownAt?: string;
  grownAt?: string;
  status?: string;
}

interface ProfileStatus {
  name: string;
  basePalette: string;
  mood: string;
  source: string;
  bloomAt?: string;
  targets: TargetStatus[];
}

interface ProfilesResponse {
  currentProfile?: string;
  profiles: ProfileStatus[];
}

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

interface BloomPreviewResponse {
  profile: string;
  basePalette: string;
  mood: string;
  source: string;
  generatedAt: string;
  colors: Record<string, Record<string, string>>;
  rows: BloomPreviewRow[];
}

async function loadProfiles(): Promise<ProfilesResponse> {
  let files: string[];
  try {
    files = (await readdir(join(DATA_DIR, 'profiles'))).filter(f => f.endsWith('.json')).sort();
  } catch {
    return { profiles: [] };
  }

  const profiles: ProfileStatus[] = [];
  for (const file of files) {
    const profileName = file.slice(0, -5);
    let profile: Profile;
    try {
      profile = await readProfile(Paths.profile(profileName));
    } catch {
      continue;
    }

    const bloom = await readJsonFile<Record<string, unknown>>(Paths.bloom(profileName));
    const bloomAt = typeof bloom?.['generatedAt'] === 'string' ? bloom['generatedAt'] : undefined;
    const targets: TargetStatus[] = [];

    for (const [target, recipe] of Object.entries(profile.targets)) {
      const spore = await readJsonFile<Record<string, unknown>>(Paths.spore(profileName, target));
      const report = await readJsonFile<Record<string, unknown>>(Paths.report(profileName, target));
      const sownAt = typeof spore?.['generatedAt'] === 'string' ? spore['generatedAt'] : undefined;
      const grownAt = typeof report?.['finishedAt'] === 'string' ? report['finishedAt'] : undefined;
      const status = typeof report?.['status'] === 'string' ? report['status'] : undefined;
      targets.push({ name: target, recipe, sownAt, grownAt, status });
    }

    profiles.push({
      name: profileName,
      basePalette: profile.basePalette,
      mood: profile.mood,
      source: profile.source.type,
      bloomAt,
      targets,
    });
  }

  return {
    currentProfile: await readTextFile(Paths.currentProfile()),
    profiles,
  };
}

interface DocsIndexItem {
  id: string;
  title: string;
}

interface DocsIndexResponse {
  defaultDoc: string;
  docs: DocsIndexItem[];
}

function docTitle(id: string): string {
  if (id === 'README.md') return 'README';
  if (id === 'help.md') return 'Live Help';
  return id;
}

async function loadDocsIndex(): Promise<DocsIndexResponse> {
  const docs = ['README.md', 'help.md'].map(id => ({
    id,
    title: docTitle(id),
  }));

  return { defaultDoc: 'README.md', docs };
}

function fmtMaybe(iso: string | undefined): string {
  return iso ?? 'not yet';
}

async function buildHelpMarkdown(): Promise<string> {
  const data = await loadProfiles();
  const current = data.currentProfile ?? data.profiles[0]?.name ?? 'daily';
  const currentProfile = data.profiles.find(p => p.name === current) ?? data.profiles[0];
  const currentTarget = currentProfile?.targets[0]?.name ?? 'ghostty';

  const lines: string[] = [
    '# Live Help',
    '',
    'Generated from the current Unclaimed Bloom repo data and cache state.',
    '',
    '## Quick Commands',
    '',
    '```bash',
    `spore sow ${current}`,
    `spore grow ${current}`,
    `spore inspect ${current} ${currentTarget}`,
    `spore status ${current}`,
    '```',
    '',
    '## Profile Status',
    '',
  ];

  if (data.profiles.length === 0) {
    lines.push('No profiles found.');
  } else {
    const sortedProfiles = [...data.profiles].sort((a, b) => {
      if (a.name === data.currentProfile) return -1;
      if (b.name === data.currentProfile) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const profile of sortedProfiles) {
      const isCurrent = profile.name === data.currentProfile;
      const marker = isCurrent ? ' [current]' : '';
      lines.push(isCurrent ? ':::profile open' : ':::profile');
      lines.push(`### ${profile.name}${marker}`);
      lines.push('');
      lines.push(`- base palette: \`${profile.basePalette}\``);
      lines.push(`- mood: \`${profile.mood}\``);
      lines.push(`- source: \`${profile.source}\``);
      lines.push(`- bloom: \`${fmtMaybe(profile.bloomAt)}\``);
      lines.push('');
      lines.push('| target | recipe | sown | grown | status | actions |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      for (const target of profile.targets) {
        lines.push(
          `| \`${target.name}\` | \`${target.recipe}\` | ${fmtMaybe(target.sownAt)} | ` +
          `${fmtMaybe(target.grownAt)} | ${target.status ? `\`${target.status}\`` : ''} | ` +
          `::actions:${profile.name}:${target.name}:: |`,
        );
      }
      lines.push('');
      lines.push(':::');
      lines.push('');
    }
  }

  lines.push('## Common Flows');
  lines.push('');
  lines.push('Generate cache only:');
  lines.push('');
  lines.push('```bash');
  lines.push(`spore sow ${current}`);
  lines.push('```');
  lines.push('');
  lines.push('Apply cached output:');
  lines.push('');
  lines.push('```bash');
  lines.push(`spore grow ${current}`);
  lines.push('```');
  lines.push('');
  lines.push('Work on one target without waking the whole desktop:');
  lines.push('');
  lines.push('```bash');
  lines.push(`spore sow ${current} ${currentTarget}`);
  lines.push(`spore inspect ${current} ${currentTarget}`);
  lines.push(`spore grow ${current} ${currentTarget}`);
  lines.push('```');
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- `sow` writes bloom/spore cache and updates `current-profile`.');
  lines.push('- `grow` writes real target config files and may trigger reload hooks.');
  lines.push('- Use the target selector above when you want one target only.');

  return lines.join('\n');
}

async function readDoc(id: string): Promise<{ id: string; title: string; markdown: string }> {
  const index = await loadDocsIndex();
  if (!index.docs.some(d => d.id === id)) {
    throw new Error(`Unknown doc "${id}".`);
  }

  if (id === 'help.md') {
    return {
      id,
      title: docTitle(id),
      markdown: await buildHelpMarkdown(),
    };
  }

  return {
    id,
    title: docTitle(id),
    markdown: await readFile(join(DATA_DIR, 'README.md'), 'utf8'),
  };
}

async function readRequestJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8').trim();
  return body === '' ? {} : JSON.parse(body);
}

interface RunRequest {
  action?: string;
  profile?: string;
  target?: string;
}

function isRunRequest(value: unknown): value is RunRequest {
  return typeof value === 'object' && value !== null;
}

async function runSporeAction(body: unknown): Promise<Record<string, unknown>> {
  if (!isRunRequest(body)) {
    throw new Error('Expected JSON object request body.');
  }

  const action = body.action;
  if (action !== 'sow' && action !== 'grow') {
    throw new Error('Workbench only supports action "sow" or "grow".');
  }

  if (typeof body.profile !== 'string' || body.profile.trim() === '') {
    throw new Error('Missing profile name.');
  }

  const profile = await readProfile(Paths.profile(body.profile));
  const args = [action, body.profile];

  if (body.target !== undefined && body.target !== '') {
    if (typeof body.target !== 'string') {
      throw new Error('Target must be a string.');
    }
    if (!(body.target in profile.targets)) {
      throw new Error(`Target "${body.target}" is not in profile "${body.profile}".`);
    }
    args.push(body.target);
  }

  const startedAt = new Date().toISOString();
  const childEnv = { ...process.env };
  delete childEnv['FORCE_COLOR'];

  try {
    const result = await execFileAsync(Paths.script('spore'), args, {
      cwd: DATA_DIR,
      env: childEnv,
      maxBuffer: 1024 * 1024 * 20,
    });
    const finishedAt = new Date().toISOString();
    return {
      ok: true,
      action,
      profile: body.profile,
      target: body.target ?? '',
      startedAt,
      finishedAt,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    return {
      ok: false,
      action,
      profile: body.profile,
      target: body.target ?? '',
      startedAt,
      finishedAt,
      exitCode: e.code ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? String(err),
    };
  }
}

// --- Inspect data ---

interface TokenRow {
  name: string;
  baseKey: string;
  baseHex: string;
  srcKey: string;
  srcHex: string;
  mix: number;
  result: string;
}

interface TargetInspect {
  recipe: string;
  tokens: TokenRow[];
}

export interface InspectData {
  profile: string;
  basePalette: string;
  mood: string;
  source: string;
  bloom: Record<string, Record<string, string>>;
  targets: Record<string, TargetInspect>;
}

function commonPrefix(strs: string[]): string {
  if (strs.length === 0) return '';
  let pfx = strs[0]!;
  for (const s of strs.slice(1)) {
    while (!s.startsWith(pfx)) pfx = pfx.slice(0, -1);
    if (pfx === '') return '';
  }
  return pfx;
}

function bloomValue(colors: Record<string, Record<string, string>>, path: string): string | undefined {
  const [group, token] = path.split('.');
  if (group === undefined || token === undefined) return undefined;
  return colors[group]?.[token];
}

async function buildInspectData(profileName: string): Promise<InspectData> {
  const profile = await readProfile(Paths.profile(profileName));
  const profileBase = await readPalette(Paths.palette(profile.basePalette));
  const sourcePalette = await loadSourcePalette(profile);
  const mood = await readMood(Paths.mood(profile.mood));
  const bloom = bloomGen.generate(profileBase, sourcePalette, mood, profileName);

  const bloomColors: Record<string, Record<string, string>> = {};
  for (const [group, tokens] of Object.entries(bloom.colors)) {
    bloomColors[group] = tokens as Record<string, string>;
  }

  const targets: Record<string, TargetInspect> = {};
  for (const [target, recipeName] of Object.entries(profile.targets)) {
    const recipe = await readRecipe(Paths.recipe(target, recipeName));
    const targetBase = await loadBasePalette(profile, recipe);

    const tokenEntries = Object.entries(recipe.tokens);
    const pfx = commonPrefix(tokenEntries.map(([n]) => n));
    const stripPfx = pfx.length > 3 ? pfx : '';

    targets[target] = {
      recipe: recipeName,
      tokens: tokenEntries.map(([name, tr]) => {
        const displayName = stripPfx
          ? name.slice(stripPfx.length).replace(/__+$/, '').toLowerCase()
          : name;
        if ('bloom' in tr) {
          const baseHex = bloomValue(bloomColors, tr.bloom) ?? '#000000';
          const srcKey = tr.source ?? '(none)';
          const srcHex = tr.source !== undefined ? sourcePalette.colors[tr.source] ?? baseHex : baseHex;
          const mix = tr.mix ?? 0;
          return {
            name: displayName,
            baseKey: `bloom:${tr.bloom}`,
            baseHex,
            srcKey,
            srcHex,
            mix,
            result: tr.source !== undefined ? mixColors(baseHex, srcHex, mix) : baseHex,
          };
        } else {
          const baseHex = targetBase.colors[tr.base] ?? '#000000';
          if ('source' in tr && 'mix' in tr) {
            const srcHex = sourcePalette.colors[tr.source] ?? baseHex;
            return {
              name: displayName,
              baseKey: `base:${tr.base}`,
              baseHex,
              srcKey: tr.source,
              srcHex,
              mix: tr.mix,
              result: mixColors(baseHex, srcHex, tr.mix),
            };
          }
          return {
            name: displayName,
            baseKey: `base:${tr.base}`,
            baseHex,
            srcKey: '(none)',
            srcHex: baseHex,
            mix: 0,
            result: baseHex,
          };
        }
      }),
    };
  }

  return {
    profile: profileName,
    basePalette: profile.basePalette,
    mood: profile.mood,
    source: profile.source.type,
    bloom: bloomColors,
    targets,
  };
}

async function buildBloomPreviewData(profileName: string): Promise<BloomPreviewResponse> {
  const profile = await readProfile(Paths.profile(profileName));
  const profileBase = await readPalette(Paths.palette(profile.basePalette));
  const sourcePalette = await loadSourcePalette(profile);
  const mood = await readMood(Paths.mood(profile.mood));
  const preview = bloomGen.preview(profileBase, sourcePalette, mood, profileName);

  const colors: Record<string, Record<string, string>> = {};
  for (const [group, tokens] of Object.entries(preview.colors)) {
    colors[group] = tokens as Record<string, string>;
  }

  return {
    profile: profileName,
    basePalette: profile.basePalette,
    mood: profile.mood,
    source: profile.source.type,
    generatedAt: preview.generatedAt,
    colors,
    rows: preview.rows,
  };
}

// --- WebSocket broadcast ---

function broadcast(clients: Set<WebSocket>, payload: unknown) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

// --- HTTP server ---

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/api/blooms') {
    const blooms = await loadBlooms();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(blooms));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/profiles') {
    const profiles = await loadProfiles();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(profiles));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/docs') {
    const docs = await loadDocsIndex();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(docs));
    return;
  }

  const docMatch = req.url?.match(/^\/api\/docs\/(.+)$/);
  if (req.method === 'GET' && docMatch) {
    try {
      const doc = await readDoc(decodeURIComponent(docMatch[1]!));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(doc));
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  const inspectMatch = req.url?.match(/^\/api\/inspect\/(.+)$/);
  if (req.method === 'GET' && inspectMatch) {
    const profileName = decodeURIComponent(inspectMatch[1]!);
    try {
      const data = await buildInspectData(profileName);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  const bloomPreviewMatch = req.url?.match(/^\/api\/bloom-preview\/(.+)$/);
  if (req.method === 'GET' && bloomPreviewMatch) {
    const profileName = decodeURIComponent(bloomPreviewMatch[1]!);
    try {
      const data = await buildBloomPreviewData(profileName);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/run') {
    try {
      const result = await runSporeAction(await readRequestJson(req));
      const [blooms, profiles] = await Promise.all([loadBlooms(), loadProfiles()]);
      broadcast(wss.clients, { type: 'blooms', blooms });
      broadcast(wss.clients, { type: 'profiles', profiles });
      res.writeHead(result['ok'] === true ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...result, profiles, blooms }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  // notify endpoint: trigger workbench to reload and broadcast current state
  if (req.method === 'POST' && req.url === '/api/notify') {
    try {
      const body = await readRequestJson(req).catch(() => ({}));
      const [blooms, profiles] = await Promise.all([loadBlooms(), loadProfiles()]);
      broadcast(wss.clients, { type: 'blooms', blooms });
      broadcast(wss.clients, { type: 'profiles', profiles });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, body }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

// --- WebSocket ---

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

wss.on('connection', async ws => {
  const [blooms, profiles] = await Promise.all([loadBlooms(), loadProfiles()]);
  ws.send(JSON.stringify({ type: 'blooms', blooms }));
  ws.send(JSON.stringify({ type: 'profiles', profiles }));
});

// Watch blooms dir — debounced broadcast on change
let debounce: ReturnType<typeof setTimeout> | undefined;
try {
  watch(BLOOMS_DIR, { persistent: false }, () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const blooms = await loadBlooms();
      broadcast(wss.clients, { type: 'blooms', blooms });
    }, 150);
  });
} catch {
  console.warn(`Could not watch ${BLOOMS_DIR} — live updates disabled`);
}

server.listen(PORT, () => {
  console.log(`workbench server  http://localhost:${PORT}`);
  console.log(`data dir          ${DATA_DIR}`);
  console.log(`blooms dir        ${BLOOMS_DIR}`);
});
