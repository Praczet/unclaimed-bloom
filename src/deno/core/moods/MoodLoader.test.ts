import { MoodLoader } from "./MoodLoader.ts";

const FIXTURES_DIR = "src/deno/tests/fixtures/moods";

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

Deno.test("MoodLoader lists moods with summaries", async () => {
  const loader = new MoodLoader();
  const moods = await loader.list(FIXTURES_DIR);

  assertEquals(moods, [
    {
      name: "half",
      description: "fixture mood with equal source/base mixing",
      weights: { surface: 0.5, foreground: 0.5, accent: 0.5, semantic: 0.5 },
      path: "src/deno/tests/fixtures/moods/half.json",
    },
  ]);
});

Deno.test("MoodLoader inspects one mood by name", async () => {
  const loader = new MoodLoader();
  const mood = await loader.inspect(FIXTURES_DIR, "half");

  assertEquals(mood, {
    name: "half",
    description: "fixture mood with equal source/base mixing",
    weights: { surface: 0.5, foreground: 0.5, accent: 0.5, semantic: 0.5 },
  });
});

Deno.test("MoodLoader throws on missing mood file", async () => {
  const loader = new MoodLoader();

  await assertRejects(
    () => loader.inspect(FIXTURES_DIR, "nonexistent"),
    "Mood file not found",
  );
});

Deno.test("MoodLoader throws on missing moods directory", async () => {
  const loader = new MoodLoader();

  await assertRejects(
    () => loader.list("src/deno/tests/fixtures/nonexistent"),
    "Moods directory not found",
  );
});
