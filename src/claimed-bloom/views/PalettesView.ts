import { fg, StyledText, type TextChunk } from "@opentui/core";

import type { MenuItem, View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";
import { liveMarker, swatchStrip } from "../componenets/swatches.ts";
import { CatalogService, type Catalog, type CatalogPalette } from "../services/CatalogService.ts";

export function createPalettesView(context: ViewContext): View {
  const view = createMenuView(
    context.renderer,
    context,
    "Palettes:=> the base colours every bloom starts from",
    [],
    ["↑↓ Navigate", "Enter Details", "ESC => back", "q => Quit"],
  );

  view.setMessage?.("Loading palettes...");

  void new CatalogService(context.spore)
    .load()
    .then((catalog) => {
      view.setItems?.(
        catalog.palettes.map((palette): MenuItem => ({
          label: `${liveMarker(isLive(catalog, palette.slug) ? "live" : "none")} ${palette.name}`,
          description: describePalette(catalog, palette, context),
          onSelect: () => context.navigate({ name: "palette", id: palette.slug }),
        })),
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      view.setMessage?.(`Failed to load palettes: ${message}`);
    });

  return view;
}

// Base palette of a run of the current profile.
export function isLive(catalog: Catalog, slug: string): boolean {
  return (catalog.status.profile?.runs ?? []).some((run) => run.basePalette === slug);
}

function describePalette(catalog: Catalog, palette: CatalogPalette, context: ViewContext): StyledText {
  const text = fg(context.colors.foreground);
  const muted = fg(context.colors.muted);
  const accent = fg(context.colors.accent);
  const profiles = catalog.profilesUsingPalette(palette.slug);
  const recipes = catalog.recipesUsingPalette(palette.slug);
  const chunks: TextChunk[] = [
    accent(palette.name),
    muted(`  ${palette.slug} · ${palette.kind}\n`),
    muted(isLive(catalog, palette.slug) ? "● base palette of the current profile\n" : ""),
    text("\n"),
    ...swatchStrip(Object.values(palette.colors), 19, 2),
    text("\n\n"),
  ];
  if (palette.source) chunks.push(text(`${palette.source}\n\n`));
  chunks.push(
    muted("Base of     "), text(`${profiles.length} profile(s)\n`),
    muted("Recipes     "), text(`${recipes.length} pin it as their base\n`),
  );
  return new StyledText(chunks);
}
