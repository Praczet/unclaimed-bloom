import type { BoxRenderable, CliRenderer, StyledText } from "@opentui/core";
import type { Route } from "./routes.ts";
import type { SporeClient } from "../services/SporeClient.ts";
import type { ThemeStore } from "../services/ThemeStore.ts";
import type { ThemeColors } from "../themes/colors.ts";

export type MenuItemBase = {
  label: string;
  description: string | StyledText;
};

export interface Dialog {
  root: BoxRenderable;
  onKey(key: string): void;
  destroy(): void;
}
export type MenuItem =
  | (MenuItemBase & {
    route: Route;
    onSelect?: never;
  })
  | (MenuItemBase & {
    route?: never;
    onSelect(): void;
  });

export interface View {
  root: BoxRenderable;

  title: string;
  subtitle?: string;
  shortcuts?: string[];

  setItems?(items: MenuItem[]): void;
  setMessage?(message: string): void;

  onKey?(key: string): void;
  destroy(): void;
}

export interface AppContext {
  colors: ThemeColors;
  renderer: CliRenderer;
  spore: SporeClient;
  themes: ThemeStore;
  route: Route;
}

export interface ChoiceDialogItem<T> {
  label: string;
  value: T;
  description?: string;
}

export interface ChoiceDialogOptions<T> {
  title: string;
  items: ChoiceDialogItem<T>[];
  onSelect(value: T): void;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
}

export interface ViewContext extends AppContext {
  navigate(route: Route): void;

  openChoiceDialog<T>(options: ChoiceDialogOptions<T>): void;

  closeDialog(): void;
  // Reloads the selected theme from ThemeStore and restyles the whole app.
  applyTheme(): Promise<void>;
  back(): void;
  exit(): void;
}
