import { type CliRenderer, BoxRenderable, TextRenderable } from "@opentui/core";
import type { AppContext } from "../app/types";
import type { ThemeColors } from "../themes/colors";

export class Footer {
  private renderer: CliRenderer;
  private container: BoxRenderable;
  private shortcutsRenderable: TextRenderable;
  private colors: ThemeColors;

  constructor(appContext: AppContext) {
    this.renderer = appContext.renderer;
    this.colors = appContext.colors;

    this.container = new BoxRenderable(this.renderer, {
      width: "100%",
      height: 1,
      flexDirection: "row",
      gap: 1,
      paddingRight: 2,
      paddingLeft: 2,
      backgroundColor: this.colors.panel,
    });

    this.shortcutsRenderable = new TextRenderable(this.renderer, {
      content: "",
      fg: this.colors.foreground,
    });

    this.container.add(this.shortcutsRenderable);
  }

  setShortcuts(shortcuts: string[]): void {
    this.shortcutsRenderable.content = shortcuts.join(" | ");
  }

  get root(): BoxRenderable {
    return this.container;
  }
}
