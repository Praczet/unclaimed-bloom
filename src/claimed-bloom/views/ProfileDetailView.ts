import { fg, StyledText, type TextChunk } from "@opentui/core";

import type { View, ViewContext } from "../app/types.ts";
import { createDetailLayout } from "../componenets/DetailLayout.ts";
import { shareBar, swatchStrip } from "../componenets/swatches.ts";
import {
  CatalogService,
  type Catalog,
  type CatalogCompositionProfile,
  type CatalogPlainProfile,
} from "../services/CatalogService.ts";
import { profileState } from "./ProfilesView.ts";

export function createProfileDetailView(context: ViewContext, name: string): View {
  let destroyed = false;
  let plain: CatalogPlainProfile | undefined;
  const layout = createDetailLayout(context);
  const text = fg(context.colors.foreground);
  const muted = fg(context.colors.muted);
  const accent = fg(context.colors.accent);

  void new CatalogService(context.spore)
    .load()
    .then(async (catalog) => {
      if (destroyed) return;
      const profile = catalog.profile(name);
      const state = profileState(catalog, name);
      layout.setTitle(`Profile: ${name}${state === "live" ? " ●" : state === "related" ? " ○" : ""}`);

      if (!profile) {
        layout.setInfo(`No profile "${name}" in ${catalog.status.paths.dataDir}/profiles.`);
      } else if (profile.type === "composition") {
        showComposition(catalog, profile);
      } else {
        plain = profile;
        await showPlain(catalog, profile);
      }
    })
    .catch((error: unknown) => {
      if (destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      layout.setInfo(`Failed to load profile:\n${message}`);
    });

  function showComposition(catalog: Catalog, profile: CatalogCompositionProfile): void {
    const resolved = catalog.resolveRuns(profile);
    const winner = new Map<string, string>();
    for (const run of resolved) for (const target of run.targets) winner.set(target, run.profile);
    const overridden = resolved.flatMap((run) =>
      run.targets.filter((target) => winner.get(target) !== run.profile).map((target) => `${target} (${run.profile} → ${winner.get(target)})`)
    );

    const chunks: TextChunk[] = [
      muted("Type            "), text("composition — each run plants its targets from its own profile\n"),
      muted("Source profile  "), text(`${profile.sourceProfile ?? resolved[0]?.profile ?? "—"}`), muted("  (used for previews and the workbench)\n"),
      muted("Targets         "), text(`${winner.size} in total\n`),
    ];
    if (overridden.length > 0) {
      chunks.push(muted("Overridden      "), text(`${overridden.join(", ")}\n`));
    }
    layout.setInfo(new StyledText(chunks));

    layout.table.setRows(
      ["RUN", "PROFILE", "PLANTS", "PALETTE", "MOOD"],
      resolved.map((run, index) => {
        const runProfile = catalog.profile(run.profile);
        const filter = profile.runs[index];
        const plants = filter?.targets
          ? filter.targets.join(", ")
          : `${filter?.exclude ? `all except ${filter.exclude.join(", ")}` : "all its targets"} (${run.targets.length})`;
        return {
          cells: [
            [muted(String(index + 1))],
            [text(run.profile)],
            [muted(plants)],
            [muted(runProfile?.type === "profile" ? runProfile.basePalette : "—")],
            [muted(runProfile?.type === "profile" ? runProfile.mood : "—")],
          ],
          onSelect: () => context.navigate({ name: "profile", id: run.profile }),
        };
      }),
    );
    layout.setFooter("Enter => open the run's profile");
  }

  async function showPlain(catalog: Catalog, profile: CatalogPlainProfile): Promise<void> {
    const palette = catalog.palette(profile.basePalette);
    const mood = catalog.mood(profile.mood);
    const source = profile.source.type === "seed"
      ? `seed ${profile.source.color ?? "?"}`
      : `${profile.source.type} (${profile.source.variant ?? "default"}) — colours from the current wallpaper`;

    const chunks: TextChunk[] = [
      muted("Palette   "), accent(palette?.name ?? profile.basePalette), text("  "),
      ...swatchStrip(Object.values(palette?.colors ?? {}), 19, 1), text("\n"),
      muted("Mood      "), accent(profile.mood), muted(`  ${mood?.description ?? ""}\n`),
    ];
    if (mood) {
      chunks.push(muted("          "));
      for (const [group, share] of Object.entries(mood.weights)) {
        chunks.push(muted(`${group} `), ...shareBar(share, context.colors.accent, context.colors.muted, 6), text(" "));
      }
      chunks.push(text("\n"));
    }
    chunks.push(muted("Source    "), text(`${source}\n`));
    const compositions = catalog.compositionsContaining(profile.name);
    if (compositions.length > 0) chunks.push(muted("Used in   "), text(`${compositions.join(", ")}\n`));
    layout.setInfo(new StyledText(chunks));

    const rows = [];
    for (const [target, recipe] of Object.entries(profile.targets).sort(([a], [b]) => a.localeCompare(b))) {
      const spore = await catalog.cachedSpore(profile.name, target);
      const stale = spore && spore.recipe !== recipe;
      rows.push({
        cells: [
          [text(target)],
          [text(recipe), ...(stale ? [muted(` (sown with ${spore.recipe})`)] : [])],
          [muted(spore ? formatShort(spore.generatedAt) : "not sown")],
          spore ? swatchStrip(Object.values(spore.colors), 8) : [muted("—")],
        ],
        onSelect: () => context.navigate({ name: "recipe", id: `${target}/${recipe}` }),
      });
    }
    layout.table.setRows(["TARGET", "RECIPE", "SOWN", "COLOURS"], rows);
    layout.setFooter("Enter => open recipe  ·  p => palette  ·  m => moods");
  }

  return {
    root: layout.root,
    title: "Profile:=> what it is made of",
    shortcuts: ["↑↓ Select", "Enter Open", "p => Palette", "m => Moods", "ESC => back", "q => Quit"],
    onKey(key: string): void {
      if (key === "q") {
        context.exit();
      } else if (key === "p" && plain) {
        context.navigate({ name: "palette", id: plain.basePalette });
      } else if (key === "m" && plain) {
        context.navigate("moods");
      } else {
        layout.table.onKey(key);
      }
    },
    destroy(): void {
      destroyed = true;
      layout.root.destroyRecursively();
    },
  };
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
