import { createServer }            from 'node:http';
import { watch }                   from 'node:fs';
import { readdir, readFile }       from 'node:fs/promises';
import { join }                    from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { BloomGenerator }          from '../core/BloomGenerator.js';
import { mixColors }               from '../core/Mixer.js';
import { readMood, readPalette, readProfile, readRecipe } from '../node/fs.js';
import { loadBasePalette, loadSourcePalette } from '../node/loader.js';
import { CACHE_DIR, DATA_DIR, Paths } from '../node/paths.js';

const PORT       = 7865;
const BLOOMS_DIR = join(CACHE_DIR, 'blooms');
const bloomGen   = new BloomGenerator();

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

// --- Inspect data ---

interface TokenRow {
    name:    string;
    baseKey: string;
    baseHex: string;
    srcKey:  string;
    srcHex:  string;
    mix:     number;
    result:  string;
}

interface TargetInspect {
    recipe: string;
    tokens: TokenRow[];
}

export interface InspectData {
    profile:     string;
    basePalette: string;
    mood:        string;
    source:      string;
    bloom:       Record<string, Record<string, string>>;
    targets:     Record<string, TargetInspect>;
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
    const profile       = await readProfile(Paths.profile(profileName));
    const profileBase   = await readPalette(Paths.palette(profile.basePalette));
    const sourcePalette = await loadSourcePalette(profile);
    const mood          = await readMood(Paths.mood(profile.mood));
    const bloom         = bloomGen.generate(profileBase, sourcePalette, mood, profileName);

    const bloomColors: Record<string, Record<string, string>> = {};
    for (const [group, tokens] of Object.entries(bloom.colors)) {
        bloomColors[group] = tokens as Record<string, string>;
    }

    const targets: Record<string, TargetInspect> = {};
    for (const [target, recipeName] of Object.entries(profile.targets)) {
        const recipe     = await readRecipe(Paths.recipe(target, recipeName));
        const targetBase = await loadBasePalette(profile, recipe);

        const tokenEntries = Object.entries(recipe.tokens);
        const pfx      = commonPrefix(tokenEntries.map(([n]) => n));
        const stripPfx = pfx.length > 3 ? pfx : '';

        targets[target] = {
            recipe: recipeName,
            tokens: tokenEntries.map(([name, tr]) => {
                const displayName = stripPfx
                    ? name.slice(stripPfx.length).replace(/__+$/, '').toLowerCase()
                    : name;
                if ('bloom' in tr) {
                    const baseHex = bloomValue(bloomColors, tr.bloom) ?? '#000000';
                    const srcKey  = tr.source ?? '(none)';
                    const srcHex  = tr.source !== undefined ? sourcePalette.colors[tr.source] ?? baseHex : baseHex;
                    const mix     = tr.mix ?? 0;
                    return {
                        name:    displayName,
                        baseKey: `bloom:${tr.bloom}`,
                        baseHex,
                        srcKey,
                        srcHex,
                        mix,
                        result:  tr.source !== undefined ? mixColors(baseHex, srcHex, mix) : baseHex,
                    };
                } else {
                    const baseHex = targetBase.colors[tr.base] ?? '#000000';
                    const srcHex  = sourcePalette.colors[tr.source] ?? baseHex;
                    return {
                        name:    displayName,
                        baseKey: tr.base,
                        baseHex,
                        srcKey:  tr.source,
                        srcHex,
                        mix:     tr.mix,
                        result:  mixColors(baseHex, srcHex, tr.mix),
                    };
                }
            }),
        };
    }

    return {
        profile:     profileName,
        basePalette: profile.basePalette,
        mood:        profile.mood,
        source:      profile.source.type,
        bloom:       bloomColors,
        targets,
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

    if (req.method === 'GET' && req.url === '/api/blooms') {
        const blooms = await loadBlooms();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(blooms));
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
    const blooms = await loadBlooms();
    ws.send(JSON.stringify({ type: 'blooms', blooms }));
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
