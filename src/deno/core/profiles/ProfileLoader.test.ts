import { ProfileLoader } from "./ProfileLoader.ts";

const FIXTURES_DIR = "src/deno/tests/fixtures/profiles";

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

Deno.test("ProfileLoader lists normal and composition profiles", async () => {
  const loader = new ProfileLoader();
  const profiles = await loader.list(FIXTURES_DIR);

  assertEquals(profiles, [
    {
      name: "desktop",
      type: "composition",
      runCount: 2,
      path: "src/deno/tests/fixtures/profiles/desktop.json",
    },
    {
      name: "tiny",
      type: "profile",
      basePalette: "tiny-dark",
      mood: "budding",
      targetCount: 2,
      path: "src/deno/tests/fixtures/profiles/tiny.json",
    },
  ]);
});

Deno.test("ProfileLoader inspects a normal profile", async () => {
  const loader = new ProfileLoader();
  const profile = await loader.inspect(FIXTURES_DIR, "tiny");

  assertEquals(profile, {
    name: "tiny",
    basePalette: "tiny-dark",
    mood: "budding",
    source: {
      type: "matugen",
      colorsPath: "~/.cache/unclaimed-bloom/matugen-colors.json",
      variant: "dark",
    },
    targets: {
      ghostty: "subtle-ish",
      nvim: "readable",
    },
  });
});

Deno.test("ProfileLoader inspects a composition profile", async () => {
  const loader = new ProfileLoader();
  const profile = await loader.inspect(FIXTURES_DIR, "desktop");

  assertEquals(profile, {
    name: "desktop",
    type: "composition",
    runs: [
      {
        profile: "tiny-gtk",
        targets: ["gtk"],
      },
      {
        profile: "tiny",
      },
    ],
    currentProfile: "tiny",
  });
});

Deno.test("ProfileLoader reports invalid source variants", async () => {
  const loader = new ProfileLoader();

  await assertRejects(
    () => loader.loadFile(`${FIXTURES_DIR}/broken/broken-source-variant.json`),
    'Field "source.variant" must be "dark", "light", or "default"',
  );
});
