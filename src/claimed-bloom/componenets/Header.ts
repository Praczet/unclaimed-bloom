import { type CliRenderer, BoxRenderable, TextRenderable } from "@opentui/core";
import type { AppContext } from "../app/types";
import type { ThemeColors } from "../themes/colors";
import type { Route } from "../app/routes";

export class Header {
  private renderer: CliRenderer;
  private container: BoxRenderable;
  private breadcrumbs: TextRenderable;
  private titleRenderable: TextRenderable;
  private colors: ThemeColors;

  constructor(appContext: AppContext) {
    this.renderer = appContext.renderer;
    this.colors = appContext.colors;

    this.container = new BoxRenderable(this.renderer, {
      width: "100%",
      height: 6,
      marginLeft: 3,
      flexDirection: "column",
    });

    const header = new TextRenderable(this.renderer, {
      content: "  CLAIMED BLOOM",
      fg: this.colors.accent,
    });

    const description = new TextRenderable(this.renderer, {
      content: "~The garden is yours to understand~",
      fg: this.colors.muted,
      width: "100%",
      marginLeft: 3,
    });

    this.titleRenderable = new TextRenderable(this.renderer, {
      content: "",
      fg: this.colors.foreground,
      marginTop: 1,
    });

    this.breadcrumbs = new TextRenderable(this.renderer, {
      content: "",
      fg: this.colors.muted,
      marginTop: 1,
    });

    this.container.add(header);
    this.container.add(description);
    this.container.add(this.breadcrumbs);
    this.container.add(this.titleRenderable);
  }

  get root(): BoxRenderable {
    return this.container;
  }

  setTitle(title: string): void {
    this.titleRenderable.content = title;
  }

  setBreadcrumbs(breadcrumbs: string[]): void {
    if (breadcrumbs.length === 0) {
      this.breadcrumbs.content = "";
      return;
    }
    breadcrumbs = breadcrumbs.map((crumb) => crumb.trim()).filter((crumb) => crumb.length > 0);
    breadcrumbs[breadcrumbs.length - 1] = `[${breadcrumbs[breadcrumbs.length - 1]!.toUpperCase()}]`;
    const breadcrumbText = breadcrumbs.join(" > ");
    this.breadcrumbs.content = breadcrumbText;
  }
}
