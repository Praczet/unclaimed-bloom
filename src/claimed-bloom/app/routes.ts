export const routes = {
  home: "Home",
  show: "Show...",
  check: "Check...",
  do: "Do...",
  complain: "Complain...",
  current: "Current",
  recipes: "Recipes",
  profiles: "Profiles",
  palettes: "Palettes",
  moods: "Moods",
  targets: "Targets",
  changes: "Changes",
  theme: "Theme",
} as const;

export type StaticRoute = keyof typeof routes;

export type Route = StaticRoute | { name: "recipe"; id: string } | { name: "profile"; id: string };

export function routeBreadcrumbs(route: Route): string[] {
  if (typeof route === "string") {
    return [routes[route]];
  }

  switch (route.name) {
    case "recipe": {
      const [target, recipe] = route.id.split("/", 2);
      return [target ?? route.id, recipe ?? ""];
    }
    case "profile": {
      const [target, profile] = route.id.split("/", 2);
      return [target ?? route.id, profile ?? ""];
    }
  }
}
