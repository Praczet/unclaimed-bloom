import { mkdirSync, watch, type FSWatcher } from "node:fs";
import { basename, resolve } from "node:path";

import { DefaultColors, THEME_COLOR_KEYS, type ThemeColors } from "../themes/colors.ts";

export interface Theme {
  id: string;
  name: string;
  description: string;
  path: string;
  source: "bundled" | "user";
  colors: ThemeColors;
  // Keys missing or invalid in the file, filled from the default theme.
  fallbackKeys: string[];
}

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

// Bundled themes ship with claimed-bloom; user themes (for example the one
// spore plants as theme-unclaimed-bloom.json) live in the config dir and win
// over a bundled theme with the same id.
export class ThemeStore {
  private watchers: FSWatcher[] = [];

  constructor(
    private readonly bundledDir = resolve(import.meta.dir, "../themes"),
    private readonly configDir = resolve(
      Bun.env.XDG_CONFIG_HOME ?? resolve(Bun.env.HOME ?? "", ".config"),
      "claimed-bloom",
    ),
  ) { }

  get userDir(): string {
    return resolve(this.configDir, "themes");
  }

  async list(): Promise<Theme[]> {
    const themes = new Map<string, Theme>();

    for (const [dir, source] of [[this.bundledDir, "bundled"], [this.userDir, "user"]] as const) {
      for (const path of await this.themeFiles(dir)) {
        const theme = await this.load(path, source);
        if (theme) themes.set(theme.id, theme);
      }
    }

    return [...themes.values()].sort((a, b) =>
      a.id === "default" ? -1 : b.id === "default" ? 1 : a.name.localeCompare(b.name)
    );
  }

  async selectedId(): Promise<string> {
    try {
      const settings = (await Bun.file(this.settingsPath).json()) as { theme?: unknown };
      return typeof settings.theme === "string" ? settings.theme : "default";
    } catch {
      return "default";
    }
  }

  // The selected theme, or the default one when it is gone or unreadable.
  async current(): Promise<Theme> {
    const themes = await this.list();
    const id = await this.selectedId();
    return themes.find((theme) => theme.id === id) ?? themes.find((theme) => theme.id === "default") ?? {
      id: "default",
      name: "Default",
      description: "Built-in fallback.",
      path: "",
      source: "bundled",
      colors: { ...DefaultColors },
      fallbackKeys: [],
    };
  }

  async select(id: string): Promise<void> {
    let settings: Record<string, unknown> = {};
    try {
      settings = (await Bun.file(this.settingsPath).json()) as Record<string, unknown>;
    } catch { /* first save */ }
    await Bun.write(this.settingsPath, `${JSON.stringify({ ...settings, theme: id }, null, 2)}\n`);
  }

  // Calls onChange when a theme file in either folder is written, so a theme
  // planted by spore restyles a running claimed-bloom. The user folder is
  // created up front so a theme planted later is still seen.
  watch(onChange: () => void): void {
    this.close();
    mkdirSync(this.userDir, { recursive: true });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const notify = (_event: string, file: string | null) => {
      if (file && !/^theme-.+\.json$/.test(basename(file))) return;
      clearTimeout(timer);
      timer = setTimeout(onChange, 150);
    };

    for (const dir of [this.bundledDir, this.userDir]) {
      try {
        this.watchers.push(watch(dir, notify));
      } catch { /* folder is not watchable */ }
    }
  }

  close(): void {
    for (const watcher of this.watchers) watcher.close();
    this.watchers = [];
  }

  private get settingsPath(): string {
    return resolve(this.configDir, "settings.json");
  }

  private async themeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      for await (const file of new Bun.Glob("theme-*.json").scan({ cwd: dir })) {
        files.push(resolve(dir, file));
      }
    } catch { /* folder does not exist */ }
    return files.sort();
  }

  private async load(path: string, source: Theme["source"]): Promise<Theme | undefined> {
    let raw: { name?: unknown; description?: unknown; colors?: Record<string, unknown> };
    try {
      raw = await Bun.file(path).json();
    } catch {
      return undefined;
    }

    const id = basename(path).replace(/^theme-/, "").replace(/\.json$/, "");
    const colors = { ...DefaultColors };
    const fallbackKeys: string[] = [];

    for (const key of THEME_COLOR_KEYS) {
      const value = raw.colors?.[key];
      if (typeof value === "string" && HEX.test(value)) {
        colors[key] = value;
      } else {
        fallbackKeys.push(key);
      }
    }

    return {
      id,
      name: typeof raw.name === "string" ? raw.name : id,
      description: typeof raw.description === "string" ? raw.description : "",
      path,
      source,
      colors,
      fallbackKeys,
    };
  }
}
