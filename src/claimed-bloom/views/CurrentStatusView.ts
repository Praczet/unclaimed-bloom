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
import type { SporeStatus, SporeStatusProcess } from "../services/types.ts";
import { formatDate, formatDuration } from "../app/utils.ts";

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

  let status: SporeStatus | undefined;

  void context.spore
    .getStatus()
    .then((loadedStatus) => {
      if (destroyed) return;
      status = loadedStatus;
      details.title = `Current Status (Profile: ${loadedStatus.currentProfile})`;
      detailsContent.content = renderStatusDetails(loadedStatus);
      // table.content = createTableContent(loadedPreview, context.colors);
    })
    .catch((error: unknown) => {
      if (destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      detailsContent.content = `Failed to load recipe:\n${message}`;
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
  const lines = [
    `CWD:               ${status.cwd}`,
    `Home:              ${status.home}`,
    `Data Dir:          ${status.dataDir} (source: ${status.dataDirSource})`,
    `Cache Dir:         ${status.cacheDir} (source: ${status.cacheDirSource})`,
    `Default Data Dir:  ${status.defaultDataDir}`,
    `Default Cache Dir: ${status.defaultCacheDir}`,
    "\n",
    `Sow:               Targets:  ${Object.keys(status.sow.targets).length}, ${status.sow.status} (${formatDates(status.sow)})`,
    `Grow:              Targets:  ${Object.keys(status.grow.targets).length}, ${status.grow.status} (${formatDates(status.grow)})`,
    `Plant:             Targets:  ${Object.keys(status.plant.targets).length}, ${status.plant.status} (${formatDates(status.plant)})`,
  ];

  return lines.join("\n");
}

function formatDates(statusProcess: SporeStatusProcess) {
  // if started_at and updated_at are valid dates, format them to a more readable format
  const startedAt = new Date(statusProcess.started_at);
  const updatedAt = new Date(statusProcess.updated_at);
  const duration = formatDuration(updatedAt.getTime() - startedAt.getTime());
  // if the day is the same, only show the time for updated_at and duration
  if (startedAt.toDateString() === updatedAt.toDateString()) {
    return `Updated at: ${updatedAt.toLocaleTimeString()} (Duration: ${duration})`;
  } else {
    return `Started at: ${startedAt.toLocaleString()}, Updated at: ${updatedAt.toLocaleString()} (Duration: ${duration})`;
  }
}

// function formatDetails(preview: RecipePreview): string {
//   const lines = [
//     `Name:     ${preview.recipe.name}`,
//     `Target:   ${preview.recipe.target}`,
//     `ID:       ${preview.id}`,
//     `Path:     ${preview.path}`,
//     `Palette:  ${preview.palette.slug}`,
//     `Preview:  current profile context (${preview.profile})`,
//     `Results:  ${preview.resultContext}`,
//   ];
//
//   if (preview.warnings.length > 0) {
//     lines.push("", "Color availability:");
//     lines.push(...preview.warnings.map((warning) => `  ! ${warning}`));
//   }
//
//   return lines.join("\n");
// }
//
// function createTableContent(
//   preview: RecipePreview,
//   colors: Record<string, string>,
// ): TextChunk[][][] {
//   const header = ["TOKEN", "KIND", "BASE", "SOURCE", "MIX", "RESULT RULE", "COLOR"].map((label) => [
//     fg(themeColor(colors, "green", "#80d9ab"))(label),
//   ]);
//
//   return [header, ...preview.tokens.map((token) => createRow(token, colors))];
// }
//
// function createRow(token: RecipeTokenPreview, colors: Record<string, string>): TextChunk[][] {
//   return [
//     [fg(themeColor(colors, "foreground", "#d9ebe3"))(token.name)],
//     [fg(themeColor(colors, "muted", "#8da89e"))(token.kind)],
//     colorCell(token.baseLabel, token.baseHex, colors),
//     colorCell(token.sourceLabel, token.sourceHex, colors),
//     [
//       fg(themeColor(colors, "foreground", "#d9ebe3"))(
//         token.mix > 0 ? `${Math.round(token.mix * 100)}%` : "—",
//       ),
//     ],
//     [fg(themeColor(colors, "muted", "#8da89e"))(resultRule(token))],
//     token.resultHex
//       ? colorCell("", token.resultHex, colors)
//       : [
//         fg(themeColor(colors, "muted", "#8da89e"))(
//           token.unavailableReason ?? "Color unavailable in the current profile context.",
//         ),
//       ],
//   ];
// }
//
// function colorCell(
//   label: string,
//   hex: string | undefined,
//   colors: Record<string, string>,
// ): TextChunk[] {
//   const chunks: TextChunk[] = [];
//
//   if (!hex) {
//     chunks.push(dim("—"));
//     if (label) {
//       chunks.push(fg(themeColor(colors, "foreground", "#d9ebe3"))(`\n${label}`));
//     }
//     return chunks;
//   }
//
//   chunks.push(bg(hex)("  "));
//   chunks.push(fg(themeColor(colors, "muted", "#8da89e"))(` ${hex}`));
//   if (label) {
//     chunks.push(fg(themeColor(colors, "foreground", "#d9ebe3"))(`\n${label}`));
//   }
//   return chunks;
// }
//
// function themeColor(colors: Record<string, string>, name: string, fallback: string): string {
//   return colors[name] ?? fallback;
// }
//
// function resultRule(token: RecipeTokenPreview): string {
//   if (token.kind === "Base") return "100% base";
//   if (token.sourceLabel !== "—" && !token.sourceHex) return "missing source → base fallback";
//   const sourcePercent = Math.round(token.mix * 100);
//   const baseName = token.kind === "Bloom" ? "bloom" : "base";
//   const sourceName = token.kind === "Derived" ? "tint" : "source";
//   return `${100 - sourcePercent}% ${baseName} + ${sourcePercent}% ${sourceName}`;
// }
