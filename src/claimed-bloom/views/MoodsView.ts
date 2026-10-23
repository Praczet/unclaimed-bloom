import { fg, StyledText, type TextChunk } from "@opentui/core";

import type { View, ViewContext } from "../app/types.ts";
import { createDetailLayout } from "../componenets/DetailLayout.ts";
import { shareBar } from "../componenets/swatches.ts";
import { CatalogService } from "../services/CatalogService.ts";

// What each weight steers, from BLOOM_STEPS in spore's BloomGenerator.
const GROUPS = [
  ["surface", "backgrounds, borders, selection background"],
  ["foreground", "text and selection text"],
  ["accent", "primary, secondary and tertiary accents"],
  ["semantic", "danger, warning, success and info"],
] as const;

export function createMoodsView(context: ViewContext): View {
  let destroyed = false;
  const layout = createDetailLayout(context);
  const text = fg(context.colors.foreground);
  const muted = fg(context.colors.muted);
  const accent = fg(context.colors.accent);

  void new CatalogService(context.spore)
    .load()
    .then((catalog) => {
      if (destroyed) return;
      const liveMoods = new Set((catalog.status.profile?.runs ?? []).map((run) => run.mood));

      layout.setTitle("Moods: how much of the wallpaper gets in");
      const chunks: TextChunk[] = [
        text("A mood mixes the wallpaper (matugen) colours into the base palette, per group:\n\n"),
      ];
      for (const [group, steers] of GROUPS) {
        chunks.push(accent(group.padEnd(11)), muted(`${steers}\n`));
      }
      chunks.push(text("\n"));
      for (const mood of catalog.moods) {
        chunks.push(text(`${liveMoods.has(mood.name) ? "●" : " "} ${mood.name.padEnd(10)}`), muted(`${mood.description}\n`));
      }
      layout.setInfo(new StyledText(chunks));

      layout.table.setRows(
        ["MOOD", ...GROUPS.map(([group]) => group.toUpperCase()), "USED BY"],
        catalog.moods.map((mood) => {
          const users = catalog.profilesUsingMood(mood.name);
          return {
            cells: [
              [text(`${mood.name}${liveMoods.has(mood.name) ? " ●" : ""}`)],
              ...GROUPS.map(([group]) => shareBar(mood.weights[group] ?? 0, context.colors.accent, context.colors.muted, 8)),
              [muted(users.length > 3 ? `${users.length} profiles` : users.join(", ") || "—")],
            ],
          };
        }),
      );
      layout.setFooter("0% = pure palette colour, 100% = pure wallpaper colour  ·  ● mood of the current profile");
    })
    .catch((error: unknown) => {
      if (destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      layout.setInfo(`Failed to load moods:\n${message}`);
    });

  return {
    root: layout.root,
    title: "Moods:=> wallpaper influence per colour group",
    shortcuts: ["↑↓ Scroll", "ESC => back", "q => Quit"],
    onKey(key: string): void {
      if (key === "q") {
        context.exit();
        return;
      }
      layout.table.onKey(key);
    },
    destroy(): void {
      destroyed = true;
      layout.root.destroyRecursively();
    },
  };
}
