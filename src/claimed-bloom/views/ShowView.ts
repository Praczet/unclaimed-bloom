import type { View, ViewContext } from "../app/types.ts";
import { createMenuView } from "../componenets/menu.ts";
import { voiced } from "../componenets/voiced.ts";

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
          voiced(appContext.colors, "current", "What is now applied...\n\nIn other words, what the hell is going on.\n\nStart here."),
      },
      {
        label: "Recipes",
        route: "recipes",
        description: voiced(appContext.colors, "recipes", "Recipie is a declaration how colors are build"),
      },
      {
        label: "Profiles",
        route: "profiles",
        description:
          voiced(appContext.colors, "profiles", "Profile says which color palette with what color in what mood will be used for specified targets"),
      },
      { label: "Palettes", route: "palettes", description: voiced(appContext.colors, "palettes", "Palette is a collection of colors") },
      {
        label: "Moods",
        route: "moods",
        description: voiced(appContext.colors, "moods", "Mood says hom much one color influence other. I know it's complicated."),
      },
      {
        label: "Targets",
        route: "targets",
        description:
          voiced(appContext.colors, "targets", "Target is an application. It knows what template application used, what recipies are avaiable and it has hooks. Cool, right?"),
      },
      {
        label: "Changes",
        route: "changes",
        description:
          voiced(appContext.colors, "changes", "Changes are a collection of changes. That one you will like to use when somthing is not working -;). I will show what is in Development (source) and not in configs. That one is for me, for myslef."),
      },
    ],
    ["↑↓ Navigate", "Enter Select", "ESC => back", "q => Quit"],
  );
}
