type ColorGroup = Record<string, string>;

interface Bloom {
    profile:     string;
    generatedAt: string;
    colors:      Record<string, ColorGroup>;
}

type Blooms = Record<string, Bloom>;

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

interface InspectData {
    profile:     string;
    basePalette: string;
    mood:        string;
    source:      string;
    bloom:       Record<string, Record<string, string>>;
    targets:     Record<string, TargetInspect>;
}

const GROUP_ORDER = ['surface', 'text', 'accent', 'state', 'border', 'selection'];

let blooms:      Blooms = {};
let active       = '';
let view: 'bloom' | 'inspect' = 'bloom';
let activeTarget = '';
let inspectCache: Record<string, InspectData> = {};

const tabsEl    = document.getElementById('profile-tabs')!;
const contentEl = document.getElementById('content')!;
const indicator = document.getElementById('indicator')!;

// --- View toggle ---

document.querySelectorAll<HTMLButtonElement>('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        view = btn.dataset['view'] as 'bloom' | 'inspect';
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
    });
});

// --- Tabs ---

function renderTabs() {
    tabsEl.innerHTML = Object.keys(blooms)
        .map(p => `<button class="tab${p === active ? ' active' : ''}" data-p="${p}">${p}</button>`)
        .join('');
    tabsEl.querySelectorAll<HTMLButtonElement>('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            active = btn.dataset['p']!;
            renderTabs();
            render();
        });
    });
}

// --- Bloom view ---

function renderBloom() {
    const bloom = blooms[active];
    if (!bloom) { contentEl.innerHTML = '<p class="empty">No bloom data.</p>'; return; }

    const groups = GROUP_ORDER.filter(g => g in bloom.colors);
    contentEl.innerHTML = groups.map(group => {
        const tokens = bloom.colors[group] ?? {};
        const chips = Object.entries(tokens).map(([name, hex]) => `
            <div class="swatch">
                <div class="swatch-chip" style="background:${hex}"></div>
                <div class="swatch-label">
                    <span class="swatch-name" title="${name}">${name}</span>
                    <span class="swatch-hex">${hex}</span>
                </div>
            </div>`).join('');
        return `<section class="group"><h2>${group}</h2><div class="swatch-row">${chips}</div></section>`;
    }).join('');
}

// --- Inspect view ---

function chip(hex: string): string {
    return `<span class="mini-chip" style="background:${hex}"></span>`;
}

function renderTargetTabs(data: InspectData): string {
    const targets = Object.keys(data.targets);
    if (!activeTarget || !(activeTarget in data.targets)) {
        activeTarget = targets[0] ?? '';
    }

    return `
        <div class="target-tabs">
            ${targets.map(target => `
                <button class="target-tab${target === activeTarget ? ' active' : ''}" data-target="${target}">
                    ${target}
                </button>`).join('')}
        </div>`;
}

function bindTargetTabs() {
    contentEl.querySelectorAll<HTMLButtonElement>('.target-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTarget = btn.dataset['target'] ?? '';
            renderInspect();
        });
    });
}

function renderTokenRow(t: TokenRow): string {
    return `
        <div class="token-row">
            <span class="col-name" title="${t.name}">${t.name}</span>
            <span class="col-base" title="${t.baseKey}">
                ${chip(t.baseHex)}
                <span class="hex">${t.baseHex}</span>
                <span class="key">${t.baseKey}</span>
            </span>
            <span class="col-src" title="${t.srcKey}">
                ${chip(t.srcHex)}
                <span class="hex">${t.srcHex}</span>
                <span class="key">${t.srcKey}</span>
            </span>
            <span class="col-mix">${t.mix.toFixed(2)}</span>
            <span class="col-result">
                ${chip(t.result)}
                <span class="hex">${t.result}</span>
            </span>
        </div>`;
}

function renderInspect() {
    const data = inspectCache[active];
    if (!data) {
        contentEl.innerHTML = '<p class="empty">Loading inspect data…</p>';
        fetchInspect(active);
        return;
    }

    const meta = `
        <div class="inspect-meta">
            <span class="meta-item"><span class="meta-key">palette</span> ${data.basePalette}</span>
            <span class="meta-sep">·</span>
            <span class="meta-item"><span class="meta-key">mood</span> ${data.mood}</span>
            <span class="meta-sep">·</span>
            <span class="meta-item"><span class="meta-key">source</span> ${data.source}</span>
        </div>`;

    const targetTabs = renderTargetTabs(data);
    const target = activeTarget;
    const targetInspect = data.targets[target];
    const targetSection = targetInspect ? `
        <section class="group inspect-target">
            <div class="target-heading">
                <h2>${target} <span class="recipe-name">${targetInspect.recipe}</span></h2>
                <span class="token-count">${targetInspect.tokens.length} tokens</span>
            </div>
            <div class="token-table">
                <div class="token-header">
                    <span class="col-name">token</span>
                    <span class="col-base">bloom</span>
                    <span class="col-src">source tint</span>
                    <span class="col-mix">mix</span>
                    <span class="col-result">result</span>
                </div>
                ${targetInspect.tokens.map(renderTokenRow).join('')}
            </div>
        </section>` : '<p class="empty">No target selected.</p>';

    const bloomSection = `
        <section class="group inspect-bloom">
            <h2>bloom</h2>
            ${Object.entries(data.bloom).map(([group, tokens]) => `
                <div class="bloom-group">
                    <span class="bloom-group-name">${group}</span>
                    <div class="bloom-tokens">
                        ${Object.entries(tokens).map(([name, hex]) => `
                            <span class="bloom-token">
                                ${chip(hex)}
                                <span class="bloom-token-name">${name}</span>
                                <span class="swatch-hex">${hex}</span>
                            </span>`).join('')}
                    </div>
                </div>`).join('')}
        </section>`;

    contentEl.innerHTML = meta + targetTabs + targetSection + bloomSection;
    bindTargetTabs();
}

async function fetchInspect(profileName: string) {
    try {
        const res = await fetch(`/api/inspect/${encodeURIComponent(profileName)}`);
        if (!res.ok) throw new Error(`server returned ${res.status}`);
        const data = await res.json() as InspectData;
        inspectCache[profileName] = data;
        if (active === profileName && view === 'inspect') renderInspect();
    } catch (err) {
        contentEl.innerHTML = `<p class="empty">Could not load inspect data: ${err instanceof Error ? err.message : String(err)}</p>`;
    }
}

// --- Render dispatcher ---

function render() {
    if (view === 'bloom') {
        renderBloom();
    } else {
        renderInspect();
    }
}

function applyBlooms(data: Blooms) {
    blooms = data;
    inspectCache = {}; // blooms changed → inspect data stale
    if (!active || !(active in blooms)) active = Object.keys(blooms)[0] ?? '';
    activeTarget = '';
    renderTabs();
    render();
    indicator.classList.add('pulse');
    setTimeout(() => indicator.classList.remove('pulse'), 600);
}

// --- WebSocket ---

function connect() {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen    = () => { indicator.className = 'indicator connected'; };
    ws.onclose   = () => { indicator.className = 'indicator disconnected'; setTimeout(connect, 3000); };
    ws.onerror   = () => ws.close();
    ws.onmessage = e => {
        const msg = JSON.parse(e.data as string) as { type: string; blooms: Blooms };
        if (msg.type === 'blooms') applyBlooms(msg.blooms);
    };
}

fetch('/api/blooms')
    .then(r => r.json() as Promise<Blooms>)
    .then(applyBlooms)
    .catch(() => { contentEl.innerHTML = '<p class="empty">Could not reach workbench server on :7865</p>'; });

connect();
