import { BoxRenderable, ScrollBoxRenderable, TextRenderable } from "@opentui/core";

import type { View, ViewContext } from "../app/types.ts";
import { findAction } from "../services/actions.ts";
import { formatDuration } from "../app/utils.ts";

// Strips colour and cursor escapes so the output reads cleanly in the panel.
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

export function createRunView(context: ViewContext, id: string): View {
  let destroyed = false;
  let finished = false;
  const action = findAction(id);

  const root = new BoxRenderable(context.renderer, {
    width: "100%",
    flexDirection: "column",
    backgroundColor: context.colors.panel,
    padding: 1,
    margin: 1,
  });

  const details = new BoxRenderable(context.renderer, {
    title: action ? `Running: ${action.label}` : "Unknown action",
    borderColor: context.colors.muted,
    borderStyle: "rounded",
    marginBottom: 1,
    flexShrink: 0,
    padding: 1,
  });
  const detailsContent = new TextRenderable(context.renderer, {
    content: action ? action.command.join(" ") : `No action with id "${id}".`,
    fg: context.colors.muted,
  });
  details.add(detailsContent);

  const scroll = new ScrollBoxRenderable(context.renderer, {
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    stickyScroll: true,
    stickyStart: "bottom",
    verticalScrollbarOptions: {
      visible: true,
    },
  });
  const output = new TextRenderable(context.renderer, {
    content: "",
    fg: context.colors.foreground,
  });
  scroll.add(output);

  root.add(details);
  root.add(scroll);

  if (action) {
    void execute(action.command);
  }

  async function execute(command: string[]): Promise<void> {
    const startedAt = Date.now();
    let text = "";
    const append = (chunk: string) => {
      text += chunk.replace(ANSI, "").replace(/\r(?!\n)/g, "\n");
      if (!destroyed) output.content = text;
    };

    try {
      const child = Bun.spawn(command, {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...Bun.env, NO_COLOR: "1" },
      });

      // Keep draining both pipes even after the view closes, so a long run
      // (wallset plants for about a minute) never blocks on a full pipe.
      const pump = async (stream: ReadableStream<Uint8Array>) => {
        const decoder = new TextDecoder();
        for await (const chunk of stream) append(decoder.decode(chunk, { stream: true }));
      };
      const [code] = await Promise.all([child.exited, pump(child.stdout), pump(child.stderr)]);

      finished = true;
      if (destroyed) return;
      const took = formatDuration(Date.now() - startedAt);
      details.title = code === 0 ? `✓ Done: ${action!.label} (${took})` : `✗ Failed: ${action!.label} (exit ${code}, ${took})`;
      detailsContent.content = `${command.join(" ")}\n\nc => Check again  ·  ESC => back`;
    } catch (error: unknown) {
      finished = true;
      if (destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      details.title = `✗ Could not start: ${action!.label}`;
      append(`\n${message}\n`);
    }
  }

  return {
    root,
    title: "Run:=> doing it",
    shortcuts: ["↑↓ Scroll", "PgUp/PgDn Scroll", "c => Check", "ESC => back", "q => Quit"],
    onKey(key: string): void {
      if (key === "q") {
        context.exit();
      } else if (key === "c" && finished) {
        // Replace this view instead of stacking on it: going back to a run
        // view would start the command again.
        context.back();
        context.navigate("check");
      } else if (key === "up") {
        scroll.scrollBy({ x: 0, y: -1 }, "step");
      } else if (key === "down") {
        scroll.scrollBy({ x: 0, y: 1 }, "step");
      } else if (key === "pageup") {
        scroll.scrollBy({ x: 0, y: -8 }, "step");
      } else if (key === "pagedown") {
        scroll.scrollBy({ x: 0, y: 8 }, "step");
      }
    },
    destroy(): void {
      destroyed = true;
      root.destroyRecursively();
    },
  };
}
