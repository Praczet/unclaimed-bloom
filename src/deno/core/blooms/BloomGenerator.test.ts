import { BloomGenerator } from "./BloomGenerator.ts";
import type { Mood } from "../moods/MoodLoader.ts";
import type { Palette } from "../palettes/PaletteLoader.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

function makeBasePalette(): Palette {
  return {
    name: "Base",
    slug: "base",
    kind: "dark",
    colors: {
      background: "#000000",
      background_dark: "#101010",
      background_highlight: "#202020",
      border: "#303030",
      foreground: "#ffffff",
      foreground_dark: "#cccccc",
      comment: "#808080",
      blue: "#0000ff",
      magenta: "#ff00ff",
      purple: "#8000ff",
      green: "#00ff00",
      yellow: "#ffff00",
      red: "#ff0000",
      cyan: "#00ffff",
    },
  };
}

function makeSourcePalette(): Palette {
  return {
    name: "Source",
    slug: "source",
    kind: "dark",
    colors: {
      background: "#ffffff",
      surface: "#ffffff",
      surface_container_high: "#ffffff",
      surface_container_highest: "#ffffff",
      on_surface: "#000000",
      on_surface_variant: "#000000",
      outline: "#000000",
      outline_variant: "#000000",
      primary: "#ffffff",
      secondary: "#000000",
      tertiary: "#ffffff",
      error: "#000000",
      secondary_container: "#ffffff",
      on_secondary_container: "#000000",
    },
  };
}

function makeMood(): Mood {
  return {
    name: "half",
    weights: {
      surface: 0.5,
      foreground: 0.5,
      accent: 0.5,
      semantic: 0.5,
    },
  };
}

Deno.test("BloomGenerator mixes base and source colors into semantic bloom tokens", () => {
  const generator = new BloomGenerator();
  const bloom = generator.generate(
    makeBasePalette(),
    makeSourcePalette(),
    makeMood(),
    "tiny",
    "2026-06-08T00:00:00.000Z",
  );

  assertEquals(bloom.profile, "tiny");
  assertEquals(bloom.generatedAt, "2026-06-08T00:00:00.000Z");
  assertEquals(bloom.colors.surface.base, "#808080");
  assertEquals(bloom.colors.text.primary, "#808080");
  assertEquals(bloom.colors.accent.primary, "#8080ff");
  assertEquals(bloom.colors.state.danger, "#800000");
});

Deno.test("BloomGenerator preview includes inspectable source/base rows", () => {
  const generator = new BloomGenerator();
  const preview = generator.preview(
    makeBasePalette(),
    makeSourcePalette(),
    makeMood(),
    "tiny",
    "2026-06-08T00:00:00.000Z",
  );

  assertEquals(preview.rows[0], {
    path: "surface.base",
    baseKey: "background",
    baseHex: "#000000",
    sourceKey: "background",
    sourceHex: "#ffffff",
    weight: 0.5,
    result: "#808080",
  });
});
