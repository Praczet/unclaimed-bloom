import { bg, fg, StyledText, type TextChunk } from "@opentui/core";

import type { MenuItem, View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";
import type { Theme } from "../services/ThemeStore.ts";
import { THEME_COLOR_KEYS } from "../themes/colors.ts";

export function createThemeView(context: ViewContext): View {
  const view = createMenuView(
    context.renderer,
    context,
    "Theme:=> how claimed-bloom itself looks",
    [],
    ["↑↓ Navigate", "Enter Use theme", "ESC => back", "q => Quit"],
  );

  view.setMessage?.("Loading themes...");

  void Promise.all([context.themes.list(), context.themes.selectedId()])
    .then(([themes, selectedId]) => {
      view.setItems?.(
        themes.map((theme): MenuItem => ({
          label: `${theme.id === selectedId ? "●" : " "} ${theme.name}`,
          description: describe(theme, context),
          onSelect: () => {
            void context.themes.select(theme.id).then(() => context.applyTheme());
          },
        })),
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      view.setMessage?.(`Failed to load themes: ${message}`);
    });

  return view;
}

function describe(theme: Theme, context: ViewContext): StyledText {
  const text = fg(context.colors.foreground);
  const muted = fg(context.colors.muted);
  const chunks: TextChunk[] = [
    text(theme.name),
    muted(`  (${theme.source})\n`),
  ];

  if (theme.description) chunks.push(text(`\n${theme.description}\n`));
  chunks.push(text("\n"));

  for (const key of THEME_COLOR_KEYS) {
    const hex = theme.colors[key];
    chunks.push(bg(hex)("    "), muted(` ${key.padEnd(12)} ${hex}\n`));
  }

  // A small sample drawn with the theme's own colours.
  const sample = theme.colors;
  chunks.push(
    text("\n"),
    bg(sample.panel)(fg(sample.accent)("  ❯ Accent ")),
    bg(sample.panel)(fg(sample.foreground)("text ")),
    bg(sample.panel)(fg(sample.muted)("muted  ")),
    text("\n"),
  );

  if (theme.fallbackKeys.length > 0) {
    chunks.push(muted(`\n! Missing or invalid, using default: ${theme.fallbackKeys.join(", ")}\n`));
  }
  chunks.push(muted(`\n${theme.path}\n`));
  chunks.push(muted(`\nAdd your own as ${context.themes.userDir}/theme-<name>.json`));

  return new StyledText(chunks);
}
