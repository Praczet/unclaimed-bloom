import { fg, StyledText } from "@opentui/core";

import type { StaticRoute } from "../app/routes.ts";
import type { ThemeColors } from "../themes/colors.ts";
import { menuAside } from "../themes/voice.ts";

// A menu explanation with a dimmed voice aside under it, picked per visit.
export function voiced(colors: ThemeColors, route: StaticRoute, description: string): StyledText {
  const aside = menuAside(route);
  return new StyledText([
    fg(colors.foreground)(description),
    ...(aside ? [fg(colors.muted)(`\n\n  ~ ${aside} ~`)] : []),
  ]);
}
