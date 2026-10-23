import { fg, StyledText, type TextChunk } from "@opentui/core";

import type { MenuItem, View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";
import { liveMarker, swatchStrip } from "../componenets/swatches.ts";
import { CatalogService, type Catalog, type CatalogProfile } from "../services/CatalogService.ts";

export function createProfilesView(context: ViewContext): View {
  const view = createMenuView(
    context.renderer,
    context,
    "Profiles:=> which palette, mood and recipes each profile uses",
    [],
    ["↑↓ Navigate", "Enter Details", "ESC => back", "q => Quit"],
  );

  view.setMessage?.("Loading profiles...");

  void new CatalogService(context.spore)
    .load()
    .then((catalog) => {
      view.setItems?.(
        catalog.profiles.map((profile): MenuItem => ({
          label: `${liveMarker(profileState(catalog, profile.name))} ${profile.name}`,
          description: describeProfile(catalog, profile, context),
          onSelect: () => context.navigate({ name: "profile", id: profile.name }),
        })),
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      view.setMessage?.(`Failed to load profiles: ${message}`);
    });

  return view;
}

export function profileState(catalog: Catalog, name: string): "live" | "related" | "none" {
  if (name === catalog.currentName) return "live";
  return catalog.liveProfiles.has(name) ? "related" : "none";
}

function describeProfile(catalog: Catalog, profile: CatalogProfile, context: ViewContext): StyledText {
  const text = fg(context.colors.foreground);
  const muted = fg(context.colors.muted);
  const accent = fg(context.colors.accent);
  const state = profileState(catalog, profile.name);
  const chunks: TextChunk[] = [
    accent(profile.name),
    muted(`  (${profile.type})\n`),
    muted(state === "live" ? "● the current profile\n" : state === "related" ? "○ a run of the current profile\n" : ""),
    text("\n"),
  ];

  if (profile.type === "composition") {
    catalog.resolveRuns(profile).forEach((run, index) => {
      const filter = profile.runs[index];
      const plants = filter?.targets
        ? filter.targets.join(", ")
        : filter?.exclude
          ? `all except ${filter.exclude.join(", ")}`
          : "everything else";
      chunks.push(muted(`${index + 1}. `), text(run.profile), muted(` → ${plants} (${run.targets.length})\n`));
    });
    if (profile.sourceProfile) chunks.push(text("\n"), muted("Source profile  "), text(`${profile.sourceProfile}\n`));
    return new StyledText(chunks);
  }

  const palette = catalog.palette(profile.basePalette);
  const source = profile.source.type === "seed" ? `seed ${profile.source.color ?? "?"}` : `${profile.source.type} ${profile.source.variant ?? ""}`;
  chunks.push(
    muted("Palette   "), text(`${palette?.name ?? profile.basePalette}  `),
    ...swatchStrip(Object.values(palette?.colors ?? {}), 12, 1), text("\n"),
    muted("Mood      "), text(`${profile.mood}\n`),
    muted("Source    "), text(`${source.trim()}\n`),
    muted("Targets   "), text(`${Object.keys(profile.targets).length}\n`),
  );
  const compositions = catalog.compositionsContaining(profile.name);
  if (compositions.length > 0) chunks.push(muted("Used in   "), text(`${compositions.join(", ")}\n`));
  return new StyledText(chunks);
}
