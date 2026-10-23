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
import { ExternalOpener, type OpenWithChoice } from "../services/ExternalOpener.ts";
import type { RecipePreview, RecipeTokenPreview } from "../services/types.ts";

export function createRecipeDetailView(context: ViewContext, recipeId: string): View {
  let destroyed = false;
  let preview: RecipePreview | undefined;
  const opener = new ExternalOpener();

  const root = new BoxRenderable(context.renderer, {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    backgroundColor: context.colors.panel,
    padding: 1,
  });

  const details = new TextRenderable(context.renderer, {
    content: `Loading recipe ${recipeId}...`,
    fg: context.colors.muted,
    marginBottom: 1,
    flexShrink: 0,
  });

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
    .getRecipePreview(recipeId)
    .then((loadedPreview) => {
      if (destroyed) return;
      preview = loadedPreview;
      details.content = formatDetails(loadedPreview);
      table.content = createTableContent(loadedPreview, context.colors);
    })
    .catch((error: unknown) => {
      if (destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      details.content = `Failed to load recipe:\n${message}`;
    });

  return {
    root,
    title: `Recipe — ${recipeId}`,
    shortcuts: ["↑↓ Scroll", "PgUp/PgDn Scroll", "O => Open", "ESC => back", "q => Quit"],
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
      } else if (key === "o" && preview) {
        openWithDialog(context, preview, opener, actionStatus);
      }
    },
    destroy(): void {
      destroyed = true;
      root.destroyRecursively();
    },
  };
}

function openWithDialog(
  context: ViewContext,
  preview: RecipePreview,
  opener: ExternalOpener,
  status: TextRenderable,
): void {
  context.openChoiceDialog<OpenWithChoice>({
    title: "Open with",
    width: "42%",
    height: "40%",
    items: [
      {
        label: "Nvim",
        value: "nvim",
        description: "Edit the recipe in Nvim in a new Kitty window.",
      },
      {
        label: "Superfile",
        value: "superfile",
        description: "Browse the recipe directory in Superfile in a new Kitty window.",
      },
      {
        label: "Kitty",
        value: "kitty",
        description: "Open a new Kitty terminal in the recipe directory.",
      },
    ],
    onSelect: (choice) => {
      status.content = `Opening ${choice}...`;
      void opener
        .open(choice, preview.path)
        .then(() => {
          status.content = `Opened with ${choice}.`;
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          status.content = `Failed to open with ${choice}: ${message}`;
        });
    },
  });
}

function formatDetails(preview: RecipePreview): string {
  const lines = [
    `Name:     ${preview.recipe.name}`,
    `Target:   ${preview.recipe.target}`,
    `ID:       ${preview.id}`,
    `Path:     ${preview.path}`,
    `Palette:  ${preview.palette.slug}`,
    `Preview:  current profile context (${preview.profile})`,
    `Results:  ${preview.resultContext}`,
  ];

  if (preview.warnings.length > 0) {
    lines.push("", "Color availability:");
    lines.push(...preview.warnings.map((warning) => `  ! ${warning}`));
  }

  return lines.join("\n");
}

function createTableContent(
  preview: RecipePreview,
  colors: Record<string, string>,
): TextChunk[][][] {
  const header = ["TOKEN", "KIND", "BASE", "SOURCE", "MIX", "RESULT RULE", "COLOR"].map((label) => [
    fg(themeColor(colors, "green", "#80d9ab"))(label),
  ]);

  return [header, ...preview.tokens.map((token) => createRow(token, colors))];
}

function createRow(token: RecipeTokenPreview, colors: Record<string, string>): TextChunk[][] {
  return [
    [fg(themeColor(colors, "foreground", "#d9ebe3"))(token.name)],
    [fg(themeColor(colors, "muted", "#8da89e"))(token.kind)],
    colorCell(token.baseLabel, token.baseHex, colors),
    colorCell(token.sourceLabel, token.sourceHex, colors),
    [
      fg(themeColor(colors, "foreground", "#d9ebe3"))(
        token.mix > 0 ? `${Math.round(token.mix * 100)}%` : "—",
      ),
    ],
    [fg(themeColor(colors, "muted", "#8da89e"))(resultRule(token))],
    token.resultHex
      ? colorCell("", token.resultHex, colors)
      : [
        fg(themeColor(colors, "muted", "#8da89e"))(
          token.unavailableReason ?? "Color unavailable in the current profile context.",
        ),
      ],
  ];
}

function colorCell(
  label: string,
  hex: string | undefined,
  colors: Record<string, string>,
): TextChunk[] {
  const chunks: TextChunk[] = [];

  if (!hex) {
    chunks.push(dim("—"));
    if (label) {
      chunks.push(fg(themeColor(colors, "foreground", "#d9ebe3"))(`\n${label}`));
    }
    return chunks;
  }

  chunks.push(bg(hex)("  "));
  chunks.push(fg(themeColor(colors, "muted", "#8da89e"))(` ${hex}`));
  if (label) {
    chunks.push(fg(themeColor(colors, "foreground", "#d9ebe3"))(`\n${label}`));
  }
  return chunks;
}

function themeColor(colors: Record<string, string>, name: string, fallback: string): string {
  return colors[name] ?? fallback;
}

function resultRule(token: RecipeTokenPreview): string {
  if (token.kind === "Base") return "100% base";
  if (token.sourceLabel !== "—" && !token.sourceHex) return "missing source → base fallback";
  const sourcePercent = Math.round(token.mix * 100);
  const baseName = token.kind === "Bloom" ? "bloom" : "base";
  const sourceName = token.kind === "Derived" ? "tint" : "source";
  return `${100 - sourcePercent}% ${baseName} + ${sourcePercent}% ${sourceName}`;
}
