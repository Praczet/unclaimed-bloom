

let blooms: Blooms = {};
let profiles: ProfilesResponse = { profiles: [] };
let active = '';
let view: 'bloom' | 'inspect' | 'docs' = 'bloom';
let activeTarget = '';
let inspectCache: Record<string, InspectData> = {};
let actionTarget = '';
let isRunning = false;
let docsIndex: DocsIndexResponse = { defaultDoc: 'README.md', docs: [] };
let activeDoc = 'README.md';
let docCache: Record<string, DocResponse> = {};
let bloomPreviewCache: Record<string, BloomPreviewResponse> = {};
let useBloomUiPalette = window.localStorage.getItem('ub-use-bloom-ui-palette') === 'true';


/**
 * Preferred ordering of color groups for rendering and previews.
 *
 * - surface: base surface/background colors
 * - text: foreground and text tokens
 * - accent: accents, highlights and primary brand colors
 * - state: state indicators (success, warning, error)
 * - border: borders, dividers and separators
 * - selection: selection/active tokens
 *
 * Use this order when presenting groups in lists, tables, or previews to
 * ensure a consistent and predictable UI layout.
 */
const GROUP_ORDER = ['surface', 'text', 'accent', 'state', 'border', 'selection'];

const tabsEl = document.getElementById('profile-tabs')!;
const controlsEl = document.getElementById('controls')!;
const contentEl = document.getElementById('content')!;
const indicator = document.getElementById('indicator')!;
const runOutputEl = document.getElementById('run-output')!;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch] ?? ch));
}

function fmtTime(iso: string | undefined): string {
  if (!iso) return 'not yet';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function activeProfile(): ProfileStatus | undefined {
  return profiles.profiles.find(p => p.name === active);
}

function activeBloom(): Bloom | undefined {
  return blooms[active];
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string | undefined): Rgb | undefined {
  if (!hex) return undefined;
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return undefined;
  const value = Number.parseInt(match[1]!, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function toHex(rgb: Rgb): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function mixHex(base: string | undefined, tint: string | undefined, tintWeight: number): string | undefined {
  const a = parseHex(base);
  const b = parseHex(tint);
  if (!a || !b) return base ?? tint;
  const baseWeight = 1 - tintWeight;
  return toHex({
    r: a.r * baseWeight + b.r * tintWeight,
    g: a.g * baseWeight + b.g * tintWeight,
    b: a.b * baseWeight + b.b * tintWeight,
  });
}

function relativeLuminance(hex: string | undefined): number | undefined {
  const rgb = parseHex(hex);
  if (!rgb) return undefined;

  const convert = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * convert(rgb.r) + 0.7152 * convert(rgb.g) + 0.0722 * convert(rgb.b);
}

function contrastRatio(a: string | undefined, b: string | undefined): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === undefined || lb === undefined) return 0;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssRootColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readable(candidate: string | undefined, background: string | undefined, fallbackVar: string, minimum = 4.5): string {
  if (candidate && contrastRatio(candidate, background) >= minimum) return candidate;
  const fallback = cssRootColor(fallbackVar);
  if (fallback && contrastRatio(fallback, background) >= minimum) return fallback;
  return contrastRatio('#111827', background) >= minimum ? '#111827' : '#ffffff';
}

function firstReadable(candidates: Array<string | undefined>, background: string | undefined, minimum = 4.5): string {
  for (const candidate of candidates) {
    if (candidate && contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return contrastRatio('#111827', background) >= minimum ? '#111827' : '#ffffff';
}

function setBloomUiPalettePreference(enabled: boolean): void {
  useBloomUiPalette = enabled;
  window.localStorage.setItem('ub-use-bloom-ui-palette', String(enabled));
  applyBloomUiPalette();
  renderControls();
}

function applyBloomUiPalette(): void {
  const root = document.documentElement;
  const variables = [
    '--bg',
    '--surface',
    '--border',
    '--text',
    '--muted',
    '--accent',
    '--danger',
    '--warning',
    '--success',
    '--code',
    '--code-bg',
    '--surface-soft',
    '--surface-high',
    '--accent-soft',
    '--border-soft',
  ];

  const bloom = activeBloom();
  if (!useBloomUiPalette || !bloom) {
    root.removeAttribute('data-bloom-ui-palette');
    variables.forEach(name => root.style.removeProperty(name));
    return;
  }

  const colors = bloom.colors;
  const bg = colors.surface?.base;
  const surface = colors.surface?.raised;
  const surfaceHigh = colors.surface?.highest;
  const text = readable(colors.text?.primary, bg, '--text', 4.5);
  const muted = readable(colors.text?.muted, bg, '--muted', 3);
  const accent = readable(colors.accent?.primary, bg, '--accent', 3);
  const danger = readable(colors.state?.danger, bg, '--danger', 3);
  const warning = readable(colors.state?.warning, bg, '--warning', 3);
  const success = readable(colors.state?.success, bg, '--success', 3);
  const border = mixHex(colors.border?.subtle, text, 0.16);
  const codeBg = mixHex(surface, bg, 0.28);
  const code = firstReadable([
    colors.accent?.secondary,
    colors.accent?.primary,
    colors.text?.primary,
    cssRootColor('--code'),
  ], codeBg, 4.5);

  const mappings: Record<string, string | undefined> = {
    '--bg': bg,
    '--surface': surface,
    '--border': border,
    '--text': text,
    '--muted': muted,
    '--accent': accent,
    '--danger': danger,
    '--warning': warning,
    '--success': success,
    '--code': code,
    '--code-bg': codeBg,
    '--surface-soft': mixHex(bg, surface, 0.50),
    '--surface-high': mixHex(surface, surfaceHigh, 0.42),
    '--accent-soft': mixHex(surface, accent, 0.16),
    '--border-soft': mixHex(border, bg, 0.45),
  };

  root.setAttribute('data-bloom-ui-palette', active);
  for (const [variable, color] of Object.entries(mappings)) {
    if (color) root.style.setProperty(variable, color);
  }
}

// --- View toggle ---

document.querySelectorAll<HTMLButtonElement>('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    view = btn.dataset['view'] as 'bloom' | 'inspect' | 'docs';
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

// --- Tabs ---

function renderTabs() {
  const names = profiles.profiles.map(p => p.name);
  tabsEl.innerHTML = names
    .map(p => `<button class="tab${p === active ? ' active' : ''}" data-p="${p}">${p}</button>`)
    .join('');
  tabsEl.querySelectorAll<HTMLButtonElement>('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      active = btn.dataset['p']!;
      actionTarget = '';
      applyBloomUiPalette();
      renderTabs();
      renderControls();
      render();
    });
  });
}

// --- Controls ---

function renderControls() {
  const profile = activeProfile();
  if (!profile) {
    controlsEl.innerHTML = '<p class="empty-inline">No profiles found.</p>';
    return;
  }

  if (actionTarget !== '' && !profile.targets.some(t => t.name === actionTarget)) {
    actionTarget = '';
  }

  const selectedTarget = actionTarget;
  const targetOptions = [
    '<option value="">all targets</option>',
    ...profile.targets.map(t => `<option value="${esc(t.name)}"${t.name === selectedTarget ? ' selected' : ''}>${esc(t.name)}</option>`),
  ].join('');
  const target = profile.targets.find(t => t.name === selectedTarget);
  const targetMeta = target
    ? `target ${esc(target.name)} · recipe ${esc(target.recipe)} · sown ${esc(fmtTime(target.sownAt))} · grown ${esc(fmtTime(target.grownAt))}${target.status ? ` · ${esc(target.status)}` : ''}`
    : `${profile.targets.length} targets · bloom ${esc(fmtTime(profile.bloomAt))}`;
  const bloom = activeBloom();
  const palettePreview = bloom ? `
        <span class="ui-palette-preview" title="selected bloom preview">
            <span style="background:${esc(bloom.colors.surface?.base ?? '#000000')}"></span>
            <span style="background:${esc(bloom.colors.surface?.raised ?? '#000000')}"></span>
            <span style="background:${esc(bloom.colors.text?.primary ?? '#ffffff')}"></span>
            <span style="background:${esc(bloom.colors.accent?.primary ?? '#ffffff')}"></span>
            <span style="background:${esc(bloom.colors.state?.danger ?? '#ff0000')}"></span>
        </span>` : '';

  controlsEl.innerHTML = `
        <div class="profile-meta">
            <span><span class="meta-key">palette</span>${esc(profile.basePalette)}</span>
            <span><span class="meta-key">mood</span>${esc(profile.mood)}</span>
            <span><span class="meta-key">source</span>${esc(profile.source)}</span>
            ${profiles.currentProfile === profile.name ? '<span class="current-pill">current</span>' : ''}
            <label class="toggle-control" title="Theme the workbench from the selected profile bloom">
                <input id="bloom-ui-toggle" type="checkbox" ${useBloomUiPalette ? 'checked' : ''} ${activeBloom() ? '' : 'disabled'} />
                <span>Use Bloom palette</span>
            </label>
            ${palettePreview}
        </div>
        <div class="action-row">
            <select id="target-select" class="target-select" ${isRunning ? 'disabled' : ''}>${targetOptions}</select>
            <button id="sow-btn" class="action-btn" ${isRunning ? 'disabled' : ''}>sow</button>
            <button id="grow-btn" class="action-btn primary" ${isRunning ? 'disabled' : ''}>grow</button>
            <span class="target-meta">${targetMeta}</span>
        </div>`;

  controlsEl.querySelector<HTMLSelectElement>('#target-select')?.addEventListener('change', e => {
    actionTarget = (e.currentTarget as HTMLSelectElement).value;
    renderControls();
  });
  controlsEl.querySelector<HTMLInputElement>('#bloom-ui-toggle')?.addEventListener('change', e => {
    setBloomUiPalettePreference((e.currentTarget as HTMLInputElement).checked);
  });
  controlsEl.querySelector<HTMLButtonElement>('#sow-btn')?.addEventListener('click', () => runAction('sow'));
  controlsEl.querySelector<HTMLButtonElement>('#grow-btn')?.addEventListener('click', () => runAction('grow'));
}

function showRunOutput(title: string, text: string, ok: boolean): void {
  runOutputEl.hidden = false;
  runOutputEl.className = `run-output ${ok ? 'ok' : 'error'}`;
  runOutputEl.innerHTML = `
        <div class="run-output-title">${esc(title)}</div>
        <pre>${esc(text.trim() || '(no output)')}</pre>`;
}

async function runAction(action: 'sow' | 'grow') {
  const profile = activeProfile();
  if (!profile || isRunning) return;

  isRunning = true;
  renderControls();
  showRunOutput(`${action} ${profile.name}${actionTarget ? ` ${actionTarget}` : ''}`, 'running...', true);

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, profile: profile.name, target: actionTarget }),
    });
    const data = await res.json() as RunResponse;
    if (data.blooms) applyBlooms(data.blooms, false);
    if (data.profiles) applyProfiles(data.profiles, false);

    const output = [data.stdout ?? '', data.stderr ?? '', data.error ?? ''].filter(Boolean).join('\n');
    showRunOutput(`${action} ${profile.name}${actionTarget ? ` ${actionTarget}` : ''}`, output, data.ok && res.ok);
  } catch (err) {
    showRunOutput(`${action} ${profile.name}`, err instanceof Error ? err.message : String(err), false);
  } finally {
    isRunning = false;
    await refreshProfiles();
    renderControls();
  }
}

// --- Bloom view ---

function renderBloom() {
  const preview = bloomPreviewCache[active];
  if (!preview) {
    contentEl.innerHTML = '<p class="empty">Loading bloom preview…</p>';
    void fetchBloomPreview(active);
    return;
  }

  const profile = activeProfile();
  const sourceLine = `palette ${preview.basePalette} · mood ${preview.mood} · source ${preview.source}`;
  const targetLine = profile
    ? `${profile.targets.length} targets · ${profile.targets.map(t => t.name).join(' ')}`
    : '';
  const summary = `
        <section class="bloom-overview">
            <div class="bloom-overview-copy">
                <p class="eyebrow">Bloom Preview</p>
                <h1>${esc(preview.profile)}</h1>
                <p class="bloom-source-line">${esc(sourceLine)}</p>
                <p class="bloom-generated">generated ${esc(fmtTime(preview.generatedAt))}</p>
                ${targetLine ? `<p class="bloom-target-line">${esc(targetLine)}</p>` : ''}
            </div>
            <div class="bloom-overview-legend">
                <span><span class="legend-swatch" style="background:${esc(preview.colors.surface?.base ?? '#000000')}"></span> palette</span>
                <span><span class="legend-swatch" style="background:${esc(preview.colors.accent?.primary ?? '#000000')}"></span> mood</span>
                <span><span class="legend-swatch" style="background:${esc(preview.colors.text?.primary ?? '#000000')}"></span> bloom</span>
            </div>
        </section>`;

  const previewSections = GROUP_ORDER
    .filter(group => Object.keys(preview.colors[group] ?? {}).length > 0)
    .map(group => {
      const rows = preview.rows.filter(row => row.group === group);
      const rowsHtml = rows.map(row => `
                <div class="bloom-derivation-row">
                    <span class="bloom-derivation-token" title="${esc(row.path)}">${esc(row.path)}</span>
                    <span class="bloom-derivation-cell">
                        <span class="mini-chip" style="background:${esc(row.baseHex)}"></span>
                        <span class="bloom-derivation-text">
                            <span class="bloom-derivation-key">${esc(row.baseKey)}</span>
                            <span class="bloom-derivation-hex">${esc(row.baseHex)}</span>
                        </span>
                    </span>
                    <span class="bloom-derivation-mood">
                        <span class="mood-pill">${esc(row.group)}</span>
                        <span class="bloom-derivation-hex">${esc(row.weight.toFixed(2))}</span>
                    </span>
                    <span class="bloom-derivation-cell">
                        <span class="mini-chip" style="background:${esc(row.sourceHex)}"></span>
                        <span class="bloom-derivation-text">
                            <span class="bloom-derivation-key">${esc(row.sourceKey)}</span>
                            <span class="bloom-derivation-hex">${esc(row.sourceHex)}</span>
                        </span>
                    </span>
                    <span class="bloom-derivation-cell bloom-derivation-result">
                        <span class="mini-chip" style="background:${esc(row.result)}"></span>
                        <span class="bloom-derivation-text">
                            <span class="bloom-derivation-key">bloom</span>
                            <span class="bloom-derivation-hex">${esc(row.result)}</span>
                        </span>
                    </span>
                </div>`).join('');

      return `
                <section class="group bloom-derivation-group">
                    <h2>${group}</h2>
                    <div class="bloom-derivation-table">
                        <div class="bloom-derivation-header">
                            <span>token</span>
                            <span>palette</span>
                            <span>mood</span>
                            <span>source</span>
                            <span>=&gt; bloom</span>
                        </div>
                        ${rowsHtml}
                    </div>
                </section>`;
    }).join('');

  contentEl.innerHTML = summary + previewSections;
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

async function fetchBloomPreview(profileName: string) {
  try {
    const res = await fetch(`/api/bloom-preview/${encodeURIComponent(profileName)}`);
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    bloomPreviewCache[profileName] = await res.json() as BloomPreviewResponse;
    if (view === 'bloom' && active === profileName) renderBloom();
  } catch (err) {
    contentEl.innerHTML = `<p class="empty">Could not load bloom preview: ${err instanceof Error ? err.message : String(err)}</p>`;
  }
}

// --- Docs view ---

function renderDocsNav(): string {
  if (docsIndex.docs.length === 0) return '';
  return `
        <div class="docs-tabs">
            ${docsIndex.docs.map(doc => `
                <button class="docs-tab${doc.id === activeDoc ? ' active' : ''}" data-doc="${esc(doc.id)}">
                    ${esc(doc.title)}
                </button>`).join('')}
        </div>`;
}

function bindDocsTabs() {
  contentEl.querySelectorAll<HTMLButtonElement>('.docs-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeDoc = btn.dataset['doc'] ?? docsIndex.defaultDoc;
      renderDocs();
    });
  });
}

function bindDocActions() {
  contentEl.querySelectorAll<HTMLButtonElement>('[data-doc-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset['docAction'];
      const profileName = btn.dataset['profile'] ?? '';
      const targetName = btn.dataset['target'] ?? '';
      if (!profileName || !targetName) return;

      active = profileName;
      activeTarget = targetName;
      actionTarget = targetName;
      applyBloomUiPalette();
      renderTabs();
      renderControls();

      if (action === 'inspect') {
        view = 'inspect';
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.querySelector<HTMLButtonElement>('.view-btn[data-view="inspect"]')?.classList.add('active');
        renderInspect();
        return;
      }

      if (action === 'sow' || action === 'grow') {
        void runAction(action);
      }
    });
  });
}

function inlineMarkdown(text: string): string {
  const actionMatch = text.match(/^::actions:([^:]+):([^:]+)::$/);
  if (actionMatch) {
    const profileName = actionMatch[1]!;
    const targetName = actionMatch[2]!;
    return `
            <span class="target-actions">
                <button type="button" data-doc-action="inspect" data-profile="${esc(profileName)}" data-target="${esc(targetName)}">inspect</button>
                <button type="button" data-doc-action="sow" data-profile="${esc(profileName)}" data-target="${esc(targetName)}">sow</button>
                <button type="button" data-doc-action="grow" data-profile="${esc(profileName)}" data-target="${esc(targetName)}">grow</button>
            </span>`;
  }

  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const safeHref = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')
      ? href
      : '#';
    return `<a href="${esc(safeHref)}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  return out;
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let inCode = false;
  let code: string[] = [];
  let codeLang = '';
  let inDetails = false;
  let detailsHtml: string[] = [];
  let detailsOpen = false;
  let detailsSummary = '';
  let inSection = false;
  let sectionHtml: string[] = [];
  let sectionSummary = '';

  const pushHtml = (fragment: string) => {
    if (inDetails) {
      detailsHtml.push(fragment);
    } else if (inSection) {
      sectionHtml.push(fragment);
    } else {
      html.push(fragment);
    }
  };

  const pushParentHtml = (fragment: string) => {
    if (inSection) {
      sectionHtml.push(fragment);
    } else {
      html.push(fragment);
    }
  };

  const flushPara = () => {
    if (para.length === 0) return;
    pushHtml(`<p>${inlineMarkdown(para.join(' '))}</p>`);
    para = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    pushHtml(`<ul>${list.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    list = [];
  };

  const closeDetails = () => {
    if (!inDetails) return;
    const summary = detailsSummary || 'Profile';
    const isCurrent = summary.endsWith(' [current]');
    const summaryLabel = isCurrent ? summary.replace(/ \[current\]$/, '') : summary;
    const currentBadge = isCurrent ? '<span class="profile-current-badge">current</span>' : '';
    pushParentHtml(`
            <details class="profile-details${isCurrent ? ' is-current' : ''}"${detailsOpen ? ' open' : ''}>
                <summary><span>${inlineMarkdown(summaryLabel)}</span>${currentBadge}</summary>
                <div class="profile-details-body">
                    ${detailsHtml.join('\n')}
                </div>
            </details>`);
    inDetails = false;
    detailsHtml = [];
    detailsOpen = false;
    detailsSummary = '';
  };

  const closeSection = () => {
    closeDetails();
    if (!inSection) return;
    html.push(`
            <details class="markdown-section" open>
                <summary>${inlineMarkdown(sectionSummary)}</summary>
                <div class="markdown-section-body">
                    ${sectionHtml.join('\n')}
                </div>
            </details>`);
    inSection = false;
    sectionHtml = [];
    sectionSummary = '';
  };

  const parseTableRow = (line: string): string[] => line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());

  const isTableSeparator = (line: string): boolean => {
    const cells = parseTableRow(line);
    return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (inCode) {
        pushHtml(`<pre><code class="language-${esc(codeLang)}">${esc(code.join('\n'))}</code></pre>`);
        inCode = false;
        code = [];
        codeLang = '';
      } else {
        flushPara();
        flushList();
        inCode = true;
        codeLang = fence[1]?.trim() ?? '';
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (
      line.trim().startsWith('|') &&
      lines[i + 1] !== undefined &&
      isTableSeparator(lines[i + 1]!)
    ) {
      flushPara();
      flushList();
      const headers = parseTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        rows.push(parseTableRow(lines[i]!));
        i += 1;
      }
      i -= 1;
      pushHtml(`
                <div class="markdown-table-wrap">
                    <table>
                        <thead><tr>${headers.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${rows.map(row => `<tr>${headers.map((_h, idx) => `<td>${inlineMarkdown(row[idx] ?? '')}</td>`).join('')}</tr>`).join('')}
                        </tbody>
                    </table>
                </div>`);
      continue;
    }

    if (line.trim() === '') {
      flushPara();
      flushList();
      continue;
    }

    const detailsStart = line.match(/^:::profile(?:\s+(open))?$/);
    if (detailsStart) {
      flushPara();
      flushList();
      closeDetails();
      inDetails = true;
      detailsOpen = detailsStart[1] === 'open';
      continue;
    }

    if (line.trim() === ':::' && inDetails) {
      flushPara();
      flushList();
      closeDetails();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1]!.length;
      if (level === 2) {
        closeSection();
        inSection = true;
        sectionSummary = heading[2]!;
        continue;
      }
      if (inDetails && level === 3 && detailsSummary === '') {
        detailsSummary = heading[2]!;
      } else {
        pushHtml(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`);
      }
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1]!);
      continue;
    }

    const quote = line.match(/^>\s*(.+)$/);
    if (quote) {
      flushPara();
      flushList();
      pushHtml(`<blockquote>${inlineMarkdown(quote[1]!)}</blockquote>`);
      continue;
    }

    para.push(line.trim());
  }

  flushPara();
  flushList();
  if (inCode) {
    pushHtml(`<pre><code class="language-${esc(codeLang)}">${esc(code.join('\n'))}</code></pre>`);
  }
  closeDetails();
  closeSection();

  return html.join('\n');
}

function renderDocs() {
  if (docsIndex.docs.length === 0) {
    contentEl.innerHTML = '<p class="empty">Loading docs…</p>';
    void fetchDocsIndex();
    return;
  }

  const doc = docCache[activeDoc];
  if (!doc) {
    contentEl.innerHTML = renderDocsNav() + '<p class="empty">Loading markdown…</p>';
    bindDocsTabs();
    void fetchDoc(activeDoc);
    return;
  }

  contentEl.innerHTML = `
        ${renderDocsNav()}
        <article class="markdown-doc">
            ${renderMarkdown(doc.markdown)}
        </article>`;
  bindDocsTabs();
  bindDocActions();
}

async function fetchDocsIndex() {
  const res = await fetch('/api/docs');
  if (!res.ok) throw new Error(`server returned ${res.status}`);
  docsIndex = await res.json() as DocsIndexResponse;
  activeDoc = docsIndex.defaultDoc;
  if (view === 'docs') renderDocs();
}

async function fetchDoc(docId: string) {
  try {
    const res = await fetch(`/api/docs/${encodeURIComponent(docId)}`);
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    docCache[docId] = await res.json() as DocResponse;
    if (view === 'docs' && activeDoc === docId) renderDocs();
  } catch (err) {
    contentEl.innerHTML = renderDocsNav() + `<p class="empty">Could not load docs: ${err instanceof Error ? err.message : String(err)}</p>`;
    bindDocsTabs();
    bindDocActions();
  }
}

// --- Render dispatcher ---

function render() {
  if (view === 'bloom') {
    renderBloom();
  } else if (view === 'inspect') {
    renderInspect();
  } else {
    renderDocs();
  }
}

function applyBlooms(data: Blooms, pulse = true) {
  blooms = data;
  bloomPreviewCache = {};
  inspectCache = {}; // blooms changed → inspect data stale
  if (!active) active = pickInitialProfile();
  activeTarget = '';
  applyBloomUiPalette();
  renderControls();
  render();
  if (pulse) {
    indicator.classList.add('pulse');
    setTimeout(() => indicator.classList.remove('pulse'), 600);
  }
}

function applyProfiles(data: ProfilesResponse, rerender = true) {
  profiles = data;
  bloomPreviewCache = {};
  if (!active || !profiles.profiles.some(p => p.name === active)) {
    active = pickInitialProfile();
  }
  applyBloomUiPalette();
  renderTabs();
  renderControls();
  if (rerender) render();
}

async function refreshProfiles() {
  const res = await fetch('/api/profiles');
  if (!res.ok) throw new Error(`server returned ${res.status}`);
  applyProfiles(await res.json() as ProfilesResponse);
}

function pickInitialProfile(): string {
  const current = profiles.currentProfile;
  if (current && profiles.profiles.some(p => p.name === current)) return current;
  if (current && current in blooms) return current;
  if (profiles.profiles[0]) return profiles.profiles[0].name;
  return Object.keys(blooms)[0] ?? '';
}

// --- WebSocket ---

let wsAttempt = 0;
function connect() {
  // Try same-origin first (works in production when backend and UI share origin).
  // If that fails, fall back to the workbench backend port (development mode: 7865).
  const host = wsAttempt === 0 ? location.host : `${location.hostname}:7865`;
  const ws = new WebSocket(`ws://${host}/ws`);
  ws.onopen = () => { indicator.className = 'indicator connected'; wsAttempt = 0; };
  ws.onclose = () => { indicator.className = 'indicator disconnected'; wsAttempt = Math.min(wsAttempt + 1, 1); setTimeout(connect, 3000); };
  ws.onerror = () => ws.close();
  ws.onmessage = e => {
    const msg = JSON.parse(e.data as string) as { type: string; blooms?: Blooms; profiles?: ProfilesResponse };
    if (msg.type === 'blooms' && msg.blooms) applyBlooms(msg.blooms);
    if (msg.type === 'profiles' && msg.profiles) applyProfiles(msg.profiles);
  };
}

Promise.all([
  fetch('/api/profiles').then(r => r.json() as Promise<ProfilesResponse>),
  fetch('/api/blooms').then(r => r.json() as Promise<Blooms>),
  fetch('/api/docs').then(r => r.json() as Promise<DocsIndexResponse>),
])
  .then(([profileData, bloomData, docsData]) => {
    docsIndex = docsData;
    activeDoc = docsIndex.defaultDoc;
    applyProfiles(profileData, false);
    applyBlooms(bloomData, false);
    renderTabs();
    renderControls();
    render();
  })
  .catch(() => { contentEl.innerHTML = '<p class="empty">Could not reach workbench server.</p>'; });

connect();
