import { fg, StyledText, type TextChunk } from "@opentui/core";

import type { View, ViewContext } from "../app/types.ts";
import { createDetailLayout } from "../componenets/DetailLayout.ts";
import { swatchStrip } from "../componenets/swatches.ts";
import { CatalogService, type Catalog, type CatalogTarget } from "../services/CatalogService.ts";
import { formatDuration } from "../app/utils.ts";

export function createTargetDetailView(context: ViewContext, name: string): View {
  let destroyed = false;
  const layout = createDetailLayout(context);
  const text = fg(context.colors.foreground);
  const muted = fg(context.colors.muted);

  void new CatalogService(context.spore)
    .load()
    .then(async (catalog) => {
      if (destroyed) return;
      const target = catalog.target(name);
      if (!target) {
        layout.setTitle(`Target: ${name}`);
        layout.setInfo(`No target "${name}" in ${catalog.status.paths.dataDir}/targets.`);
        return;
      }

      layout.setTitle(`Target: ${name}`);
      layout.setInfo(await renderInfo(catalog, target, context));
      layout.table.setRows(
        ["RECIPE", "BASE PALETTE", "TOKENS", "USED BY"],
        target.recipes.map((recipe) => {
          const users = catalog.profilesUsingTarget(name).filter((use) => use.recipe === recipe.name);
          const live = users.some((use) => catalog.liveTargets.get(name) === use.profile);
          return {
            cells: [
              [text(`${recipe.name}${live ? "  ●" : ""}`)],
              [muted(recipe.basePalette ?? "(profile's)")],
              [muted(String(recipe.tokenCount))],
              [muted(users.length === 0 ? "—" : users.length > 3 ? `${users.length} profiles` : users.map((use) => use.profile).join(", "))],
            ],
            onSelect: () => context.navigate({ name: "recipe", id: `${name}/${recipe.name}` }),
          };
        }),
      );
      layout.setFooter("Enter => open recipe  ·  ● the recipe planted now");
    })
    .catch((error: unknown) => {
      if (destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      layout.setInfo(`Failed to load target:\n${message}`);
    });

  async function renderInfo(catalog: Catalog, target: CatalogTarget, ctx: ViewContext): Promise<StyledText> {
    const accent = fg(ctx.colors.accent);
    const profile = catalog.liveTargets.get(target.name);
    const recipe = profile
      ? catalog.profilesUsingTarget(target.name).find((use) => use.profile === profile)?.recipe
      : undefined;
    const spore = profile ? await catalog.cachedSpore(profile, target.name) : undefined;
    const chunks: TextChunk[] = [];

    chunks.push(muted("Planted now  "));
    if (profile) {
      chunks.push(accent(profile), text(" · "), accent(recipe ?? "?"), text("  "));
      if (spore) chunks.push(...swatchStrip(Object.values(spore.colors), 16));
    } else {
      chunks.push(muted("not in the current profile"));
    }
    chunks.push(text("\n"));

    const stages = (["sow", "grow", "plant"] as const).map((stage) => {
      const state = catalog.status.stages[stage]?.targets[target.name];
      if (!state) return `${stage} —`;
      const took = state.duration_ms !== undefined && state.duration_ms >= 1000 ? ` ${formatDuration(state.duration_ms)}` : "";
      return `${stage} ${state.status}${took}`;
    });
    chunks.push(muted("Last run     "), text(`${stages.join("  ·  ")}\n`));
    chunks.push(muted("Templates    "), text(`${target.templates.join(", ") || "—"}\n`));

    for (const step of target.hookSteps) {
      if (step.type === "copy") {
        chunks.push(muted("Lands in     "), text(`${step.dest.join(", ")}\n`));
      } else if (step.command) {
        chunks.push(muted("Then runs    "), text(`${[step.command, ...step.args].join(" ")}\n`));
      }
    }
    if (target.hookSteps.length === 0) chunks.push(muted("Plant hook   "), text("none\n"));

    return new StyledText(chunks);
  }

  return {
    root: layout.root,
    title: "Target:=> recipes, templates and where it lands",
    shortcuts: ["↑↓ Select", "Enter Open recipe", "ESC => back", "q => Quit"],
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
