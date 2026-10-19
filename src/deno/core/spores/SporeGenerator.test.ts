import type { Bloom } from "../blooms/BloomGenerator.ts";
import type { Palette } from "../palettes/PaletteLoader.ts";
import type { Recipe } from "../recipes/RecipeLoader.ts";
import { SporeGenerator } from "./SporeGenerator.ts";

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
      foreground: "#ffffff",
      blue: "#0000ff",
    },
  };
}

function makeSourcePalette(): Palette {
  return {
    name: "Source",
    slug: "source",
    kind: "dark",
    colors: {
      primary: "#ffffff",
      background: "#222222",
    },
  };
}

function makeBloom(): Bloom {
  return {
    profile: "tiny",
    generatedAt: "2026-06-09T00:00:00.000Z",
    colors: {
      surface: {
        base: "#111111",
        dim: "#101010",
        raised: "#202020",
        highest: "#303030",
      },
      text: {
        primary: "#eeeeee",
        secondary: "#cccccc",
        muted: "#999999",
        disabled: "#666666",
      },
      accent: {
        primary: "#0000ff",
        secondary: "#ff00ff",
        tertiary: "#8000ff",
      },
      state: {
        success: "#00ff00",
        warning: "#ffff00",
        danger: "#ff0000",
        info: "#00ffff",
      },
      border: {
        subtle: "#444444",
        strong: "#888888",
      },
      selection: {
        background: "#333333",
        foreground: "#ffffff",
      },
    },
  };
}

Deno.test("SporeGenerator resolves bloom, base, and direct mix recipe tokens", () => {
  const generator = new SporeGenerator();
  const recipe: Recipe = {
    name: "subtle-ish",
    target: "ghostty",
    tokens: {
      background: {
        bloom: "surface.base",
      },
      cursor: {
        bloom: "accent.primary",
        source: "primary",
        mix: 0.5,
      },
      pureBase: {
        base: "foreground",
      },
      direct: {
        base: "background",
        source: "background",
        mix: 0.5,
      },
    },
  };
  const spore = generator.generate(
    makeBasePalette(),
    makeSourcePalette(),
    makeBloom(),
    recipe,
    "tiny",
    "2026-06-09T00:00:00.000Z",
  );

  assertEquals(spore, {
    target: "ghostty",
    recipe: "subtle-ish",
    profile: "tiny",
    generatedAt: "2026-06-09T00:00:00.000Z",
    colors: {
      background: "#111111",
      cursor: "#8080ff",
      pureBase: "#ffffff",
      direct: "#111111",
    },
  });
});

Deno.test("SporeGenerator resolves derived tokens from earlier recipe tokens", () => {
  const generator = new SporeGenerator();
  const recipe: Recipe = {
    name: "ssh-ish",
    target: "kitty",
    tokens: {
      background: { bloom: "surface.base" },
      danger: { bloom: "state.danger" },
      ssh_background: { token: "background", tint: "danger", mix: 0.5 },
    },
  };
  const spore = generator.generate(
    makeBasePalette(),
    makeSourcePalette(),
    makeBloom(),
    recipe,
    "tiny",
    "2026-06-09T00:00:00.000Z",
  );

  assertEquals(spore.colors["ssh_background"], "#880909");
});

Deno.test("SporeGenerator rejects derived tokens that reference later tokens", () => {
  const generator = new SporeGenerator();
  const recipe: Recipe = {
    name: "ssh-ish",
    target: "kitty",
    tokens: {
      ssh_background: { token: "background", tint: "danger", mix: 0.5 },
      background: { bloom: "surface.base" },
      danger: { bloom: "state.danger" },
    },
  };

  let message = "";
  try {
    generator.generate(
      makeBasePalette(),
      makeSourcePalette(),
      makeBloom(),
      recipe,
      "tiny",
    );
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  if (!message.includes("must be declared earlier")) {
    throw new Error(
      `Expected ordering error, received ${JSON.stringify(message)}`,
    );
  }
});
