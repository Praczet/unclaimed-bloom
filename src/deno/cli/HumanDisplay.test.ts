import { HumanDisplay } from "./HumanDisplay.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

Deno.test("HumanDisplay abbreviates HOME paths by default", () => {
  const display = new HumanDisplay({
    HOME: "/home/adam",
    TERM: "dumb",
  });

  assertEquals(display.formatText("/home/adam"), "~");
  assertEquals(
    display.formatText("/home/adam/.config/unclaimed-bloom/deno.json"),
    "~/.config/unclaimed-bloom/deno.json",
  );
});

Deno.test("HumanDisplay can keep full HOME paths", () => {
  const display = new HumanDisplay({
    HOME: "/home/adam",
    TERM: "dumb",
    UB_HOMEPATH_ABBRV: "false",
  });

  assertEquals(
    display.formatText("/home/adam/.config/unclaimed-bloom/deno.json"),
    "/home/adam/.config/unclaimed-bloom/deno.json",
  );
});
