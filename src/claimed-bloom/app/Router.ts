import type { Route } from "./routes.ts";

export class Router {
  private history: Route[] = ["home"];

  constructor(private readonly onChange: (route: Route) => void) { }

  get current(): Route {
    return this.history[this.history.length - 1] ?? "home";
  }

  navigate(route: Route): void {
    if (routeKey(route) === routeKey(this.current)) {
      return;
    }

    this.history.push(route);
    this.onChange(route);
  }

  back(): void {
    if (this.history.length <= 1) return;

    this.history.pop();
    this.onChange(this.current);
  }

  home(): void {
    this.history = ["home"];
    this.onChange("home");
  }

  get canGoBack(): boolean {
    return this.history.length > 1;
  }
  getHistory(): Route[] {
    return [...this.history];
  }
}
export function routeKey(route: Route): string {
  if (typeof route === "string") {
    return route;
  }

  switch (route.name) {
    case "recipe":
      return `recipe:${route.id}`;
    case "profile":
      return `profile:${route.id}`;
    case "run":
      return `run:${route.id}`;
    case "target":
      return `target:${route.id}`;
    case "palette":
      return `palette:${route.id}`;
  }
}
