import { TemplateRenderer } from "./TemplateRenderer.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

function assertThrows(action: () => unknown, expectedMessagePart: string): void {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessagePart)) {
      throw new Error(
        `Expected error to include "${expectedMessagePart}", received "${message}"`,
      );
    }
    return;
  }
  throw new Error("Expected action to throw, but it did not");
}

const renderer = new TemplateRenderer();

Deno.test("render substitutes simple tokens", () => {
  const result = renderer.render(
    "background = {{background}}\nforeground = {{foreground}}",
    { background: "#1a1b26", foreground: "#c0caf5" },
  );
  assertEquals(result, "background = #1a1b26\nforeground = #c0caf5");
});

Deno.test("render substitutes token with underscores", () => {
  const result = renderer.render("{{surface_variant}}", { surface_variant: "#414868" });
  assertEquals(result, "#414868");
});

Deno.test("render substitutes token with double underscores (icons format)", () => {
  const result = renderer.render(
    '"{{__ADART_ICON_SURFACE__}}"',
    { __ADART_ICON_SURFACE__: "#1a1b26" },
  );
  assertEquals(result, '"#1a1b26"');
});

Deno.test("render substitutes same token used multiple times", () => {
  const result = renderer.render(
    "{{primary}} {{primary}} {{primary}}",
    { primary: "#7aa2f7" },
  );
  assertEquals(result, "#7aa2f7 #7aa2f7 #7aa2f7");
});

Deno.test("render |rgba produces hyprland format (6-digit hex)", () => {
  const result = renderer.render("$primary = {{primary|rgba}}", { primary: "#7aa2f7" });
  assertEquals(result, "$primary = rgba(7aa2f7ff)");
});

Deno.test("render |rgba strips leading hash", () => {
  const result = renderer.render("{{c|rgba}}", { c: "#1a1b26" });
  assertEquals(result, "rgba(1a1b26ff)");
});

Deno.test("render |rgba expands 3-digit hex", () => {
  const result = renderer.render("{{c|rgba}}", { c: "#fff" });
  assertEquals(result, "rgba(ffffffff)");
});

Deno.test("render |rgba handles 8-digit hex by dropping alpha", () => {
  const result = renderer.render("{{c|rgba}}", { c: "#1a1b26ff" });
  assertEquals(result, "rgba(1a1b26ff)");
});

Deno.test("render |rgba:alpha produces CSS rgba format", () => {
  const result = renderer.render(
    "background: {{background|rgba:0.75}};",
    { background: "#1a1b26" },
  );
  assertEquals(result, "background: rgba(26, 27, 38, 0.75);");
});

Deno.test("render |rgba:1 produces fully opaque CSS rgba", () => {
  const result = renderer.render("{{c|rgba:1}}", { c: "#ffffff" });
  assertEquals(result, "rgba(255, 255, 255, 1)");
});

Deno.test("render |rgba:0 produces fully transparent CSS rgba", () => {
  const result = renderer.render("{{c|rgba:0}}", { c: "#000000" });
  assertEquals(result, "rgba(0, 0, 0, 0)");
});

Deno.test("render |rgba:alpha expands 3-digit hex", () => {
  const result = renderer.render("{{c|rgba:0.5}}", { c: "#fff" });
  assertEquals(result, "rgba(255, 255, 255, 0.5)");
});

Deno.test("render throws on missing token and names it", () => {
  assertThrows(
    () => renderer.render("{{missing}}", {}),
    "Missing template tokens: missing",
  );
});

Deno.test("render throws listing all missing tokens", () => {
  assertThrows(
    () => renderer.render("{{a}} {{b}} {{c}}", {}),
    "Missing template tokens: a, b, c",
  );
});

Deno.test("render throws on unknown modifier", () => {
  assertThrows(
    () => renderer.render("{{primary|hex}}", { primary: "#7aa2f7" }),
    'Unknown modifier "hex"',
  );
});

Deno.test("render throws on invalid alpha in rgba: modifier", () => {
  assertThrows(
    () => renderer.render("{{c|rgba:1.5}}", { c: "#ffffff" }),
    "Invalid alpha",
  );
});

Deno.test("render throws on invalid hex in rgba modifier", () => {
  assertThrows(
    () => renderer.render("{{c|rgba}}", { c: "notahex" }),
    'Invalid hex color "notahex"',
  );
});

Deno.test("render leaves non-token text unchanged", () => {
  const template = "# comment\nkey = value\n{{token}}";
  const result = renderer.render(template, { token: "#ff0000" });
  assertEquals(result, "# comment\nkey = value\n#ff0000");
});
