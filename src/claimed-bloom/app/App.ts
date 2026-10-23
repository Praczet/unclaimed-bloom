import { BoxRenderable, createCliRenderer, type CliRenderer } from "@opentui/core";
import { SporeClient } from "../services/SporeClient.ts";

import { Router } from "./Router.ts";
import { routeBreadcrumbs, type Route } from "./routes.ts";
import type { AppContext, ChoiceDialogOptions, Dialog, View, ViewContext } from "./types.ts";
import { createHomeView } from "../views/HomeView.ts";
import { DefaultColors, type ThemeColors } from "../themes/colors.ts";
import { ThemeStore } from "../services/ThemeStore.ts";
import { Footer } from "../componenets/Footer.ts";
import { Header } from "../componenets/Header.ts";
import { createShowView } from "../views/ShowView.ts";
import { createRecipesView } from "../views/RecipesView.ts";
import { createChoiceDialog } from "../componenets/ChoiceDialog.ts";
import { createRecipeDetailView } from "../views/RecipeDetailView.ts";
import { createCurrentStatusView } from "../views/CurrentStatusView.ts";
import { createThemeView } from "../views/ThemeView.ts";

export class App {
  private renderer!: CliRenderer;
  private container!: BoxRenderable;
  private overlay!: BoxRenderable;
  private body!: BoxRenderable;
  private router: Router;
  private currentView?: View;
  private currentDialog?: Dialog;
  private context!: AppContext;
  private header!: Header;
  private footer!: Footer;
  private readonly spore = new SporeClient();
  private readonly themes = new ThemeStore();
  // Mutated in place on a theme change, so every holder of context.colors sees it.
  private readonly colors: ThemeColors = { ...DefaultColors };

  constructor() {
    this.router = new Router((route) => {
      this.showRoute(route);
    });
  }

  async start(): Promise<void> {
    Object.assign(this.colors, (await this.themes.current()).colors);

    this.renderer = await createCliRenderer({
      exitOnCtrlC: true,
      backgroundColor: this.colors.background,
    });

    this.container = new BoxRenderable(this.renderer, {
      width: "100%",
      height: "100%",
      flexDirection: "column",
    });

    this.overlay = new BoxRenderable(this.renderer, {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 100,
      alignItems: "center",
      justifyContent: "center",
    });
    this.renderer.root.add(this.overlay);

    this.body = new BoxRenderable(this.renderer, {
      width: "100%",
      flexGrow: 1,
      flexDirection: "column",
      overflow: "hidden",
      paddingLeft: 2,
      paddingRight: 2,
    });

    this.context = {
      renderer: this.renderer,
      colors: this.colors,
      spore: this.spore,
      themes: this.themes,
      route: this.router.current,
    };

    this.header = new Header(this.context);
    this.footer = new Footer(this.context);

    this.renderer.root.add(this.container);
    this.container.add(this.header.root);
    this.container.add(this.body);
    this.container.add(this.footer.root);

    this.renderer.keyInput.on("keypress", (key) => {
      if (this.currentDialog) {
        this.currentDialog.onKey(key.name);
        return;
      }
      if (key.name === "escape") {
        if (this.router.canGoBack) {
          this.router.back();
        } else {
          this.exit();
        }
        return;
      }

      this.currentView?.onKey?.(key.name);
    });

    this.themes.watch(() => void this.applyTheme());
    this.showRoute("home");
  }

  // Reloads the selected theme and restyles everything.
  private async applyTheme(): Promise<void> {
    Object.assign(this.colors, (await this.themes.current()).colors);
    this.renderer.setBackgroundColor(this.colors.background);
    this.rebuild();
  }

  private rebuild(): void {
    this.container.remove(this.header.root);
    this.container.remove(this.footer.root);
    this.header.root.destroyRecursively();
    this.footer.root.destroyRecursively();
    this.header = new Header(this.context);
    this.footer = new Footer(this.context);
    this.container.add(this.header.root, 0);
    this.container.add(this.footer.root);
    this.showRoute(this.router.current);
  }

  private showRoute(route: Route): void {
    this.closeDialog();
    const nextView = this.createView(route);

    this.currentView?.destroy();

    this.currentView = nextView;
    this.header.setTitle(nextView.title);

    const breadcrumbs = this.router.getHistory().flatMap(routeBreadcrumbs);
    this.header.setBreadcrumbs(breadcrumbs);
    this.body.add(nextView.root);
    this.footer.setShortcuts(nextView.shortcuts ?? ["dupa"]);
  }

  private closeDialog(): void {
    const dialog = this.currentDialog;

    if (!dialog) {
      return;
    }

    this.currentDialog = undefined;
    dialog.destroy();
  }

  private exit(): void {
    this.themes.close();
    this.currentView?.destroy();
    this.renderer.destroy();
  }

  private openChoiceDialog<T>(options: ChoiceDialogOptions<T>): void {
    this.closeDialog();

    const dialog = createChoiceDialog(this.renderer, this.colors, options, () =>
      this.closeDialog(),
    );

    this.currentDialog = dialog;
    this.renderer.root.add(dialog.root);
  }

  private createView(route: Route): View {
    const context: ViewContext = {
      ...this.context,
      navigate: (route) => this.router.navigate(route),
      back: () => this.router.back(),
      exit: () => this.exit(),
      openChoiceDialog: <T>(options: ChoiceDialogOptions<T>) => this.openChoiceDialog<T>(options),
      closeDialog: () => this.closeDialog(),
      applyTheme: () => this.applyTheme(),
    };

    if (typeof route !== "string") {
      switch (route.name) {
        case "recipe":
          return createRecipeDetailView(context, route.id);

        case "profile":
          throw new Error(`Unimplemented profile route: ${route.id}`);
      }
    }

    switch (route) {
      case "home":
        return createHomeView(context);

      case "show":
        return createShowView(context);

      case "recipes":
        return createRecipesView(context);
      case "current":
        return createCurrentStatusView(context);
      case "theme":
        return createThemeView(context);

      default:
        throw new Error(`Unimplemented route: ${route}`);
    }
  }
}
