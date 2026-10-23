import type { View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";

export function createHomeView(appContext: ViewContext): View {
  return createMenuView(
    appContext.renderer,
    appContext,
    "Welcome to Claimed Bloom! Use the arrow keys to navigate and Enter to select an option.",
    [
      { label: "Show...", route: "show", description: "Show Bloomed Stuff in the Terminal" },
      {
        label: "Check...",
        route: "check",
        description:
          "Is everything the current theme uses installed and applied?\n\nOutdated recipes, profiles, palettes, moods, templates and hooks in use, everything else that is outdated, and what to run to fix it.",
      },
      {
        label: "Do...",
        route: "do",
        description:
          "Fix what Check found.\n\nThe suggested action comes first; spore sync, sync --apply, per-kind syncs and install --force follow.",
      },
      { label: "Complain...", route: "complain", description: "Complain about something" },
      {
        label: "Theme...",
        route: "theme",
        description:
          "How claimed-bloom itself looks.\n\nPick a theme-*.json from the bundled themes or ~/.config/claimed-bloom/themes; it applies right away.",
      },
    ],
  );
}
