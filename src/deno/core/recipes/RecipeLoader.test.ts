import { RecipeLoader } from "./RecipeLoader.ts";

const FIXTURES_DIR = "src/deno/tests/fixtures/targets";

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

Deno.test("RecipeLoader lists recipes across targets", async () => {
  const loader = new RecipeLoader();
  const recipes = await loader.list(FIXTURES_DIR);

  assertEquals(recipes, [
    {
      name: "subtle-ish",
      target: "ghostty",
      id: "ghostty/subtle-ish",
      tokenCount: 3,
      path: "src/deno/tests/fixtures/targets/ghostty/recipes/subtle-ish.json",
    },
    {
      name: "readable",
      target: "nvim",
      id: "nvim/readable",
      basePalette: "tiny-light",
      tokenCount: 2,
      path: "src/deno/tests/fixtures/targets/nvim/recipes/readable.json",
    },
  ]);
});

Deno.test("RecipeLoader lists recipes for one target", async () => {
  const loader = new RecipeLoader();
  const recipes = await loader.list(FIXTURES_DIR, "ghostty");

  assertEquals(recipes, [
    {
      name: "subtle-ish",
      target: "ghostty",
      id: "ghostty/subtle-ish",
      tokenCount: 3,
      path: "src/deno/tests/fixtures/targets/ghostty/recipes/subtle-ish.json",
    },
  ]);
});

Deno.test("RecipeLoader inspects one recipe by target/name id", async () => {
  const loader = new RecipeLoader();
  const recipe = await loader.inspect(FIXTURES_DIR, "ghostty/subtle-ish");

  assertEquals(recipe, {
    name: "subtle-ish",
    target: "ghostty",
    tokens: {
      background: {
        bloom: "surface.base",
        source: "background",
        mix: 0.15,
      },
      foreground: {
        bloom: "text.primary",
      },
      cursor: {
        base: "blue",
      },
    },
  });
});

Deno.test("RecipeLoader reports out-of-range mix values", async () => {
  const loader = new RecipeLoader();

  await assertRejects(
    () =>
      loader.loadFile("src/deno/tests/fixtures/recipes/broken/broken-mix.json"),
    'Field "tokens.background.mix" must be a number from 0.0 to 1.0',
  );
});
