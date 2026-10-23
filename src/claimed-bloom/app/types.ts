import type { BoxRenderable, CliRenderer } from "@opentui/core";
import type { Route } from "./routes.ts";
import type { SporeClient } from "../services/SporeClient.ts";

export type MenuItemBase = {
  label: string;
  description: string;
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
  colors: Record<string, string>;
  renderer: CliRenderer;
  spore: SporeClient;
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
  back(): void;
  exit(): void;
}
