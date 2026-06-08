import { PaletteLoader } from "./PaletteLoader.ts";

const FIXTURES_DIR = "src/deno/tests/fixtures/palettes";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

async function assertRejects(
  action: () => Promise<unknown>,
  expectedMessagePart: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessagePart)) {
      throw new Error(
        `Expected error to include "${expectedMessagePart}", received "${message}"`,
      );
    }
    return;
  }

  throw new Error("Expected action to reject, but it resolved");
}

Deno.test("PaletteLoader lists palettes with summaries", async () => {
  const loader = new PaletteLoader();
  const palettes = await loader.list(FIXTURES_DIR);

  assertEquals(palettes, [
    {
      name: "Tiny Alpha",
      slug: "tiny-alpha",
      kind: "dark",
      colorCount: 4,
      path: "src/deno/tests/fixtures/palettes/tiny-alpha.json",
    },
    {
      name: "Tiny Dark",
      slug: "tiny-dark",
      kind: "dark",
      colorCount: 3,
      path: "src/deno/tests/fixtures/palettes/tiny-dark.json",
    },
    {
      name: "Tiny Light",
      slug: "tiny-light",
      kind: "light",
      colorCount: 3,
      path: "src/deno/tests/fixtures/palettes/tiny-light.json",
    },
  ]);
});

Deno.test("PaletteLoader inspects one palette by slug", async () => {
  const loader = new PaletteLoader();
  const palette = await loader.inspect(FIXTURES_DIR, "tiny-dark");

  assertEquals(palette, {
    name: "Tiny Dark",
    slug: "tiny-dark",
    kind: "dark",
    source: "fixture",
    colors: {
      background: "#111111",
      foreground: "#eeeeee",
      accent: "#88aaff",
    },
  });
});

Deno.test("PaletteLoader reports missing required fields", async () => {
  const loader = new PaletteLoader();

  await assertRejects(
    () => loader.loadFile(`${FIXTURES_DIR}/broken/broken-missing-name.json`),
    'Missing required string field "name"',
  );
});

Deno.test("PaletteLoader reports invalid hex colors", async () => {
  const loader = new PaletteLoader();

  await assertRejects(
    () => loader.loadFile(`${FIXTURES_DIR}/broken/broken-invalid-color.json`),
    'Invalid hex color for "colors.background"',
  );
});

Deno.test("PaletteLoader accepts short and alpha hex colors", async () => {
  const loader = new PaletteLoader();
  const palette = await loader.inspect(FIXTURES_DIR, "tiny-alpha");

  assertEquals(palette.colors, {
    shortRgb: "#abc",
    shortRgba: "#abcd",
    rgb: "#aabbcc",
    rgba: "#aabbccdd",
  });
});
