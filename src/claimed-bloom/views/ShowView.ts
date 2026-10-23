import type { View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";

export function createShowView(appContext: ViewContext): View {
  return createMenuView(
    appContext.renderer,
    appContext,
    "Showing Bloomed Stuff in the Terminal => oooo la la la",
    [
      {
        label: "Current",
        route: "current",
        description:
          "What is now applied...\n\nIn other words, what the hell is going on.\n\nStart here.",
      },
      {
        label: "Recipes",
        route: "recipes",
        description: "Recipie is a declaration how colors are build",
      },
      {
        label: "Profiles",
        route: "profiles",
        description:
          "Profile says which color palette with what color in what mood will be used for specified targets",
      },
      { label: "Palettes", route: "palettes", description: "Palette is a collection of colors" },
      {
        label: "Moods",
        route: "moods",
        description: "Mood says hom much one color influence other. I know it's complicated.",
      },
      {
        label: "Targets",
        route: "targets",
        description:
          "Target is an application. It knows what template application used, what recipies are avaiable and it has hooks. Cool, right?",
      },
      {
        label: "Changes",
        route: "changes",
        description:
          "Changes are a collection of changes. That one you will like to use when somthing is not working -;). I will show what is in Development (source) and not in configs. That one is for me, for myslef.",
      },
    ],
    ["↑↓ Navigate", "Enter Select", "ESC => back", "q => Quit"],
  );
}
