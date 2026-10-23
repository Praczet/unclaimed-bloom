import type { View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";

export function createHomeView(appContext: ViewContext): View {
  return createMenuView(
    appContext.renderer,
    appContext,
    "Welcome to Claimed Bloom! Use the arrow keys to navigate and Enter to select an option.",
    [
      { label: "Show...", route: "show", description: "Show Bloomed Stuff in the Terminal" },
      { label: "Check...", route: "check", description: "Check if your configs are valid" },
      { label: "Do...", route: "do", description: "Do something with your configs" },
      { label: "Complain...", route: "complain", description: "Complain about something" },
    ],
  );
}
