

let blooms: Blooms = {};
let profiles: ProfilesResponse = { profiles: [] };
let active = '';
type WorkbenchView = 'overview' | 'bloom' | 'pipeline' | 'recipes' | 'moods' | 'palettes' | 'docs';
let view: WorkbenchView = 'overview';
let activeTarget = '';
let pipelineCache: Record<string, InspectData> = {};
let actionTarget = '';
let isRunning = false;
let docsIndex: DocsIndexResponse = { defaultDoc: 'README.md', docs: [] };
let activeDoc = 'README.md';
let docCache: Record<string, DocResponse> = {};
let bloomPreviewCache: Record<string, BloomPreviewResponse> = {};
let recipesData: RecipesResponse = { recipes: [] };
let activeRecipeId = '';
let useBloomUiPalette = window.localStorage.getItem('ub-use-bloom-ui-palette') === 'true';
let runState: RunStateData | null = null;
let toastDismissTimer: ReturnType<typeof setTimeout> | undefined;
let moodsData: MoodFull[] = [];
let palettesData: PaletteWithColors[] = [];
let activeMoodName = '';
let activePaletteName = '';
let recipeEditMode = false;
let recipeEditData: RecipeEditState | null = null;
let profileEditMode = false;
let profileEdits: { targets: Record<string, string>; mood: string; basePalette: string } | null = null;


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
const targetListEl = document.getElementById('target-list')!;
const controlsEl = document.getElementById('controls')!;
const contentEl = document.getElementById('content')!;
const indicator = document.getElementById('indicator')!;
const runOutputEl = document.getElementById('run-output')!;
const toastEl = document.getElementById('run-toast')!;

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
  const profile = activeProfile();
  if (profile?.type === 'composition' && profile.currentProfile) {
    return blooms[profile.currentProfile] ?? blooms[active];
  }
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
    setView(btn.dataset['view'] as WorkbenchView);
  });
});

function setView(nextView: WorkbenchView): void {
  view = nextView;
  document.querySelectorAll<HTMLButtonElement>('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset['view'] === view);
  });
  renderControls();
  render();
}

function resetRecipeSelection(): void {
  activeRecipeId = '';
  recipeEditMode = false;
  recipeEditData = null;
  profileEditMode = false;
}

// --- Tabs ---

function renderTabs() {
  const names = profiles.profiles.map(p => p.name);
  tabsEl.innerHTML = names
    .map(p => {
      const profile = profiles.profiles.find(item => item.name === p);
      const current = profiles.currentProfile === p ? '<span class="sidebar-badge">current</span>' : '';
      return `
        <button class="tab${p === active ? ' active' : ''}" data-p="${esc(p)}">
          <span class="tab-main">${esc(p)}</span>
          <span class="tab-sub">${esc(profile?.type === 'composition' ? 'composition' : (profile?.mood ?? 'unknown'))} · ${esc(String(profile?.targets.length ?? 0))} targets</span>
          ${current}
        </button>`;
    })
    .join('');
  tabsEl.querySelectorAll<HTMLButtonElement>('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      active = btn.dataset['p']!;
      actionTarget = '';
      activeTarget = '';
      resetRecipeSelection();
      applyBloomUiPalette();
      renderTabs();
      renderTargetList();
      renderControls();
      render();
    });
  });
}

function statusClass(status: string | undefined): string {
  if (!status) return 'idle';
  if (status === 'ok') return 'ok';
  if (status === 'error' || status === 'failed') return 'error';
  return 'warn';
}

function selectedTargetName(): string {
  const profile = activeProfile();
  if (!profile) return '';
  const preferred = actionTarget || activeTarget;
  if (preferred && profile.targets.some(t => t.name === preferred)) return preferred;
  return profile.targets[0]?.name ?? '';
}

function recipeCountForTarget(targetName: string): number {
  return recipesData.recipes.filter(recipe => recipe.target === targetName).length;
}

function renderTargetList(): void {
  const profile = activeProfile();
  if (!profile) {
    targetListEl.innerHTML = '<p class="empty-inline">No targets.</p>';
    return;
  }

  const selected = selectedTargetName();
  targetListEl.innerHTML = profile.targets.map(target => `
    <button class="target-list-item${target.name === selected ? ' active' : ''}" data-target="${esc(target.name)}">
      <span class="target-list-name">${esc(target.name)}</span>
      <span class="status-dot ${statusClass(target.status)}"></span>
      <span class="target-list-recipe">${esc(target.recipe)} · ${recipeCountForTarget(target.name)} recipes</span>
    </button>`).join('');

  targetListEl.querySelectorAll<HTMLButtonElement>('.target-list-item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTarget = btn.dataset['target'] ?? '';
      actionTarget = activeTarget;
      resetRecipeSelection();
      renderTargetList();
      renderControls();
      if (view === 'overview' || view === 'pipeline' || view === 'recipes') render();
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

  const selectedTarget = actionTarget || activeTarget;
  const targetOptions = [
    '<option value="">all targets</option>',
    ...profile.targets.map(t => `<option value="${esc(t.name)}"${t.name === selectedTarget ? ' selected' : ''}>${esc(t.name)}</option>`),
  ].join('');
  const target = profile.targets.find(t => t.name === selectedTarget);
  const inspectTarget = view === 'pipeline' && selectedTarget
    ? pipelineCache[active]?.targets[selectedTarget]
    : undefined;
  const contextTitle = target ? target.name : profile.name;
  const contextSubtitle = target
    ? `${profile.name}${target.profile && target.profile !== profile.name ? ` · from ${target.profile}` : ''}`
    : '';
  const contextType = target ? 'target' : (profile.type ?? 'profile');
  const contextPalette = inspectTarget?.basePalette ?? profile.basePalette;
  const contextMood = inspectTarget?.mood ?? profile.mood;
  const contextSource = inspectTarget?.source ?? profile.source;
  const targetMeta = target
    ? `target ${esc(target.name)} · recipe ${esc(target.recipe)}${target.profile ? ` · from ${esc(target.profile)}` : ''} · sown ${esc(fmtTime(target.sownAt))} · grown ${esc(fmtTime(target.grownAt))}${target.status ? ` · ${esc(target.status)}` : ''}`
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

  const commandTarget = selectedTarget ? ` ${selectedTarget}` : '';

  controlsEl.innerHTML = `
        <div class="context-block">
            <p class="eyebrow">Context</p>
            <h2>${esc(contextTitle)}</h2>
            ${contextSubtitle ? `<p class="context-subtitle">${esc(contextSubtitle)}</p>` : ''}
            <div class="context-meta">
                <span><span class="meta-key">mode</span>${esc(view)}</span>
                <span><span class="meta-key">type</span>${esc(contextType)}</span>
                <span><span class="meta-key">palette</span>${esc(contextPalette)}</span>
                <span><span class="meta-key">mood</span>${esc(contextMood)}</span>
                <span><span class="meta-key">source</span>${esc(contextSource)}</span>
                ${target ? `<span><span class="meta-key">recipe</span>${esc(target.recipe)}</span>` : ''}
                ${profiles.currentProfile === profile.name ? '<span class="current-pill">current</span>' : ''}
            </div>
        </div>
        <div class="context-block">
            <p class="eyebrow">Actions</p>
            <div class="context-actions">
                <select id="target-select" class="target-select" ${isRunning ? 'disabled' : ''}>${targetOptions}</select>
                <button id="sow-btn" class="action-btn" ${isRunning ? 'disabled' : ''}>sow</button>
                <button id="grow-btn" class="action-btn primary" ${isRunning ? 'disabled' : ''}>grow</button>
                <button id="plant-btn" class="action-btn plant" ${isRunning ? 'disabled' : ''} title="Deploy rendered files to system paths">plant</button>
            </div>
            <p class="target-meta">${targetMeta}</p>
        </div>
        <div class="context-block">
            <p class="eyebrow">CLI</p>
            <pre class="command-stack"><code>spore sow ${esc(profile.name)}${esc(commandTarget)}
spore grow ${esc(profile.name)}${esc(commandTarget)}
spore inspect bloom ${esc(profile.name)}
spore inspect spore ${esc(profile.name)} ${esc(selectedTargetName())}</code></pre>
        </div>
        <div class="context-block">
            <p class="eyebrow">Workbench Palette</p>
            <label class="toggle-control" title="Theme the workbench from the selected profile bloom">
                <input id="bloom-ui-toggle" type="checkbox" ${useBloomUiPalette ? 'checked' : ''} ${activeBloom() ? '' : 'disabled'} />
                <span>Use Bloom palette</span>
            </label>
            ${palettePreview}
        </div>`;

  controlsEl.querySelector<HTMLSelectElement>('#target-select')?.addEventListener('change', e => {
    actionTarget = (e.currentTarget as HTMLSelectElement).value;
    activeTarget = actionTarget;
    resetRecipeSelection();
    renderTargetList();
    renderControls();
    if (view === 'pipeline' || view === 'recipes') render();
  });
  controlsEl.querySelector<HTMLInputElement>('#bloom-ui-toggle')?.addEventListener('change', e => {
    setBloomUiPalettePreference((e.currentTarget as HTMLInputElement).checked);
  });
  controlsEl.querySelector<HTMLButtonElement>('#sow-btn')?.addEventListener('click', () => runAction('sow'));
  controlsEl.querySelector<HTMLButtonElement>('#grow-btn')?.addEventListener('click', () => runAction('grow'));
  controlsEl.querySelector<HTMLButtonElement>('#plant-btn')?.addEventListener('click', () => runAction('plant'));
}

function showRunOutput(title: string, text: string, ok: boolean): void {
  runOutputEl.hidden = false;
  runOutputEl.className = `run-output ${ok ? 'ok' : 'error'}`;
  runOutputEl.innerHTML = `
        <div class="run-output-title">${esc(title)}</div>
        <pre>${esc(text.trim() || '(no output)')}</pre>`;
}

// --- Profile edit form ---

function renderProfileEditForm(profile: ProfileStatus): string {
  const moodOptions = moodsData.length > 0
    ? moodsData.map(m => `<option value="${esc(m.name)}"${m.name === profile.mood ? ' selected' : ''}>${esc(m.name)}</option>`).join('')
    : `<option value="${esc(profile.mood)}" selected>${esc(profile.mood)}</option>`;
  const paletteOptions = palettesData.length > 0
    ? palettesData.map(p => `<option value="${esc(p.slug)}"${p.slug === profile.basePalette ? ' selected' : ''}>${esc(p.name)}</option>`).join('')
    : `<option value="${esc(profile.basePalette)}" selected>${esc(profile.basePalette)}</option>`;

  const targetRows = profile.targets.map(t => {
    const available = recipesData.recipes.filter(r => r.target === t.name);
    const recipeOptions = available.length > 0
      ? available.map(r => `<option value="${esc(r.name)}"${r.name === t.recipe ? ' selected' : ''}>${esc(r.name)}</option>`).join('')
      : `<option value="${esc(t.recipe)}" selected>${esc(t.recipe)}</option>`;
    return `
      <div class="profile-edit-target-row">
        <span class="profile-edit-target-name">${esc(t.name)}</span>
        <select class="profile-edit-recipe" data-target="${esc(t.name)}">${recipeOptions}</select>
      </div>`;
  }).join('');

  return `
    <div class="profile-edit-form">
      <div class="profile-edit-meta-row">
        <label class="profile-edit-field">
          <span class="eyebrow">Mood</span>
          <select id="profile-edit-mood">${moodOptions}</select>
        </label>
        <label class="profile-edit-field">
          <span class="eyebrow">Base Palette</span>
          <select id="profile-edit-palette">${paletteOptions}</select>
        </label>
      </div>
      <div class="eyebrow" style="margin-bottom:0.25rem">Target Recipes</div>
      <div class="profile-edit-targets">${targetRows}</div>
      <div class="editor-toolbar" style="margin-top:1rem">
        <button class="action-btn primary" id="save-profile-btn">Save profile</button>
      </div>
    </div>`;
}

// --- Overview view ---

function renderOverview(): void {
  const profile = activeProfile();
  if (!profile) {
    contentEl.innerHTML = '<p class="empty">No profile selected.</p>';
    return;
  }

  const selected = selectedTargetName();
  const describeCompositionRun = (run: CompositionRunStatus): string => {
    const runProfile = profiles.profiles.find(item => item.name === run.profile);
    const resolvedTargets = run.targets ?? runProfile?.targets.map(target => target.name) ?? [];
    const visibleTargets = run.exclude
      ? resolvedTargets.filter(target => !run.exclude?.includes(target))
      : resolvedTargets;
    const targetLabel = visibleTargets.length === 1
      ? `1 target: ${visibleTargets[0]}`
      : `${visibleTargets.length} targets`;
    const excludeLabel = run.exclude && run.exclude.length > 0
      ? ` · excludes: ${run.exclude.join(', ')}`
      : '';
    return `${targetLabel}${excludeLabel}`;
  };
  const composition = profile.runs && profile.runs.length > 0 ? `
    <section class="group">
      <div class="section-heading">
        <h2>Composition</h2>
        <span>${profile.currentProfile ? `leaves current profile as ${esc(profile.currentProfile)}` : 'ordered profile runs'}</span>
      </div>
      <div class="composition-list">
        ${profile.runs.map((run, index) => `
          <button class="composition-run" type="button" data-composition-profile="${esc(run.profile)}">
            <span class="composition-index">${index + 1}</span>
            <div>
              <h3>${esc(run.profile)}</h3>
              <p>${esc(describeCompositionRun(run))}</p>
            </div>
          </button>`).join('')}
      </div>
    </section>` : '';

  const targets = profile.targets.map(target => `
    <article class="target-card${target.name === selected ? ' active' : ''}">
      <div class="target-card-main">
        <span class="status-dot ${statusClass(target.status)}"></span>
        <div>
          <h3>${esc(target.name)}</h3>
          <button class="recipe-link" type="button" data-overview-recipe="${esc(target.name)}">${esc(target.recipe)}</button>
          ${target.profile && target.profile !== profile.name ? `<p class="target-source-profile">from ${esc(target.profile)}</p>` : ''}
        </div>
      </div>
      <dl class="target-card-meta">
        <div><dt>sown</dt><dd>${esc(fmtTime(target.sownAt))}</dd></div>
        <div><dt>grown</dt><dd>${esc(fmtTime(target.grownAt))}</dd></div>
        <div><dt>status</dt><dd>${esc(target.status ?? 'waiting')}</dd></div>
      </dl>
      <div class="target-card-actions">
        <button type="button" data-overview-action="inspect" data-target="${esc(target.name)}">inspect</button>
        <button type="button" data-overview-action="sow" data-target="${esc(target.name)}">sow</button>
        <button type="button" data-overview-action="grow" data-target="${esc(target.name)}">grow</button>
      </div>
    </article>`).join('');

  contentEl.innerHTML = `
    <section class="overview-hero">
      <div>
        <p class="eyebrow">Selected Profile</p>
        <h1>${esc(profile.name)}</h1>
        <p>${esc(profile.type ?? 'profile')} · ${esc(profile.basePalette)} · ${esc(profile.mood)} · ${esc(profile.source)}</p>
      </div>
      <div class="overview-stats">
        <span><strong>${profile.targets.length}</strong> targets</span>
        <span><strong>${esc(fmtTime(profile.bloomAt))}</strong> bloom</span>
      </div>
    </section>
    ${composition}
    <section class="group">
      <div class="section-heading">
        <h2>Profile targets</h2>
        <button class="action-btn${profileEditMode ? ' active' : ''}" id="toggle-profile-edit">
          ${profileEditMode ? 'cancel edit' : 'edit profile'}
        </button>
      </div>
      ${profileEditMode ? renderProfileEditForm(profile) : `<div class="target-card-grid">${targets}</div>`}
    </section>`;

  contentEl.querySelector<HTMLButtonElement>('#toggle-profile-edit')?.addEventListener('click', () => {
    profileEditMode = !profileEditMode;
    if (profileEditMode && moodsData.length === 0) void fetchMoods();
    if (profileEditMode && palettesData.length === 0) void fetchPalettes();
    renderOverview();
  });

  contentEl.querySelector<HTMLButtonElement>('#save-profile-btn')?.addEventListener('click', () => {
    const mood = (contentEl.querySelector<HTMLSelectElement>('#profile-edit-mood'))?.value ?? profile.mood;
    const basePalette = (contentEl.querySelector<HTMLSelectElement>('#profile-edit-palette'))?.value ?? profile.basePalette;
    const targets: Record<string, string> = {};
    contentEl.querySelectorAll<HTMLSelectElement>('.profile-edit-recipe').forEach(sel => {
      targets[sel.dataset['target'] ?? ''] = sel.value;
    });
    const targetList = profile.targets.map(t => ({ ...t, recipe: targets[t.name] ?? t.recipe }));
    const updated = {
      name: profile.name,
      basePalette,
      mood,
      source: profile.source,
      targets: targetList.map(t => ({ name: t.name, recipe: t.recipe })),
    };
    void saveAndMaybeApply(() => apiSaveProfile(profile.name, updated), `profile ${profile.name}`).then(() => {
      profileEditMode = false;
    });
  });

  contentEl.querySelectorAll<HTMLButtonElement>('[data-overview-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTarget = btn.dataset['target'] ?? '';
      actionTarget = activeTarget;
      resetRecipeSelection();
      renderTargetList();
      renderControls();
      const action = btn.dataset['overviewAction'];
      if (action === 'inspect') {
        setView('pipeline');
        return;
      }
      if (action === 'sow' || action === 'grow' || action === 'plant') void runAction(action);
    });
  });

  contentEl.querySelectorAll<HTMLButtonElement>('[data-overview-recipe]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTarget = btn.dataset['overviewRecipe'] ?? '';
      actionTarget = activeTarget;
      resetRecipeSelection();
      renderTargetList();
      renderControls();
      setView('recipes');
    });
  });

  contentEl.querySelectorAll<HTMLButtonElement>('[data-composition-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      const profileName = btn.dataset['compositionProfile'] ?? '';
      if (!profiles.profiles.some(item => item.name === profileName)) return;
      active = profileName;
      activeTarget = '';
      actionTarget = '';
      resetRecipeSelection();
      applyBloomUiPalette();
      renderTabs();
      renderTargetList();
      renderControls();
      renderOverview();
    });
  });
}

// --- Recipe edit helpers ---

interface SwatchOption { value: string; hex: string; label?: string }

function bloomOptionsWithHex(): SwatchOption[] {
  const bloom = pipelineCache[active]?.bloom ?? {};
  const order = ['surface', 'text', 'accent', 'state', 'border', 'selection'];
  const groups = [...Object.keys(bloom)].sort((a, b) => {
    const ai = order.indexOf(a); const bi = order.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const opts: SwatchOption[] = [];
  for (const group of groups) {
    for (const [name, hex] of Object.entries(bloom[group] ?? {})) {
      opts.push({ value: `${group}.${name}`, hex });
    }
  }
  return opts;
}

function sourceOptionsWithHex(): SwatchOption[] {
  const data = pipelineCache[active];
  if (!data) return [];
  const map = new Map<string, string>();
  for (const target of Object.values(data.targets)) {
    for (const t of target.tokens) {
      const key = t.srcKey.replace(/^source:/, '');
      if (key && key !== '(none)' && !map.has(key)) map.set(key, t.srcHex);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, hex]) => ({ value, hex }));
}

function paletteKeysFromData(): string[] {
  const palette = palettesData.find(p => recipeEditData ? p.slug === recipeEditData.basePalette : false) ?? palettesData[0];
  return palette ? Object.keys(palette.colors) : [];
}

function getBloomHex(key: string): string {
  if (!key) return '';
  const dot = key.indexOf('.');
  return dot < 0 ? '' : (pipelineCache[active]?.bloom?.[key.slice(0, dot)]?.[key.slice(dot + 1)] ?? '');
}

function getSourceHex(sourceKey: string): string {
  if (!sourceKey) return '';
  const data = pipelineCache[active];
  if (!data) return '';
  for (const target of Object.values(data.targets)) {
    const row = target.tokens.find(t => t.srcKey.replace(/^source:/, '') === sourceKey);
    if (row) return row.srcHex;
  }
  return '';
}

function getBaseHex(key: string): string {
  if (!key || !recipeEditData) return '';
  const palette = palettesData.find(p => p.slug === recipeEditData!.basePalette) ?? palettesData[0];
  return palette?.colors[key] ?? '';
}

function computeEditResultHex(t: RecipeEditToken): string {
  const base = t.bloomHex || t.baseHex;
  if (!base) return '';
  if (t.sourceHex && t.mix > 0) return mixHex(base, t.sourceHex, t.mix) ?? base;
  return base;
}

function initRecipeEdit(recipe: WorkbenchRecipeSummary): void {
  let uid = 0;
  const tokens: RecipeEditToken[] = Object.entries(recipe.raw.tokens ?? {}).map(([name, t]) => {
    const bloom = 'bloom' in t && typeof t.bloom === 'string' ? t.bloom : '';
    const source = 'source' in t && typeof t.source === 'string' ? t.source : '';
    const base = 'base' in t && typeof t.base === 'string' ? t.base : '';
    return {
      _id: `t${uid++}`, name, base, baseHex: '', bloom, bloomHex: getBloomHex(bloom),
      source, sourceHex: getSourceHex(source),
      mix: 'mix' in t && typeof t.mix === 'number' ? t.mix : 0,
    };
  });
  recipeEditData = { name: recipe.raw.name ?? recipe.name, basePalette: recipe.raw.basePalette ?? '', tokens };
}

function recipeEditTokenToRaw(t: RecipeEditToken): TokenRecipe | null {
  if (!t.name) return null;
  if (t.bloom) {
    const entry: { bloom: string; source?: string; mix?: number } = { bloom: t.bloom };
    if (t.source) { entry.source = t.source; entry.mix = t.mix; }
    return entry;
  }
  if (t.base && t.source) return { base: t.base, source: t.source, mix: t.mix };
  if (t.base) return { base: t.base };
  return null;
}

function renderSwatchPicker(id: string, field: string, current: string, currentHex: string, opts: SwatchOption[]): string {
  const chip = currentHex ? `<span class="mini-chip" style="background:${esc(currentHex)}"></span>` : `<span class="mini-chip empty-chip"></span>`;
  const listItems = [
    `<button type="button" class="swatch-opt" data-value="" data-hex=""><span class="mini-chip empty-chip"></span><span>(none)</span></button>`,
    ...opts.map(o => `<button type="button" class="swatch-opt" data-value="${esc(o.value)}" data-hex="${esc(o.hex)}">${o.hex ? `<span class="mini-chip" style="background:${esc(o.hex)}"></span>` : `<span class="mini-chip empty-chip"></span>`}<span>${esc(o.value)}</span><code>${esc(o.hex)}</code></button>`),
  ].join('');
  return `
    <details class="swatch-picker" data-field="${esc(field)}" data-id="${esc(id)}">
      <summary class="swatch-trigger">${chip}<span class="swatch-label">${esc(current || '(none)')}</span><span class="swatch-caret">▾</span></summary>
      <div class="swatch-panel">
        <input type="text" class="swatch-filter" placeholder="filter…" />
        <div class="swatch-list">${listItems}</div>
      </div>
    </details>`;
}

function renderResultCell(id: string, hex: string): string {
  return hex
    ? `<span class="recipe-edit-result" id="res-${esc(id)}"><span class="mini-chip" style="background:${esc(hex)}"></span><code>${esc(hex)}</code></span>`
    : `<span class="recipe-edit-result" id="res-${esc(id)}"><span class="muted-dash">-</span></span>`;
}

function renderRecipeEditRow(t: RecipeEditToken, bloomOpts: SwatchOption[], sourceOpts: SwatchOption[], baseOpts: string[]): string {
  const dlId = `bdl-${t._id}`;
  const mixVal = t.mix.toFixed(2);
  const resultHex = computeEditResultHex(t);
  return `
    <div class="recipe-edit-row" data-edit-id="${esc(t._id)}">
      <span class="recipe-edit-cell">
        <input class="recipe-edit-name" data-field="name" data-id="${esc(t._id)}" type="text" value="${esc(t.name)}" placeholder="token name" />
      </span>
      <span class="recipe-edit-cell">
        <datalist id="${dlId}">${baseOpts.map(k => `<option value="${esc(k)}"></option>`).join('')}</datalist>
        <input class="recipe-edit-input" data-field="base" data-id="${esc(t._id)}" type="text" value="${esc(t.base)}" placeholder="base key" list="${dlId}" />
      </span>
      <span class="recipe-edit-cell picker-cell">${renderSwatchPicker(t._id, 'bloom', t.bloom, t.bloomHex, bloomOpts)}</span>
      <span class="recipe-edit-cell picker-cell">${renderSwatchPicker(t._id, 'source', t.source, t.sourceHex, sourceOpts)}</span>
      <span class="recipe-edit-mix-cell">
        <input type="range" class="recipe-edit-slider" data-id="${esc(t._id)}" min="0" max="1" step="0.01" value="${esc(mixVal)}" />
        <code class="recipe-mix-val" id="rmv-${esc(t._id)}">${esc(mixVal)}</code>
      </span>
      ${renderResultCell(t._id, resultHex)}
      <button class="recipe-edit-delete" data-delete-id="${esc(t._id)}" title="Remove">×</button>
    </div>`;
}

function updateLiveResult(id: string, token: RecipeEditToken): void {
  const resultEl = contentEl.querySelector<HTMLElement>(`#res-${CSS.escape(id)}`);
  if (!resultEl) return;
  const hex = computeEditResultHex(token);
  resultEl.innerHTML = hex
    ? `<span class="mini-chip" style="background:${esc(hex)}"></span><code>${esc(hex)}</code>`
    : '<span class="muted-dash">-</span>';
}

function bindPickerEvents(root: HTMLElement, data: RecipeEditState): void {
  root.querySelectorAll<HTMLElement>('.swatch-picker').forEach(picker => {
    const id = picker.dataset['id']!;
    const field = picker.dataset['field'] as 'bloom' | 'source';
    const token = data.tokens.find(t => t._id === id);
    if (!token) return;

    const filterEl = picker.querySelector<HTMLInputElement>('.swatch-filter');
    filterEl?.addEventListener('input', () => {
      const q = filterEl.value.toLowerCase();
      picker.querySelectorAll<HTMLButtonElement>('.swatch-opt').forEach(opt => {
        opt.hidden = q ? !(opt.dataset['value'] ?? '').toLowerCase().includes(q) : false;
      });
    });
    // Prevent filter input clicks from closing the details
    filterEl?.addEventListener('click', e => e.stopPropagation());

    picker.querySelectorAll<HTMLButtonElement>('.swatch-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const value = opt.dataset['value'] ?? '';
        const hex = opt.dataset['hex'] ?? '';
        if (field === 'bloom') { token.bloom = value; token.bloomHex = hex; }
        else { token.source = value; token.sourceHex = hex; }
        // Update trigger display
        const trigger = picker.querySelector<HTMLElement>('.swatch-trigger');
        if (trigger) {
          const chipHtml = hex ? `<span class="mini-chip" style="background:${esc(hex)}"></span>` : `<span class="mini-chip empty-chip"></span>`;
          trigger.innerHTML = `${chipHtml}<span class="swatch-label">${esc(value || '(none)')}</span><span class="swatch-caret">▾</span>`;
        }
        updateLiveResult(id, token);
        (picker as HTMLDetailsElement).open = false;
        if (filterEl) { filterEl.value = ''; picker.querySelectorAll<HTMLButtonElement>('.swatch-opt').forEach(o => { o.hidden = false; }); }
      });
    });
  });
}

function renderRecipeEditForm(recipe: WorkbenchRecipeSummary): string {
  if (!recipeEditData) initRecipeEdit(recipe);
  const data = recipeEditData!;
  const bloomOpts = bloomOptionsWithHex();
  const sourceOpts = sourceOptionsWithHex();
  const baseOpts = paletteKeysFromData();
  const paletteOpts = palettesData.length > 0
    ? palettesData.map(p => `<option value="${esc(p.slug)}"${p.slug === data.basePalette ? ' selected' : ''}>${esc(p.name)}</option>`).join('')
    : `<option value="${esc(data.basePalette)}" selected>${esc(data.basePalette) || '(none)'}</option>`;

  const rows = data.tokens.map(t => renderRecipeEditRow(t, bloomOpts, sourceOpts, baseOpts)).join('');

  return `
    <div class="recipe-edit-form">
      <div class="recipe-edit-meta">
        <label class="recipe-edit-field">
          <span class="eyebrow">Recipe name</span>
          <input id="recipe-edit-name" class="recipe-edit-input" type="text" value="${esc(data.name)}" placeholder="name" />
        </label>
        <label class="recipe-edit-field">
          <span class="eyebrow">Base palette</span>
          <select id="recipe-edit-palette">${paletteOpts}</select>
        </label>
      </div>
      <div class="recipe-edit-table">
        <div class="recipe-edit-header">
          <span>TOKEN</span><span>BASE</span><span>BLOOM</span><span>SOURCE</span><span>MIX</span><span>RESULT</span><span></span>
        </div>
        <div id="recipe-edit-rows">${rows}</div>
      </div>
      <div class="recipe-edit-footer">
        <button class="action-btn" id="add-token-btn">+ add token</button>
      </div>
    </div>`;
}

function bindRecipeEditEvents(): void {
  const data = recipeEditData;
  if (!data) return;

  contentEl.querySelector<HTMLInputElement>('#recipe-edit-name')?.addEventListener('input', e => {
    data.name = (e.currentTarget as HTMLInputElement).value;
  });
  contentEl.querySelector<HTMLSelectElement>('#recipe-edit-palette')?.addEventListener('change', e => {
    data.basePalette = (e.currentTarget as HTMLSelectElement).value;
    const baseOpts = paletteKeysFromData();
    contentEl.querySelectorAll<HTMLDataListElement>('[id^="bdl-"]').forEach(dl => {
      dl.innerHTML = baseOpts.map(k => `<option value="${esc(k)}"></option>`).join('');
    });
  });

  contentEl.querySelectorAll<HTMLInputElement>('.recipe-edit-name').forEach(input => {
    input.addEventListener('input', () => {
      const token = data.tokens.find(t => t._id === input.dataset['id']);
      if (token) token.name = input.value;
    });
  });
  contentEl.querySelectorAll<HTMLInputElement>('.recipe-edit-input[data-field="base"]').forEach(input => {
    input.addEventListener('input', () => {
      const token = data.tokens.find(t => t._id === input.dataset['id']);
      if (!token) return;
      token.base = input.value;
      token.baseHex = getBaseHex(input.value);
      updateLiveResult(token._id, token);
    });
  });

  contentEl.querySelectorAll<HTMLInputElement>('.recipe-edit-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const id = slider.dataset['id']!;
      const val = Number(slider.value);
      const token = data.tokens.find(t => t._id === id);
      if (token) { token.mix = val; updateLiveResult(id, token); }
      const label = contentEl.querySelector<HTMLElement>(`#rmv-${CSS.escape(id)}`);
      if (label) label.textContent = val.toFixed(2);
    });
  });

  contentEl.querySelectorAll<HTMLButtonElement>('.recipe-edit-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['deleteId']!;
      data.tokens = data.tokens.filter(t => t._id !== id);
      contentEl.querySelector<HTMLElement>(`[data-edit-id="${CSS.escape(id)}"]`)?.remove();
    });
  });

  bindPickerEvents(contentEl, data);

  let addUid = data.tokens.length + Date.now();
  contentEl.querySelector<HTMLButtonElement>('#add-token-btn')?.addEventListener('click', () => {
    const newToken: RecipeEditToken = { _id: `ta${addUid++}`, name: '', base: '', baseHex: '', bloom: '', bloomHex: '', source: '', sourceHex: '', mix: 0 };
    data.tokens.push(newToken);
    const bloomOpts = bloomOptionsWithHex();
    const sourceOpts = sourceOptionsWithHex();
    const baseOpts = paletteKeysFromData();
    const rowsEl = contentEl.querySelector<HTMLElement>('#recipe-edit-rows');
    if (rowsEl) rowsEl.insertAdjacentHTML('beforeend', renderRecipeEditRow(newToken, bloomOpts, sourceOpts, baseOpts));
    const newRow = contentEl.querySelector<HTMLElement>(`[data-edit-id="${CSS.escape(newToken._id)}"]`);
    if (!newRow) return;
    newRow.querySelector<HTMLInputElement>('.recipe-edit-name')?.addEventListener('input', e => { newToken.name = (e.currentTarget as HTMLInputElement).value; });
    newRow.querySelector<HTMLInputElement>('[data-field="base"]')?.addEventListener('input', e => {
      newToken.base = (e.currentTarget as HTMLInputElement).value;
      newToken.baseHex = getBaseHex(newToken.base);
      updateLiveResult(newToken._id, newToken);
    });
    const slider = newRow.querySelector<HTMLInputElement>('.recipe-edit-slider');
    const label = newRow.querySelector<HTMLElement>(`#rmv-${CSS.escape(newToken._id)}`);
    slider?.addEventListener('input', () => {
      newToken.mix = Number(slider.value);
      if (label) label.textContent = Number(slider.value).toFixed(2);
      updateLiveResult(newToken._id, newToken);
    });
    newRow.querySelector<HTMLButtonElement>('.recipe-edit-delete')?.addEventListener('click', () => {
      data.tokens = data.tokens.filter(t => t._id !== newToken._id);
      newRow.remove();
    });
    bindPickerEvents(newRow, data);
  });
}

function renderRecipes(): void {
  const profile = activeProfile();
  if (!profile) {
    contentEl.innerHTML = '<p class="empty">No profile selected.</p>';
    return;
  }

  if (recipesData.recipes.length === 0) {
    contentEl.innerHTML = '<p class="empty">Loading recipes…</p>';
    void fetchRecipes();
    return;
  }

  const selectedTarget = selectedTargetName();
  const targetAssignment = profile.targets.find(target => target.name === selectedTarget);
  const targetRecipes = recipesData.recipes.filter(recipe => recipe.target === selectedTarget);
  const preferredRecipeId = targetAssignment ? `${targetAssignment.name}/${targetAssignment.recipe}` : '';
  if (!activeRecipeId || !targetRecipes.some(recipe => recipe.id === activeRecipeId)) {
    activeRecipeId = preferredRecipeId && targetRecipes.some(recipe => recipe.id === preferredRecipeId)
      ? preferredRecipeId
      : targetRecipes[0]?.id ?? '';
  }

  const activeRecipe = targetRecipes.find(recipe => recipe.id === activeRecipeId);
  if (!activeRecipe) {
    contentEl.innerHTML = '<p class="empty">No recipes found for the selected target.</p>';
    return;
  }

  const inspectData = pipelineCache[active];
  if (!inspectData) {
    void fetchPipeline(active);
  }
  const previewTarget = inspectData?.targets[activeRecipe.target];
  const previewRows = new Map((previewTarget?.tokens ?? []).map(row => [row.name, row]));

  const recipeCards = targetRecipes.map(recipe => {
    const usedHere = profile.targets.some(target => target.name === recipe.target && target.recipe === recipe.name);
    const disabled = !usedHere;
    return `
      <button class="recipe-card${recipe.id === activeRecipeId ? ' active' : ''}${disabled ? ' disabled' : ''}" type="button" data-recipe-id="${esc(recipe.id)}"${disabled ? ' disabled' : ''}>
        <span class="recipe-card-target">${esc(recipe.target)}</span>
        <span class="recipe-card-name">${esc(recipe.name)}</span>
        <span class="recipe-card-note">${recipe.tokenCount} tokens · ${usedHere ? 'selected profile uses this' : 'available, not assigned here yet'}</span>
      </button>`;
  }).join('');

  const tokenEntries = Object.entries(activeRecipe.raw.tokens ?? {});
  const tokenRows = recipeEditMode ? '' : tokenEntries.map(([name, token]) => {
    const preview = previewRows.get(name);
    const base = 'base' in token && typeof token.base === 'string' ? token.base : '';
    const bloom = 'bloom' in token && typeof token.bloom === 'string' ? token.bloom : '';
    const source = 'source' in token && typeof token.source === 'string' ? token.source : '';
    const rawMix = 'mix' in token && typeof token.mix === 'number' ? token.mix : undefined;
    const mix = rawMix !== undefined ? rawMix.toFixed(2) : '';
    const baseHex = base && preview?.baseKey.startsWith('base:') ? preview.baseHex : undefined;
    const bloomHex = bloom && preview?.baseKey.startsWith('bloom:') ? preview.baseHex : undefined;
    const sourceHex = source ? preview?.srcHex : undefined;
    const resultHex = preview?.result;
    const colorCell = (label: string, hex: string | undefined): string => label
      ? `<span class="recipe-color-cell" title="${esc(hex ? `${label} ${hex}` : label)}"><span class="mini-chip${hex ? '' : ' empty-chip'}"${hex ? ` style="background:${esc(hex)}"` : ''}></span><code>${esc(label)}</code>${hex ? `<small>${esc(hex)}</small>` : '<small>unresolved</small>'}</span>`
      : '<span class="muted-dash">-</span>';
    return `
      <div class="recipe-token-row">
        <span class="recipe-token-name" title="${esc(name)}">${esc(name)}</span>
        <span>${colorCell(base, baseHex)}</span>
        <span>${colorCell(bloom, bloomHex)}</span>
        <span>${colorCell(source, sourceHex)}</span>
        <span>${mix ? `<code>${esc(mix)}</code>` : '<span class="muted-dash">-</span>'}</span>
        <span>${resultHex ? `<span class="recipe-color-cell result">${chip(resultHex)}<code>mixed</code><small>${esc(resultHex)}</small></span>` : '<span class="muted-dash">-</span>'}</span>
      </div>`;
  }).join('');

  const usage = activeRecipe.usages.length > 0
    ? activeRecipe.usages.map(item => `
        <span class="recipe-usage-pill">${esc(item.composition ? `${item.composition} / ${item.profile}` : item.profile)} · ${esc(item.target)}</span>
      `).join('')
    : '<span class="recipe-usage-pill muted">not assigned</span>';
  const recipeAssignment = profile.targets.find(target => target.name === activeRecipe.target && target.recipe === activeRecipe.name);
  const recipeProfileName = recipeAssignment?.profile ?? (recipeAssignment ? profile.name : activeRecipe.usages[0]?.profile ?? profile.name);
  const recipeProfile = profiles.profiles.find(item => item.name === recipeProfileName);
  const recipeBasePalette = activeRecipe.basePalette ?? activeRecipe.raw.basePalette ?? recipeProfile?.basePalette ?? 'unknown';
  const recipeMood = previewTarget?.mood ?? recipeProfile?.mood ?? profile.mood;
  const recipeSource = previewTarget?.source ?? recipeProfile?.source ?? profile.source;
  const recipeBasePalettePath = recipeProfile?.basePalettePath ?? `palettes/${recipeBasePalette}.json`;
  const recipeBloomPath = recipeProfile?.bloomPath ?? `~/.cache/unclaimed-bloom/blooms/${recipeProfileName}.json`;
  const recipeSourcePath = recipeProfile?.sourcePath;
  const recipeContext = recipeAssignment && recipeAssignment.profile && recipeAssignment.profile !== profile.name
    ? `${profile.name} uses ${recipeProfileName} for ${activeRecipe.target}`
    : `${recipeProfileName} profile`;

  contentEl.innerHTML = `
    <section class="overview-hero recipe-hero">
      <div class="recipe-hero-title">
        <p class="eyebrow">Recipe Workshop</p>
        <h1>${esc(activeRecipe.target)} / ${esc(activeRecipe.name)}</h1>
        <p>Read-only. Preview only. No files harmed yet.</p>
        <p class="recipe-context-line">${esc(recipeContext)}</p>
      </div>
      <div class="recipe-hero-notes" aria-label="Recipe table column notes">
        <span title="${esc(recipeBasePalettePath)}">
          <strong>base</strong>
          <code>${esc(recipeBasePalette)}</code>
          <small>palette tokens from ${esc(recipeBasePalettePath)}</small>
        </span>
        <span title="${esc(recipeBloomPath)}">
          <strong>bloom</strong>
          <code>${esc(recipeProfileName)} / ${esc(recipeMood)}</code>
          <small>semantic palette grown from base + ${esc(recipeSource)} source, stored in ${esc(recipeBloomPath)}</small>
        </span>
        <span title="${esc(recipeSourcePath ?? `${recipeSource} source provider`)}">
          <strong>source</strong>
          <code>${esc(recipeSource)}</code>
          <small>${esc(recipeSourcePath ? `source colors from ${recipeSourcePath}` : 'source provider tokens; no file path exposed')}</small>
        </span>
        <span title="Final resolved output color for this target token.">
          <strong>result</strong>
          <code>${esc(activeRecipe.target)}</code>
          <small>final target color written by the spore</small>
        </span>
      </div>
      <div class="overview-stats">
        <span><strong>${activeRecipe.tokenCount}</strong> tokens</span>
        <span><strong>${activeRecipe.usages.length}</strong> uses</span>
      </div>
    </section>
    <section class="recipe-workshop-layout">
      <aside class="recipe-browser">
        <div class="section-heading">
          <h2>Recipes</h2>
          <span>${targetRecipes.length} for ${esc(selectedTarget)} · ${recipesData.recipes.length} loaded</span>
        </div>
        <div class="recipe-grid">${recipeCards}</div>
      </aside>
      <section class="recipe-detail">
        <div class="section-heading">
          <h2>Recipe Details</h2>
          <span>${esc(activeRecipe.path)}</span>
          <button class="action-btn${recipeEditMode ? ' active' : ''}" id="toggle-recipe-edit">${recipeEditMode ? 'cancel edit' : 'edit recipe'}</button>
          ${recipeEditMode ? `<button class="action-btn primary" id="save-recipe-btn">save recipe</button>` : ''}
        </div>
        ${recipeEditMode ? renderRecipeEditForm(activeRecipe) : ''}
        <div class="recipe-usage-list">${usage}</div>
        ${!recipeEditMode ? `<div class="recipe-token-table">
          <div class="recipe-token-header">
            <span title="Target token name from the selected recipe JSON.">token</span>
            <span title="Recipe base color. Usually a named token from the recipe basePalette, before bloom/source mixing.">base</span>
            <span title="Semantic color from the generated profile bloom, for example accent.primary or surface.base.">bloom</span>
            <span title="Wallpaper/source palette color pulled by the recipe, usually from Matugen source tokens.">source</span>
            <span title="How much source color is mixed into the base or bloom color. 0 keeps base/bloom; 1 fully uses source.">mix</span>
            <span title="Final resolved color that this target token will use in the generated spore/output.">result</span>
          </div>
          ${tokenRows}
        </div>` : ''}
        <details class="raw-recipe-panel">
          <summary>Raw JSON</summary>
          <pre><code>${esc(JSON.stringify(activeRecipe.raw, null, 2))}</code></pre>
        </details>
      </section>
    </section>`;

  contentEl.querySelectorAll<HTMLButtonElement>('.recipe-card').forEach(btn => {
    btn.addEventListener('click', () => {
      activeRecipeId = btn.dataset['recipeId'] ?? activeRecipeId;
      recipeEditMode = false;
      recipeEditData = null;
      const selectedRecipe = targetRecipes.find(recipe => recipe.id === activeRecipeId);
      if (selectedRecipe && profile.targets.some(target => target.name === selectedRecipe.target)) {
        activeTarget = selectedRecipe.target;
        actionTarget = selectedRecipe.target;
      }
      renderTargetList();
      renderControls();
      renderRecipes();
    });
  });

  contentEl.querySelector<HTMLButtonElement>('#toggle-recipe-edit')?.addEventListener('click', () => {
    recipeEditMode = !recipeEditMode;
    if (!recipeEditMode) recipeEditData = null;
    renderRecipes();
  });

  if (recipeEditMode) bindRecipeEditEvents();

  contentEl.querySelector<HTMLButtonElement>('#save-recipe-btn')?.addEventListener('click', () => {
    if (!recipeEditData) return;
    const updatedTokens: Record<string, TokenRecipe> = {};
    for (const t of recipeEditData.tokens) {
      const raw = recipeEditTokenToRaw(t);
      if (raw && t.name) updatedTokens[t.name] = raw;
    }
    const updated = {
      ...activeRecipe.raw,
      name: recipeEditData.name || activeRecipe.raw.name,
      ...(recipeEditData.basePalette ? { basePalette: recipeEditData.basePalette } : {}),
      tokens: updatedTokens,
    };
    void saveAndMaybeApply(() => apiSaveRecipe(activeRecipe.path, updated), `recipe ${activeRecipe.name}`).then(() => {
      activeRecipe.raw = updated;
      recipeEditMode = false;
      recipeEditData = null;
      renderRecipes();
    });
  });
}

async function runAction(action: 'sow' | 'grow' | 'plant') {
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
  const compositionBloomContext = profile?.runs && profile.runs.length > 0 ? `
        <section class="group bloom-composition">
            <div class="section-heading">
                <h2>Composition Bloom Sources</h2>
                <span>Selected profile is composed; one bloom does not feed every target.</span>
            </div>
            <div class="composition-list">
                ${profile.runs.map((run, index) => {
                  const runProfile = profiles.profiles.find(item => item.name === run.profile);
                  const runBloom = blooms[run.profile];
                  const runTargets = run.targets ?? runProfile?.targets.map(target => target.name) ?? [];
                  const targetLabel = runTargets.length === 1
                    ? `1 target: ${runTargets[0]}`
                    : `${runTargets.length} targets`;
                  return `
                    <button class="composition-run" type="button" data-composition-profile="${esc(run.profile)}">
                        <span class="composition-index">${index + 1}</span>
                        <div>
                            <h3>${esc(run.profile)}</h3>
                            <p>${esc(targetLabel)} · ${esc(runProfile?.basePalette ?? 'unknown palette')} · ${esc(runProfile?.mood ?? 'unknown mood')} · bloom ${esc(fmtTime(runBloom?.generatedAt))}</p>
                        </div>
                    </button>`;
                }).join('')}
            </div>
        </section>` : '';
  const allSwatches = GROUP_ORDER.flatMap(group => Object.entries(preview.colors[group] ?? {})
    .map(([name, hex]) => ({ group, name, hex })));
  const heroSwatches = allSwatches.slice(0, 18);
  const paletteStrip = heroSwatches.map(swatch => `
        <span class="bloom-strip-swatch" style="background:${esc(swatch.hex)}" title="${esc(`${swatch.group}.${swatch.name} ${swatch.hex}`)}"></span>
    `).join('');
  const keyTokens = [
    ['surface.base', preview.colors.surface?.base],
    ['surface.raised', preview.colors.surface?.raised],
    ['text.primary', preview.colors.text?.primary],
    ['accent.primary', preview.colors.accent?.primary],
    ['accent.secondary', preview.colors.accent?.secondary],
    ['state.danger', preview.colors.state?.danger],
  ].filter((item): item is [string, string] => typeof item[1] === 'string');
  const keyTokenCards = keyTokens.map(([name, hex]) => `
        <article class="bloom-token-card">
            <span class="bloom-token-card-swatch" style="background:${esc(hex)}"></span>
            <span class="bloom-token-card-name">${esc(name)}</span>
            <code>${esc(hex)}</code>
        </article>
    `).join('');
  const summary = `
        <section class="bloom-overview">
            <div class="bloom-overview-copy">
                <p class="eyebrow">Bloom Preview</p>
                <h1>${esc(preview.profile)}</h1>
                <p class="bloom-source-line">${esc(sourceLine)}</p>
                ${profile?.type === 'composition' ? '<p class="bloom-source-line">composition view · preview follows the current/source bloom; runs below show the split.</p>' : ''}
                <p class="bloom-generated">generated ${esc(fmtTime(preview.generatedAt))}</p>
                ${targetLine ? `<p class="bloom-target-line">${esc(targetLine)}</p>` : ''}
            </div>
            <div class="bloom-overview-side">
                <div class="bloom-strip">${paletteStrip}</div>
                <div class="bloom-token-card-grid">${keyTokenCards}</div>
            </div>
        </section>`;

  const previewSections = GROUP_ORDER
    .filter(group => Object.keys(preview.colors[group] ?? {}).length > 0)
    .map(group => {
      const rows = preview.rows.filter(row => row.group === group);
      const groupSwatches = Object.entries(preview.colors[group] ?? {}).map(([name, hex]) => `
                <span class="group-strip-swatch" style="background:${esc(hex)}" title="${esc(`${group}.${name} ${hex}`)}"></span>
            `).join('');
      const rowsHtml = rows.map(row => `
                <div class="bloom-derivation-row">
                    <span class="bloom-derivation-token" title="${esc(row.path)}">
                        <strong>${esc(row.name)}</strong>
                        <span>${esc(row.path)}</span>
                    </span>
                    <span class="bloom-derivation-cell">
                        <span class="mini-chip" style="background:${esc(row.baseHex)}"></span>
                        <span class="bloom-derivation-text">
                            <span class="bloom-derivation-key">${esc(row.baseKey)}</span>
                            <span class="bloom-derivation-hex">${esc(row.baseHex)}</span>
                        </span>
                    </span>
                    <span class="bloom-derivation-mood">
                        <span class="mix-meter" title="${esc(`source weight ${row.weight.toFixed(2)}`)}">
                            <span style="width:${esc(`${Math.max(0, Math.min(1, row.weight)) * 100}%`)}"></span>
                        </span>
                        <span class="mood-pill">${esc(row.weight.toFixed(2))}</span>
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
                    <div class="bloom-group-heading">
                        <div>
                            <h2>${group}</h2>
                            <p>${rows.length} tokens · palette + source + mood weight</p>
                        </div>
                        <div class="group-strip">${groupSwatches}</div>
                    </div>
                    <div class="bloom-derivation-table">
                        <div class="bloom-derivation-header">
                            <span>token</span>
                            <span>base palette</span>
                            <span>source pull</span>
                            <span>source</span>
                            <span>=&gt; bloom</span>
                        </div>
                        ${rowsHtml}
                    </div>
                </section>`;
    }).join('');

  contentEl.innerHTML = summary + compositionBloomContext + previewSections;
  contentEl.querySelectorAll<HTMLButtonElement>('[data-composition-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      const profileName = btn.dataset['compositionProfile'] ?? '';
      if (!profiles.profiles.some(item => item.name === profileName)) return;
      active = profileName;
      activeTarget = '';
      actionTarget = '';
      resetRecipeSelection();
      applyBloomUiPalette();
      renderTabs();
      renderTargetList();
      renderControls();
      renderBloom();
    });
  });
}

// --- Inspect view ---

function chip(hex: string): string {
  return `<span class="mini-chip" style="background:${hex}"></span>`;
}

function renderTargetTabs(data: InspectData): string {
  const targets = Object.keys(data.targets);
  if (!activeTarget || !(activeTarget in data.targets)) {
    activeTarget = targets[0] ?? '';
    actionTarget = activeTarget;
    resetRecipeSelection();
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
      actionTarget = activeTarget;
      resetRecipeSelection();
      renderTargetList();
      renderControls();
      renderPipeline();
    });
  });
}

function renderTokenRow(t: TokenRow): string {
  const mixWidth = `${Math.max(0, Math.min(1, t.mix)) * 100}%`;
  return `
        <div class="inspect-pipeline-row">
            <span class="pipeline-token" title="${esc(t.name)}">
                <strong>${esc(t.name)}</strong>
                <span>target token</span>
            </span>
            <span class="pipeline-chip" title="${esc(t.baseKey)}">
                ${chip(t.baseHex)}
                <span>
                    <strong>${esc(t.baseKey)}</strong>
                    <code>${esc(t.baseHex)}</code>
                </span>
            </span>
            <span class="pipeline-arrow">+</span>
            <span class="pipeline-chip" title="${esc(t.srcKey)}">
                ${chip(t.srcHex)}
                <span>
                    <strong>${esc(t.srcKey)}</strong>
                    <code>${esc(t.srcHex)}</code>
                </span>
            </span>
            <span class="pipeline-mix">
                <span class="mix-meter"><span style="width:${esc(mixWidth)}"></span></span>
                <code>${esc(t.mix.toFixed(2))}</code>
            </span>
            <span class="pipeline-arrow">=</span>
            <span class="pipeline-chip pipeline-result">
                ${chip(t.result)}
                <span>
                    <strong>target result</strong>
                    <code>${esc(t.result)}</code>
                </span>
            </span>
        </div>`;
}

function renderPipeline() {
  const data = pipelineCache[active];
  if (!data) {
    contentEl.innerHTML = '<p class="empty">Loading inspect data…</p>';
    fetchPipeline(active);
    return;
  }

  const targetTabs = renderTargetTabs(data);
  const target = activeTarget;
  const targetInspect = data.targets[target];
  const referenceBloom = targetInspect?.bloom ?? data.bloom;
  const referenceProfile = targetInspect?.profile ?? data.profile;
  const referenceBasePalette = targetInspect?.basePalette ?? data.basePalette;
  const referenceMood = targetInspect?.mood ?? data.mood;
  const referenceSource = targetInspect?.source ?? data.source;
  const targetResults = targetInspect?.tokens.slice(0, 12).map(token => `
        <span class="inspect-result-strip-swatch" style="background:${esc(token.result)}" title="${esc(`${token.name} ${token.result}`)}"></span>
    `).join('') ?? '';
  const targetSection = targetInspect ? `
        <section class="inspect-hero">
            <div>
                <p class="eyebrow">Inspect Pipeline</p>
                <h1>${esc(target)}</h1>
                <p>${esc(data.profile)}${referenceProfile !== data.profile ? ` · from ${esc(referenceProfile)}` : ''} · recipe ${esc(targetInspect.recipe)} · ${targetInspect.tokens.length} tokens</p>
            </div>
            <div class="inspect-result-strip">${targetResults}</div>
        </section>
        <section class="group inspect-target">
            <div class="target-heading">
                <div>
                    <h2>Recipe transformation</h2>
                    <p>Bloom/base token + source tint + mix weight => target color.</p>
                </div>
                <span class="recipe-name">${esc(targetInspect.recipe)}</span>
            </div>
            <div class="inspect-pipeline-table">
                <div class="inspect-pipeline-header">
                    <span class="col-name">token</span>
                    <span>base / bloom</span>
                    <span></span>
                    <span>source tint</span>
                    <span>mix</span>
                    <span></span>
                    <span>result</span>
                </div>
                ${targetInspect.tokens.map(renderTokenRow).join('')}
            </div>
        </section>` : '<p class="empty">No target selected.</p>';

  const bloomSection = `
        <section class="group inspect-bloom">
            <div class="section-heading">
                <h2>Bloom Reference</h2>
                <span>${esc(referenceProfile)} · ${esc(referenceBasePalette)} · ${esc(referenceMood)} · ${esc(referenceSource)}</span>
            </div>
            ${Object.entries(referenceBloom).map(([group, tokens]) => `
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

  contentEl.innerHTML = targetTabs + targetSection + bloomSection;
  bindTargetTabs();
  renderTargetList();
  renderControls();
}

async function fetchPipeline(profileName: string) {
  try {
    const res = await fetch(`/api/pipeline/${encodeURIComponent(profileName)}`);
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    const data = await res.json() as InspectData;
    pipelineCache[profileName] = data;
    if (active === profileName && view === 'pipeline') renderPipeline();
    if (active === profileName && view === 'recipes') renderRecipes();
  } catch (err) {
    contentEl.innerHTML = `<p class="empty">Could not load pipeline data: ${err instanceof Error ? err.message : String(err)}</p>`;
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

async function fetchRecipes() {
  try {
    const res = await fetch('/api/recipes');
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    recipesData = await res.json() as RecipesResponse;
    if (view === 'recipes') renderRecipes();
  } catch (err) {
    contentEl.innerHTML = `<p class="empty">Could not load recipes: ${err instanceof Error ? err.message : String(err)}</p>`;
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
      resetRecipeSelection();
      applyBloomUiPalette();
      renderTabs();
      renderTargetList();
      renderControls();

      if (action === 'inspect') {
        setView('pipeline');
        return;
      }

      if (action === 'sow' || action === 'grow' || action === 'plant') {
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
  if (view === 'overview') {
    renderOverview();
  } else if (view === 'bloom') {
    renderBloom();
  } else if (view === 'pipeline') {
    renderPipeline();
  } else if (view === 'recipes') {
    renderRecipes();
  } else if (view === 'moods') {
    renderMoods();
  } else if (view === 'palettes') {
    renderPalettes();
  } else {
    renderDocs();
  }
}

function applyBlooms(data: Blooms, pulse = true) {
  blooms = data;
  bloomPreviewCache = {};
  pipelineCache = {}; // blooms changed → inspect data stale
  if (!active) active = pickInitialProfile();
  activeTarget = '';
  resetRecipeSelection();
  applyBloomUiPalette();
  renderControls();
  renderTargetList();
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
  renderTargetList();
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

// --- Save + apply flow ---

async function saveAndMaybeApply(
  saveFn: () => Promise<SaveResult>,
  label: string,
): Promise<void> {
  let result: SaveResult;
  try { result = await saveFn(); }
  catch (err) { showRunOutput(`Save failed: ${label}`, err instanceof Error ? err.message : String(err), false); return; }

  if (!result.ok) { showRunOutput(`Save failed: ${label}`, result.error ?? 'unknown', false); return; }

  const profile = activeProfile();
  runOutputEl.hidden = false;
  runOutputEl.className = 'run-output ok';
  runOutputEl.innerHTML = `
    <div class="run-output-title">${esc(label)} saved${result.path ? ` → ${esc(result.path)}` : ''}</div>
    <div class="apply-prompt">
      <p>Apply to current profile?</p>
      ${profile ? `<button class="action-btn primary" id="apply-sow-grow">sow + grow ${esc(profile.name)}</button>` : ''}
      <button class="action-btn" id="apply-dismiss">not yet</button>
    </div>`;

  runOutputEl.querySelector('#apply-sow-grow')?.addEventListener('click', async () => {
    runOutputEl.innerHTML = `<div class="run-output-title">running sow + grow…</div>`;
    await runAction('sow');
    await runAction('grow');
  });
  runOutputEl.querySelector('#apply-dismiss')?.addEventListener('click', () => { runOutputEl.hidden = true; });
}

async function apiSaveRecipe(path: string, recipe: unknown): Promise<SaveResult> {
  const res = await fetch('/api/recipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, recipe }) });
  return res.json() as Promise<SaveResult>;
}

async function apiSaveMood(name: string, mood: unknown): Promise<SaveResult> {
  const res = await fetch(`/api/mood/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mood) });
  return res.json() as Promise<SaveResult>;
}

async function apiSaveProfile(name: string, profile: unknown): Promise<SaveResult> {
  const res = await fetch(`/api/profile/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
  return res.json() as Promise<SaveResult>;
}

async function apiSavePalette(slug: string, palette: unknown): Promise<SaveResult> {
  const res = await fetch(`/api/palette/${encodeURIComponent(slug)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(palette) });
  return res.json() as Promise<SaveResult>;
}

// --- Mood editor ---

function renderMoods(): void {
  if (moodsData.length === 0) {
    contentEl.innerHTML = '<p class="empty">Loading moods…</p>';
    void fetchMoods();
    return;
  }
  if (!activeMoodName) activeMoodName = moodsData[0]?.name ?? '';
  const mood = moodsData.find(m => m.name === activeMoodName);

  const moodList = moodsData.map(m => `
    <button class="mood-list-item${m.name === activeMoodName ? ' active' : ''}" data-mood="${esc(m.name)}">
      ${esc(m.name)}
      <small>${esc(m.description ?? '')}</small>
    </button>`).join('');

  const moodEditor = mood ? `
    <div class="mood-editor-panel">
      <p class="mood-editor-name">${esc(mood.name)}</p>
      <div class="mood-editor-desc">
        <label class="eyebrow">Description</label>
        <input id="mood-desc" type="text" value="${esc(mood.description ?? '')}" />
      </div>
      <div class="mood-weight-rows">
        ${(['surface', 'foreground', 'accent', 'semantic'] as const).map(key => `
          <div class="mood-weight-row">
            <span class="mood-weight-label">${key}</span>
            <input type="range" class="weight-slider" id="mood-w-${key}" min="0" max="1" step="0.01" value="${mood.weights[key]}" />
            <span class="mood-weight-value" id="mood-wv-${key}">${mood.weights[key].toFixed(2)}</span>
          </div>`).join('')}
      </div>
      <div class="editor-toolbar">
        <button class="action-btn primary" id="save-mood-btn">Save mood</button>
      </div>
    </div>` : '<p class="empty">Select a mood to edit.</p>';

  contentEl.innerHTML = `
    <section class="overview-hero">
      <div><p class="eyebrow">Mood Editor</p><h1>Moods</h1><p>${moodsData.length} moods · adjust blend weights</p></div>
    </section>
    <div class="mood-editor-layout">
      <div class="mood-list">${moodList}</div>
      ${moodEditor}
    </div>`;

  contentEl.querySelectorAll<HTMLButtonElement>('.mood-list-item').forEach(btn => {
    btn.addEventListener('click', () => { activeMoodName = btn.dataset['mood'] ?? ''; renderMoods(); });
  });

  if (mood) {
    (['surface', 'foreground', 'accent', 'semantic'] as const).forEach(key => {
      const slider = contentEl.querySelector<HTMLInputElement>(`#mood-w-${key}`);
      const label = contentEl.querySelector<HTMLElement>(`#mood-wv-${key}`);
      slider?.addEventListener('input', () => { if (label) label.textContent = Number(slider.value).toFixed(2); });
    });

    contentEl.querySelector<HTMLButtonElement>('#save-mood-btn')?.addEventListener('click', () => {
      const desc = (contentEl.querySelector<HTMLInputElement>('#mood-desc'))?.value ?? mood.description ?? '';
      const weights = Object.fromEntries(
        (['surface', 'foreground', 'accent', 'semantic'] as const).map(key => [
          key,
          Number((contentEl.querySelector<HTMLInputElement>(`#mood-w-${key}`))?.value ?? mood.weights[key]),
        ])
      );
      const updated = { name: mood.name, ...(desc ? { description: desc } : {}), weights };
      void saveAndMaybeApply(() => apiSaveMood(mood.name, updated), `mood ${mood.name}`).then(() => {
        const idx = moodsData.findIndex(m => m.name === mood.name);
        if (idx >= 0) moodsData[idx] = { ...mood, description: desc, weights: weights as typeof mood.weights };
      });
    });
  }
}

async function fetchMoods(): Promise<void> {
  const res = await fetch('/api/moods');
  const data = await res.json() as { ok: boolean; moods: MoodFull[] };
  moodsData = data.moods ?? [];
  if (view === 'moods') renderMoods();
}

// --- Palette editor ---

function renderPalettes(): void {
  if (palettesData.length === 0) {
    contentEl.innerHTML = '<p class="empty">Loading palettes…</p>';
    void fetchPalettes();
    return;
  }
  if (!activePaletteName) activePaletteName = palettesData[0]?.slug ?? '';
  const palette = palettesData.find(p => p.slug === activePaletteName);

  const paletteList = palettesData.map(p => `
    <button class="palette-list-item${p.slug === activePaletteName ? ' active' : ''}" data-slug="${esc(p.slug)}">
      <span class="palette-kind-badge">${esc(p.kind)}</span>
      ${esc(p.name)}
    </button>`).join('');

  const colorRows = palette ? Object.entries(palette.colors).map(([name, hex]) => `
    <div class="palette-color-row">
      <span class="palette-color-swatch" id="swatch-${esc(name)}" style="background:${esc(hex)}"></span>
      <span class="palette-color-name" title="${esc(name)}">${esc(name)}</span>
      <input class="palette-color-input" data-color="${esc(name)}" type="text" value="${esc(hex)}" maxlength="7" spellcheck="false" />
    </div>`).join('') : '';

  contentEl.innerHTML = `
    <section class="overview-hero">
      <div><p class="eyebrow">Palette Editor</p><h1>Palettes</h1><p>${palettesData.length} palettes · edit base color tokens</p></div>
    </section>
    <div class="palette-editor-layout">
      <div class="palette-list">${paletteList}</div>
      <div class="palette-editor-panel">
        ${palette ? `
          <p class="palette-editor-name">${esc(palette.name)}</p>
          <div class="editor-toolbar">
            <span class="eyebrow">${Object.keys(palette.colors).length} colors</span>
            <span class="spacer"></span>
            <button class="action-btn primary" id="save-palette-btn">Save palette</button>
          </div>
          <div class="palette-color-grid">${colorRows}</div>` : '<p class="empty">Select a palette.</p>'}
      </div>
    </div>`;

  contentEl.querySelectorAll<HTMLButtonElement>('.palette-list-item').forEach(btn => {
    btn.addEventListener('click', () => { activePaletteName = btn.dataset['slug'] ?? ''; renderPalettes(); });
  });

  if (palette) {
    contentEl.querySelectorAll<HTMLInputElement>('.palette-color-input').forEach(input => {
      input.addEventListener('input', () => {
        const hex = input.value.trim();
        const swatch = contentEl.querySelector<HTMLElement>(`#swatch-${CSS.escape(input.dataset['color'] ?? '')}`);
        if (swatch && /^#[0-9a-f]{6}$/i.test(hex)) swatch.style.background = hex;
      });
    });

    contentEl.querySelector<HTMLButtonElement>('#save-palette-btn')?.addEventListener('click', () => {
      const colors: Record<string, string> = {};
      contentEl.querySelectorAll<HTMLInputElement>('.palette-color-input').forEach(input => {
        colors[input.dataset['color'] ?? ''] = input.value.trim();
      });
      const updated = { name: palette.name, slug: palette.slug, kind: palette.kind, colors };
      void saveAndMaybeApply(() => apiSavePalette(palette.slug, updated), `palette ${palette.name}`).then(() => {
        const idx = palettesData.findIndex(p => p.slug === palette.slug);
        if (idx >= 0) palettesData[idx] = { ...palette, colors };
      });
    });
  }
}

async function fetchPalettes(): Promise<void> {
  const res = await fetch('/api/palettes');
  const data = await res.json() as { ok: boolean; palettes: PaletteWithColors[] };
  palettesData = data.palettes ?? [];
  if (view === 'palettes') renderPalettes();
}

// --- Run toast ---

function renderToast(): void {
  if (!runState) {
    toastEl.hidden = true;
    return;
  }

  const targets = Object.entries(runState.targets);
  const dots = targets.map(([name, t]) =>
    `<span class="run-dot ${esc(t.status)}" title="${esc(name)}"></span>`
  ).join('');

  const doneCount = targets.filter(([, t]) => t.status === 'done').length;
  const errCount  = targets.filter(([, t]) => t.status === 'error').length;
  const progress  = `${doneCount}${errCount > 0 ? `+${errCount}err` : ''}/${targets.length}`;

  toastEl.classList.remove('exiting');
  toastEl.hidden = false;
  toastEl.innerHTML = `
    <div class="run-toast-row">
      <span class="run-toast-profile">${esc(runState.profile)}</span>
      <span class="run-toast-stage">${esc(runState.stage)}</span>
      <div class="run-toast-targets">${dots}</div>
      <span class="run-toast-progress">${esc(progress)}</span>
      <span class="run-toast-status ${esc(runState.status)}">${esc(runState.status)}</span>
    </div>`;
}

function applyRunState(state: RunStateData): void {
  const age = Date.now() - new Date(state.updated_at).getTime();
  // Show if running (regardless of age), or if recently finished (< 10s)
  if (state.status !== 'running' && age >= 10_000) return;

  runState = state;
  clearTimeout(toastDismissTimer);

  if (state.status !== 'running') {
    toastDismissTimer = setTimeout(() => {
      toastEl.classList.add('exiting');
      setTimeout(() => { runState = null; renderToast(); }, 280);
    }, 3000);
  }

  renderToast();
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
    const msg = JSON.parse(e.data as string) as { type: string; blooms?: Blooms; profiles?: ProfilesResponse; state?: RunStateData };
    if (msg.type === 'blooms' && msg.blooms) applyBlooms(msg.blooms);
    if (msg.type === 'profiles' && msg.profiles) applyProfiles(msg.profiles);
    if (msg.type === 'state' && msg.state) applyRunState(msg.state);
  };
}

Promise.all([
  fetch('/api/profiles').then(r => r.json() as Promise<ProfilesResponse>),
  fetch('/api/blooms').then(r => r.json() as Promise<Blooms>),
  fetch('/api/docs').then(r => r.json() as Promise<DocsIndexResponse>),
  fetch('/api/recipes').then(r => r.json() as Promise<RecipesResponse>),
  fetch('/api/state').then(r => r.json() as Promise<{ ok: boolean; state: RunStateData | null }>).catch(() => ({ ok: false, state: null })),
])
  .then(([profileData, bloomData, docsData, recipeData, stateData]) => {
    docsIndex = docsData;
    activeDoc = docsIndex.defaultDoc;
    recipesData = recipeData;
    profiles = profileData;
    blooms = bloomData;
    active = pickInitialProfile();
    activeTarget = '';
    actionTarget = '';
    resetRecipeSelection();
    applyBloomUiPalette();
    renderTabs();
    renderTargetList();
    renderControls();
    render();
    if (stateData.state) applyRunState(stateData.state);
  })
  .catch(() => { contentEl.innerHTML = '<p class="empty">Could not reach workbench server.</p>'; });

connect();
