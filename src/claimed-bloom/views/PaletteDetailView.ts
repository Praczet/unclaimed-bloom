import { bg, fg, StyledText, type TextChunk } from "@opentui/core";

import type { View, ViewContext } from "../app/types.ts";
import { createDetailLayout } from "../componenets/DetailLayout.ts";
import { CatalogService } from "../services/CatalogService.ts";
import { isLive } from "./PalettesView.ts";

export function createPaletteDetailView(context: ViewContext, slug: string): View {
  let destroyed = false;
  const layout = createDetailLayout(context);
  const text = fg(context.colors.foreground);
  const muted = fg(context.colors.muted);

  void new CatalogService(context.spore)
    .load()
    .then((catalog) => {
      if (destroyed) return;
      const palette = catalog.palette(slug);
      if (!palette) {
        layout.setTitle(`Palette: ${slug}`);
        layout.setInfo(`No palette "${slug}" in ${catalog.status.paths.dataDir}/palettes.`);
        return;
      }

      const profiles = catalog.profilesUsingPalette(slug);
      const recipes = catalog.recipesUsingPalette(slug);
      const list = (names: string[]) => names.length === 0 ? "—" : names.length > 6 ? `${names.slice(0, 6).join(", ")} and ${names.length - 6} more` : names.join(", ");

      layout.setTitle(`Palette: ${palette.name}${isLive(catalog, slug) ? " ●" : ""}`);
      const chunks: TextChunk[] = [
        muted("Slug        "), text(`${palette.slug} · ${palette.kind} · ${Object.keys(palette.colors).length} colours\n`),
      ];
      if (palette.source) chunks.push(muted("About       "), text(`${palette.source}\n`));
      chunks.push(
        muted("Base of     "), text(`${list(profiles)}\n`),
        muted("Pinned by   "), text(`${pinnedBy(recipes)}\n`),
      );
      layout.setInfo(new StyledText(chunks));

      layout.table.setRows(
        ["COLOUR", "NAME", "HEX"],
        Object.entries(palette.colors).map(([name, hex]) => ({
          cells: [[bg(hex)("        ")], [text(name)], [muted(hex)]],
        })),
      );
      layout.setFooter(`${palette.path}`);
    })
    .catch((error: unknown) => {
      if (destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      layout.setInfo(`Failed to load palette:\n${message}`);
    });

  return {
    root: layout.root,
    title: "Palette:=> every base colour",
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

// "graphite-tweak-ish in 34 targets, nord-tweak-dark in gtk, gimp" from target/recipe ids.
function pinnedBy(recipeIds: string[]): string {
  if (recipeIds.length === 0) return "—";
  const byRecipe = new Map<string, string[]>();
  for (const id of recipeIds) {
    const [target, recipe] = id.split("/", 2) as [string, string];
    byRecipe.set(recipe, [...(byRecipe.get(recipe) ?? []), target]);
  }
  return [...byRecipe.entries()]
    .map(([recipe, targets]) => `${recipe} in ${targets.length > 3 ? `${targets.length} targets` : targets.join(", ")}`)
    .join(", ");
}
