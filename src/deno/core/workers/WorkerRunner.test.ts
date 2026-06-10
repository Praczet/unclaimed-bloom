import { WorkerRunner } from "./WorkerRunner.ts";

function assertEquals<T>(actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

function assert(value: boolean, msg?: string): void {
  if (!value) throw new Error(msg ?? "assertion failed");
}

Deno.test("WorkerRunner - captures stdout and exit code", async () => {
  const runner = new WorkerRunner();
  const result = await runner.run({
    command: "sh",
    args: ["-c", "echo hello world"],
  });
  assertEquals(result.ok, true);
  assertEquals(result.exitCode, 0);
  assert(result.stdout.trim() === "hello world");
});

Deno.test("WorkerRunner - captures stderr", async () => {
  const runner = new WorkerRunner();
  const result = await runner.run({
    command: "sh",
    args: ["-c", "echo error msg >&2"],
  });
  assertEquals(result.ok, true);
  assert(result.stderr.trim() === "error msg");
});

Deno.test("WorkerRunner - reports failure for non-zero exit", async () => {
  const runner = new WorkerRunner();
  const result = await runner.run({
    command: "sh",
    args: ["-c", "exit 2"],
  });
  assertEquals(result.ok, false);
  assertEquals(result.exitCode, 2);
});

Deno.test("WorkerRunner - parses JSON progress lines from stdout", async () => {
  const runner = new WorkerRunner();
  const progresses: Array<{ current: number; total: number; msg: string }> = [];

  const script = [
    '{"progress":{"current":1,"total":3,"msg":"step one"}}',
    '{"progress":{"current":2,"total":3,"msg":"step two"}}',
    '{"progress":{"current":3,"total":3,"msg":"step three"}}',
  ].join("\\n");

  await runner.run(
    { command: "printf", args: [`${script}\\n`] },
    (p) => {
      progresses.push({ current: p.current, total: p.total, msg: p.msg });
    },
  );

  assertEquals(progresses.length, 3);
  assertEquals(progresses[0], { current: 1, total: 3, msg: "step one" });
  assertEquals(progresses[2], { current: 3, total: 3, msg: "step three" });
});

Deno.test("WorkerRunner - non-JSON stdout lines are not treated as progress", async () => {
  const runner = new WorkerRunner();
  const progresses: unknown[] = [];
  await runner.run(
    { command: "sh", args: ["-c", "echo plain text"] },
    (p) => { progresses.push(p); },
  );
  assertEquals(progresses.length, 0);
});

Deno.test("WorkerRunner.parseProgressLine - valid progress", () => {
  const runner = new WorkerRunner();
  const result = runner.parseProgressLine(
    '{"progress":{"current":5,"total":100,"msg":"doing thing"}}',
  );
  assertEquals(result, { current: 5, total: 100, msg: "doing thing" });
});

Deno.test("WorkerRunner.parseProgressLine - missing fields returns null", () => {
  const runner = new WorkerRunner();
  assertEquals(runner.parseProgressLine("{}"), null);
  assertEquals(runner.parseProgressLine('{"progress":{}}'), null);
  assertEquals(runner.parseProgressLine("not json"), null);
  assertEquals(runner.parseProgressLine(""), null);
});

Deno.test("WorkerRunner - records duration", async () => {
  const runner = new WorkerRunner();
  const result = await runner.run({ command: "sh", args: ["-c", "true"] });
  assert(result.durationMs >= 0);
});
