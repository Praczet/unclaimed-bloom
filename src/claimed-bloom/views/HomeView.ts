import type { View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";
import { voiced } from "../componenets/voiced.ts";

export function createHomeView(appContext: ViewContext): View {
  return createMenuView(
    appContext.renderer,
    appContext,
    "Welcome to Claimed Bloom! Use the arrow keys to navigate and Enter to select an option.",
    [
      { label: "Show...", route: "show", description: voiced(appContext.colors, "show", "Show Bloomed Stuff in the Terminal") },
      {
        label: "Check...",
        route: "check",
        description:
          voiced(appContext.colors, "check", "Is everything the current theme uses installed and applied?\n\nOutdated recipes, profiles, palettes, moods, templates and hooks in use, everything else that is outdated, and what to run to fix it."),
      },
      {
        label: "Do...",
        route: "do",
        description:
          voiced(appContext.colors, "do", "Fix what Check found.\n\nThe suggested action comes first; spore sync, sync --apply, per-kind syncs and install --force follow."),
      },
      { label: "Complain...", route: "complain", description: voiced(appContext.colors, "complain", "Complain about something") },
      {
        label: "Theme...",
        route: "theme",
        description:
          voiced(appContext.colors, "theme", "How claimed-bloom itself looks.\n\nPick a theme-*.json from the bundled themes or ~/.config/claimed-bloom/themes; it applies right away."),
      },
    ],
  );
}
