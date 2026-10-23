import { fg, StyledText, type TextChunk } from "@opentui/core";

import type { MenuItem, View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";
import { liveMarker, swatchStrip } from "../componenets/swatches.ts";
import { CatalogService, type Catalog, type CatalogTarget } from "../services/CatalogService.ts";

export function createTargetsView(context: ViewContext): View {
  const view = createMenuView(
    context.renderer,
    context,
    "Targets:=> every app spore themes, and where its colours land",
    [],
    ["↑↓ Navigate", "Enter Details", "ESC => back", "q => Quit"],
  );

  view.setMessage?.("Loading targets...");

  void new CatalogService(context.spore)
    .load()
    .then(async (catalog) => {
      const live = catalog.liveTargets;
      const items: MenuItem[] = [];
      for (const target of catalog.targets) {
        const profile = live.get(target.name);
        const spore = profile ? await catalog.cachedSpore(profile, target.name) : undefined;
        items.push({
          label: `${liveMarker(profile ? "live" : "none")} ${target.name}`,
          description: describeTarget(catalog, target, context, spore ? Object.values(spore.colors) : []),
          onSelect: () => context.navigate({ name: "target", id: target.name }),
        });
      }
      view.setItems?.(items);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      view.setMessage?.(`Failed to load targets: ${message}`);
    });

  return view;
}

function describeTarget(
  catalog: Catalog,
  target: CatalogTarget,
  context: ViewContext,
  colors: string[],
): StyledText {
  const text = fg(context.colors.foreground);
  const muted = fg(context.colors.muted);
  const accent = fg(context.colors.accent);
  const profile = catalog.liveTargets.get(target.name);
  const recipe = profile ? catalog.profilesUsingTarget(target.name).find((use) => use.profile === profile)?.recipe : undefined;
  const users = catalog.profilesUsingTarget(target.name);
  const chunks: TextChunk[] = [accent(target.name), text("\n\n")];

  if (profile) {
    chunks.push(text("Planted now by "), accent(profile), text(" with "), accent(recipe ?? "?"), text("\n"));
    if (colors.length > 0) chunks.push(...swatchStrip(colors, 12), text("\n"));
  } else {
    chunks.push(muted("Not in the current profile.\n"));
  }

  const lands = target.hookSteps.flatMap((step) => step.dest);
  const runs = target.hookSteps.filter((step) => step.command).map((step) => [step.command, ...step.args].join(" "));
  chunks.push(
    text("\n"),
    muted("Recipes    "), text(`${target.recipes.map((r) => r.name).join(", ") || "—"}\n`),
    muted("Templates  "), text(`${target.templates.join(", ") || "—"}\n`),
    muted("Lands in   "), text(`${lands.join(", ") || "— (no copy step)"}\n`),
    ...(runs.length > 0 ? [muted("Runs       "), text(`${runs.join("\n           ")}\n`)] : []),
    muted("Used by    "), text(`${users.length} profile(s)\n`),
  );

  return new StyledText(chunks);
}
