import { DataSync, DEFAULT_SYNC_KINDS } from "./DataSync.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

async function write(
  root: string,
  path: string,
  content: string,
): Promise<void> {
  const file = `${root}/${path}`;
  await Deno.mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  await Deno.writeTextFile(file, content);
}

async function exists(path: string): Promise<boolean> {
  return await Deno.stat(path).then(() => true, () => false);
}

async function fixture(): Promise<{ dev: string; config: string }> {
  const root = await Deno.makeTempDir({ prefix: "ub-sync-" });
  const dev = `${root}/dev`;
  const config = `${root}/config`;

  await write(dev, "palettes/same.json", "same");
  await write(config, "palettes/same.json", "same");
  await write(dev, "moods/new.json", "new");
  await write(dev, "targets/kitty/recipes/subtle.json", "v2");
  await write(config, "targets/kitty/recipes/subtle.json", "v1");
  await write(dev, "targets/kitty/templates/.ai/notes.md", "skip me");
  await write(config, "targets/ags/hooks/plant.json", "retired");
  await write(dev, "scripts/wallset", "v2");
  await write(config, "scripts/wallset", "v1");

  return { dev, config };
}

Deno.test("DataSync plans theme kinds and leaves scripts out by default", async () => {
  const { dev, config } = await fixture();
  const plan = await new DataSync(dev, config).plan(DEFAULT_SYNC_KINDS);

  assertEquals(
    plan.entries.map((entry) => `${entry.action} ${entry.path}`),
    [
      "add moods/new.json",
      "config-only targets/ags/hooks/plant.json",
      "update targets/kitty/recipes/subtle.json",
    ],
  );
});

Deno.test("DataSync copies, keeps config-only files, and stamps copies with now", async () => {
  const { dev, config } = await fixture();
  const old = new Date("2020-01-01T00:00:00Z");
  await Deno.utime(`${dev}/targets/kitty/recipes/subtle.json`, old, old);
  const before = Date.now();

  const sync = new DataSync(dev, config);
  const result = await sync.apply(await sync.plan(DEFAULT_SYNC_KINDS), false);

  assertEquals(
    [result.copied.length, result.pruned.length, result.kept.length],
    [2, 0, 1],
  );
  assertEquals(
    await Deno.readTextFile(`${config}/targets/kitty/recipes/subtle.json`),
    "v2",
  );
  assertEquals(await exists(`${config}/targets/ags/hooks/plant.json`), true);
  assertEquals(await Deno.readTextFile(`${config}/scripts/wallset`), "v1");

  const mtime = (await Deno.stat(`${config}/targets/kitty/recipes/subtle.json`))
    .mtime!;
  assertEquals(mtime.getTime() >= before - 1000, true);
});

Deno.test("DataSync prune deletes config-only files and their emptied folders", async () => {
  const { dev, config } = await fixture();
  const sync = new DataSync(dev, config);
  const result = await sync.apply(await sync.plan(["hooks"]), true);

  assertEquals(result.pruned.map((entry) => entry.path), [
    "targets/ags/hooks/plant.json",
  ]);
  assertEquals(await exists(`${config}/targets/ags`), false);
  assertEquals(await exists(`${config}/targets`), true);
});

Deno.test("DataSync copies scripts only when asked", async () => {
  const { dev, config } = await fixture();
  const sync = new DataSync(dev, config);
  await sync.apply(await sync.plan(["scripts"]), false);

  assertEquals(await Deno.readTextFile(`${config}/scripts/wallset`), "v2");
  assertEquals(await exists(`${config}/moods/new.json`), false);
});
