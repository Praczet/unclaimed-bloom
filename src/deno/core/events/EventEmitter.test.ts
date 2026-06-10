import { EventEmitter } from "./EventEmitter.ts";

function assertEquals<T>(actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

function assert(value: boolean, msg?: string): void {
  if (!value) throw new Error(msg ?? "assertion failed");
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await Deno.makeTempDir({ prefix: "ub-events-test-" });
  try {
    await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("EventEmitter - creates events.jsonl and state.json on startRun", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "sow", ["ghostty", "yazi"]);

    const eventsText = await Deno.readTextFile(`${dir}/events.jsonl`);
    const stateText = await Deno.readTextFile(`${dir}/state.json`);

    const firstEvent = JSON.parse(eventsText.trim().split("\n")[0]);
    assertEquals(firstEvent.type, "run:start");
    assertEquals(firstEvent.profile, "daily");
    assertEquals(firstEvent.stage, "sow");
    assertEquals(firstEvent.targets, ["ghostty", "yazi"]);

    const state = JSON.parse(stateText);
    assertEquals(state.profile, "daily");
    assertEquals(state.stage, "sow");
    assertEquals(state.status, "running");
    assertEquals(state.targets.ghostty.status, "pending");
    assertEquals(state.targets.yazi.status, "pending");
  });
});

Deno.test("EventEmitter - target:start and target:done update state", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "sow", ["ghostty"]);
    await emitter.startTarget("ghostty");

    let state = JSON.parse(await Deno.readTextFile(`${dir}/state.json`));
    assertEquals(state.targets.ghostty.status, "running");

    await emitter.doneTarget("ghostty");

    state = JSON.parse(await Deno.readTextFile(`${dir}/state.json`));
    assertEquals(state.targets.ghostty.status, "done");
    assert(typeof state.targets.ghostty.duration_ms === "number");
  });
});

Deno.test("EventEmitter - target:error records error state", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "sow", ["ghostty"]);
    await emitter.startTarget("ghostty");
    await emitter.errorTarget("ghostty", "missing token: primary");

    const state = JSON.parse(await Deno.readTextFile(`${dir}/state.json`));
    assertEquals(state.targets.ghostty.status, "error");
  });
});

Deno.test("EventEmitter - target:skip records skipped state", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "plant", ["ghostty"]);
    await emitter.skipTarget("ghostty", "no plant hook");

    const state = JSON.parse(await Deno.readTextFile(`${dir}/state.json`));
    assertEquals(state.targets.ghostty.status, "skipped");
  });
});

Deno.test("EventEmitter - worker:progress updates state.worker", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "plant", ["icons"]);
    await emitter.startTarget("icons");
    await emitter.startWorker("icons", "adart");
    await emitter.progressWorker("icons", "adart", 12, 233223, "recoloring actions/copy.svg");

    const state = JSON.parse(await Deno.readTextFile(`${dir}/state.json`));
    assertEquals(state.targets.icons.worker.current, 12);
    assertEquals(state.targets.icons.worker.total, 233223);
    assertEquals(state.targets.icons.worker.msg, "recoloring actions/copy.svg");
    assert(state.targets.icons.worker.pct > 0);
  });
});

Deno.test("EventEmitter - finishRun sets status to done", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "sow", ["ghostty"]);
    await emitter.startTarget("ghostty");
    await emitter.doneTarget("ghostty");
    await emitter.finishRun();

    const state = JSON.parse(await Deno.readTextFile(`${dir}/state.json`));
    assertEquals(state.status, "done");
  });
});

Deno.test("EventEmitter - errorRun sets status to error", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "sow", ["ghostty"]);
    await emitter.errorRun("disk full");

    const state = JSON.parse(await Deno.readTextFile(`${dir}/state.json`));
    assertEquals(state.status, "error");
  });
});

Deno.test("EventEmitter - events.jsonl appends across multiple calls", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "sow", ["ghostty", "yazi"]);
    await emitter.startTarget("ghostty");
    await emitter.doneTarget("ghostty");
    await emitter.startTarget("yazi");
    await emitter.doneTarget("yazi");
    await emitter.finishRun();

    const lines = (await Deno.readTextFile(`${dir}/events.jsonl`))
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);

    // run:start + 2x(target:start + target:done) + run:done = 6 events
    assertEquals(lines.length, 6);

    const types = lines.map((l) => (JSON.parse(l) as { type: string }).type);
    assertEquals(types[0], "run:start");
    assertEquals(types[5], "run:done");
  });
});

Deno.test("EventEmitter - run_id is consistent within a run", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "sow", ["ghostty"]);
    await emitter.startTarget("ghostty");
    await emitter.doneTarget("ghostty");
    await emitter.finishRun();

    const lines = (await Deno.readTextFile(`${dir}/events.jsonl`))
      .trim()
      .split("\n");

    const ids = lines.map((l) => (JSON.parse(l) as { run_id: string }).run_id);
    assert(ids.every((id) => id === ids[0]), "all events should share the same run_id");
    assert(ids[0].length > 0, "run_id should be non-empty");
  });
});

Deno.test("EventEmitter - state.json is valid JSON after atomic write", async () => {
  await withTempDir(async (dir) => {
    const emitter = new EventEmitter(`${dir}/events.jsonl`, `${dir}/state.json`);
    await emitter.startRun("daily", "grow", ["ghostty", "yazi", "icons"]);

    for (const target of ["ghostty", "yazi", "icons"]) {
      await emitter.startTarget(target);
      await emitter.doneTarget(target);
    }
    await emitter.finishRun();

    const raw = await Deno.readTextFile(`${dir}/state.json`);
    const state = JSON.parse(raw);
    assertEquals(state.status, "done");
    assertEquals(Object.keys(state.targets).length, 3);
  });
});
