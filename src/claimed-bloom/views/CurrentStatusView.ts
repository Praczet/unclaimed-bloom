import {
  bg,
  BoxRenderable,
  dim,
  fg,
  ScrollBoxRenderable,
  TextRenderable,
  TextTableRenderable,
  type TextChunk,
} from "@opentui/core";

import type { View, ViewContext } from "../app/types.ts";
import type {
  SporeStatus,
  SporeStatusSpore,
  SporeStatusStage,
} from "../services/types.ts";
import { formatDuration } from "../app/utils.ts";

export function createCurrentStatusView(context: ViewContext): View {
  let destroyed = false;

  const root = new BoxRenderable(context.renderer, {
    width: "100%",
    flexDirection: "column",
    backgroundColor: context.colors.panel,
    padding: 1,
    margin: 1,
  });

  const details = new BoxRenderable(context.renderer, {
    title: "Loading...",
    borderColor: context.colors.muted,
    borderStyle: "rounded",
    marginBottom: 1,
    flexShrink: 0,
    padding: 1,
  });
  const detailsContent = new TextRenderable(context.renderer, {
    content: "Loading current status...",
    fg: context.colors.muted,
    padding: 1,
  });
  details.add(detailsContent);

  const scroll = new ScrollBoxRenderable(context.renderer, {
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    viewportCulling: true,
    verticalScrollbarOptions: {
      visible: true,
    },
  });

  const actionStatus = new TextRenderable(context.renderer, {
    content: "",
    fg: context.colors.muted,
    flexShrink: 0,
  });

  const table = new TextTableRenderable(context.renderer, {
    width: "100%",
    content: [],
    columnWidthMode: "full",
    columnFitter: "proportional",
    cellPaddingX: 1,
    showBorders: true,
    outerBorder: true,
    borderStyle: "single",
    borderColor: context.colors.panelRised,
    backgroundColor: context.colors.panel,
    fg: context.colors.foreground,
    wrapMode: "word",
  });

  root.add(details);
  scroll.add(table);
  root.add(scroll);
  root.add(actionStatus);

  void context.spore
    .getStatus()
    .then((loadedStatus) => {
      if (destroyed) return;
      details.title = `Current Status (Profile: ${loadedStatus.currentProfile ?? "none"})`;
      detailsContent.content = renderStatusDetails(loadedStatus);
      table.content = createTableContent(loadedStatus.spores, context.colors);
      actionStatus.content = renderStray(loadedStatus);
    })
    .catch((error: unknown) => {
      if (destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      detailsContent.content = `Failed to load status:\n${message}`;
    });

  return {
    root,
    title: "Status:=> I mean current status of the Spore and Bloom",
    shortcuts: ["↑↓ Scroll", "PgUp/PgDn Scroll", "ESC => back", "q => Quit"],
    onKey(key: string): void {
      if (key === "q") {
        context.exit();
      } else if (key === "up") {
        scroll.scrollBy({ x: 0, y: -1 }, "step");
      } else if (key === "down") {
        scroll.scrollBy({ x: 0, y: 1 }, "step");
      } else if (key === "pageup") {
        scroll.scrollBy({ x: 0, y: -8 }, "step");
      } else if (key === "pagedown") {
        scroll.scrollBy({ x: 0, y: 8 }, "step");
      }
    },
    destroy(): void {
      destroyed = true;
      root.destroyRecursively();
    },
  };
}

function renderStatusDetails(status: SporeStatus): string {
  const { paths, profile } = status;
  const lines = [
    `CWD:               ${paths.cwd}`,
    `Home:              ${paths.home}`,
    `Data Dir:          ${paths.dataDir} (source: ${paths.dataDirSource})`,
    `Cache Dir:         ${paths.cacheDir} (source: ${paths.cacheDirSource})`,
    `Default Data Dir:  ${paths.defaultDataDir}`,
    `Default Cache Dir: ${paths.defaultCacheDir}`,
    "",
  ];

  if (profile) {
    if (profile.name !== status.currentProfile) {
      lines.push(`Profile:           ${profile.name} (last run)`);
    }
    if (profile.type === "composition") {
      lines.push(`Type:              composition, ${profile.runs.length} runs`);
      lines.push(`Source Profile:    ${profile.sourceProfile}`);
    }
    for (const run of profile.runs) {
      lines.push(
        `Run:               ${run.profile} (palette: ${run.basePalette}, mood: ${run.mood}, targets: ${run.targets.length})`,
      );
    }
  } else if (status.profileError) {
    lines.push(`Profile:           ${status.profileError}`);
  }

  lines.push(
    "",
    `Sow:               ${formatStage(status.stages.sow)}`,
    `Grow:              ${formatStage(status.stages.grow)}`,
    `Plant:             ${formatStage(status.stages.plant)}`,
  );

  return lines.join("\n");
}

function formatStage(stage: SporeStatusStage | null): string {
  if (!stage) return "never run";
  const targets = `Targets: ${Object.keys(stage.targets).length}, ${stage.status} (${formatDates(stage)})`;
  return stage.inSync ? targets : `${targets} — ran for ${stage.profile}`;
}

function formatDates(stage: SporeStatusStage) {
  const startedAt = new Date(stage.started_at);
  const updatedAt = new Date(stage.updated_at);
  const duration = formatDuration(updatedAt.getTime() - startedAt.getTime());
  // if the day is the same, only show the time for updated_at and duration
  if (startedAt.toDateString() === updatedAt.toDateString()) {
    return `Updated at: ${updatedAt.toLocaleTimeString()} (Duration: ${duration})`;
  } else {
    return `Started at: ${startedAt.toLocaleString()}, Updated at: ${updatedAt.toLocaleString()} (Duration: ${duration})`;
  }
}

function renderStray(status: SporeStatus): string {
  if (status.stray.length === 0) return "";
  const stray = status.stray.map((s) => `${s.profile}/${s.target}`).join(", ");
  return `Stray spores (cached, not used by ${status.profile?.name}): ${stray}`;
}

function createTableContent(
  spores: SporeStatusSpore[],
  colors: Record<string, string>,
): TextChunk[][][] {
  const header = ["TARGET", "PROFILE", "RECIPE", "SOWN", "COLORS"].map((label) => [
    fg(themeColor(colors, "green", "#80d9ab"))(label),
  ]);

  return [header, ...spores.map((spore) => createRow(spore, colors))];
}

function createRow(spore: SporeStatusSpore, colors: Record<string, string>): TextChunk[][] {
  const foreground = fg(themeColor(colors, "foreground", "#d9ebe3"));
  const muted = fg(themeColor(colors, "muted", "#8da89e"));

  return [
    [foreground(spore.target)],
    [muted(spore.profile)],
    recipeCell(spore, foreground, muted),
    [muted(spore.generatedAt ? new Date(spore.generatedAt).toLocaleString() : "—")],
    swatches(spore.colors, 8),
  ];
}

function recipeCell(
  spore: SporeStatusSpore,
  foreground: (text: string) => TextChunk,
  muted: (text: string) => TextChunk,
): TextChunk[] {
  if (!spore.recipe) return [muted(`not sown (${spore.expectedRecipe})`)];
  if (spore.recipe !== spore.expectedRecipe) {
    return [foreground(spore.recipe), muted(` → ${spore.expectedRecipe}`)];
  }
  return [foreground(spore.recipe)];
}

function swatches(colors: Record<string, string>, count: number): TextChunk[] {
  const hexValues = Object.values(colors);
  if (hexValues.length === 0) return [dim("—")];
  const step = Math.max(1, Math.floor(hexValues.length / count));
  const chunks: TextChunk[] = [];
  for (let i = 0; i < hexValues.length && chunks.length < count; i += step) {
    chunks.push(bg(hexValues[i]!)("  "));
  }
  return chunks;
}

function themeColor(colors: Record<string, string>, name: string, fallback: string): string {
  return colors[name] ?? fallback;
}
