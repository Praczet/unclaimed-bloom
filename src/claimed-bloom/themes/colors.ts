import defaultTheme from "./theme-default.json";

export const THEME_COLOR_KEYS = [
  "background",
  "panel",
  "panelRaised",
  "foreground",
  "muted",
  "accent",
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export type ThemeColors = Record<ThemeColorKey, string>;

// Fallback for keys a theme file leaves out, and the theme used when none loads.
export const DefaultColors: ThemeColors = defaultTheme.colors;
