import { HookRunner, type PlantContext } from "./HookRunner.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

async function assertRejects(
  action: () => Promise<unknown>,
  expectedPart: string,
): Promise<void> {
  try {
    await action();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes(expectedPart)) {
      throw new Error(`Expected error to include "${expectedPart}", got "${msg}"`);
    }
    return;
  }
  throw new Error("Expected action to reject, but it resolved");
}

async function writeTempJson(dir: string, name: string, data: unknown): Promise<string> {
  const path = `${dir}/${name}`;
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2));
  return path;
}

const ctx: PlantContext = {
  rendered: "/cache/rendered/daily/ghostty/ghostty.theme",
  profile: "daily",
  target: "ghostty",
  recipe: "subtle-ish",
  cacheDir: "/cache",
  dataDir: "/data",
};

// --- substitute ---

Deno.test("HookRunner substitutes all context variables", () => {
  const runner = new HookRunner();
  const result = runner.substitute(
    "{{rendered}} {{profile}} {{target}} {{recipe}} {{cache_dir}} {{data_dir}}",
    ctx,
  );
  assertEquals(
    result,
    "/cache/rendered/daily/ghostty/ghostty.theme daily ghostty subtle-ish /cache /data",
  );
});

Deno.test("HookRunner substitutes repeated variables", () => {
  const runner = new HookRunner();
  const result = runner.substitute("{{target}}/{{recipe}}/{{target}}", ctx);
  assertEquals(result, "ghostty/subtle-ish/ghostty");
});

Deno.test("HookRunner leaves unknown placeholders unchanged", () => {
  const runner = new HookRunner();
  const result = runner.substitute("{{unknown}} {{profile}}", ctx);
  assertEquals(result, "{{unknown}} daily");
});

// --- loadHook ---

Deno.test("HookRunner loads a valid hook file", async () => {
  const dir = await Deno.makeTempDir();
  const path = await writeTempJson(dir, "plant.json", {
    steps: [
      { type: "copy", dest: ["~/.config/ghostty/theme.toml"] },
      { type: "exec", command: "echo", args: ["hello"] },
    ],
  });

  const runner = new HookRunner();
  const hook = await runner.loadHook(path);

  assertEquals(hook.steps.length, 2);
  assertEquals(hook.steps[0], { type: "copy", dest: ["~/.config/ghostty/theme.toml"] });
  assertEquals(hook.steps[1], { type: "exec", command: "echo", args: ["hello"] });
});

Deno.test("HookRunner throws on missing hook file", async () => {
  const runner = new HookRunner();
  await assertRejects(
    () => runner.loadHook("/nonexistent/plant.json"),
    "Hook file not found",
  );
});

Deno.test("HookRunner throws on invalid JSON", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/plant.json`;
  await Deno.writeTextFile(path, "{ not valid json");
  const runner = new HookRunner();
  await assertRejects(() => runner.loadHook(path), "Invalid JSON");
});

Deno.test("HookRunner throws when steps is missing", async () => {
  const dir = await Deno.makeTempDir();
  const path = await writeTempJson(dir, "plant.json", { notSteps: [] });
  const runner = new HookRunner();
  await assertRejects(() => runner.loadHook(path), 'missing "steps" array');
});

Deno.test("HookRunner throws on unknown step type", async () => {
  const dir = await Deno.makeTempDir();
  const path = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "teleport", dest: ["/somewhere"] }],
  });
  const runner = new HookRunner();
  await assertRejects(() => runner.loadHook(path), 'unknown type "teleport"');
});

Deno.test("HookRunner throws when copy step has no dest", async () => {
  const dir = await Deno.makeTempDir();
  const path = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "copy" }],
  });
  const runner = new HookRunner();
  await assertRejects(() => runner.loadHook(path), '"copy" requires a "dest"');
});

Deno.test("HookRunner throws when exec step has no command", async () => {
  const dir = await Deno.makeTempDir();
  const path = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "exec", args: ["hello"] }],
  });
  const runner = new HookRunner();
  await assertRejects(() => runner.loadHook(path), '"exec" requires a "command"');
});

// --- copy step ---

Deno.test("HookRunner copy step writes file to dest", async () => {
  const dir = await Deno.makeTempDir();
  const srcFile = `${dir}/src.txt`;
  const destFile = `${dir}/sub/dest.txt`;
  await Deno.writeTextFile(srcFile, "hello");

  const hookPath = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "copy", dest: [destFile] }],
  });

  const runner = new HookRunner();
  const hook = await runner.loadHook(hookPath);

  const localCtx: PlantContext = { ...ctx, rendered: srcFile };
  const result = await (runner as unknown as {
    executeStep: (step: unknown, ctx: PlantContext) => Promise<unknown>;
  }).executeStep(hook.steps[0], localCtx);

  assertEquals((result as { ok: boolean }).ok, true);
  assertEquals(await Deno.readTextFile(destFile), "hello");
});

Deno.test("HookRunner copy step substitutes variables in dest", async () => {
  const dir = await Deno.makeTempDir();
  const srcFile = `${dir}/src.txt`;
  await Deno.writeTextFile(srcFile, "content");

  const hookPath = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "copy", dest: [`${dir}/{{profile}}-{{target}}.txt`] }],
  });

  const runner = new HookRunner();
  const hook = await runner.loadHook(hookPath);
  const localCtx: PlantContext = { ...ctx, rendered: srcFile };

  await (runner as unknown as {
    executeStep: (step: unknown, ctx: PlantContext) => Promise<unknown>;
  }).executeStep(hook.steps[0], localCtx);

  assertEquals(await Deno.readTextFile(`${dir}/daily-ghostty.txt`), "content");
});

// --- exec step ---

Deno.test("HookRunner exec step runs command and succeeds", async () => {
  const dir = await Deno.makeTempDir();
  const hookPath = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "exec", command: "echo", args: ["hello"] }],
  });

  const runner = new HookRunner();
  const hook = await runner.loadHook(hookPath);
  const result = await (runner as unknown as {
    executeStep: (step: unknown, ctx: PlantContext) => Promise<unknown>;
  }).executeStep(hook.steps[0], ctx);

  assertEquals((result as { ok: boolean }).ok, true);
});

Deno.test("HookRunner exec step throws on non-zero exit", async () => {
  const dir = await Deno.makeTempDir();
  const hookPath = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "exec", command: "false", args: [] }],
  });

  const runner = new HookRunner();
  const hook = await runner.loadHook(hookPath);

  await assertRejects(
    () => (runner as unknown as {
      executeStep: (step: unknown, ctx: PlantContext) => Promise<unknown>;
    }).executeStep(hook.steps[0], ctx),
    "Command failed",
  );
});

// --- dry run ---

Deno.test("HookRunner dry run describes copy without writing", async () => {
  const dir = await Deno.makeTempDir();
  const hookPath = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "copy", dest: ["/some/path/theme.toml"] }],
  });

  const runner = new HookRunner();
  const hook = await runner.loadHook(hookPath);
  const result = (runner as unknown as {
    dryRunStep: (step: unknown, ctx: PlantContext) => unknown;
  }).dryRunStep(hook.steps[0], ctx);

  assertEquals((result as { type: string }).type, "copy");
  assertEquals((result as { ok: boolean }).ok, true);
  const detail = (result as { detail: string }).detail;
  if (!detail.includes("would copy to")) throw new Error(`Expected dry-run detail, got: ${detail}`);
});

Deno.test("HookRunner dry run describes exec without running", async () => {
  const dir = await Deno.makeTempDir();
  const hookPath = await writeTempJson(dir, "plant.json", {
    steps: [{ type: "exec", command: "gsettings", args: ["set", "key", "val"] }],
  });

  const runner = new HookRunner();
  const hook = await runner.loadHook(hookPath);
  const result = (runner as unknown as {
    dryRunStep: (step: unknown, ctx: PlantContext) => unknown;
  }).dryRunStep(hook.steps[0], ctx);

  const detail = (result as { detail: string }).detail;
  if (!detail.includes("would run: gsettings")) {
    throw new Error(`Expected dry-run detail, got: ${detail}`);
  }
});
