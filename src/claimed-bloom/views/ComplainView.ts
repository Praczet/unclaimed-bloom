import { BoxRenderable, fg, StyledText, TextRenderable, type TextChunk } from "@opentui/core";

import type { View, ViewContext } from "../app/types.ts";
import { QuoteStore, type QuoteBook } from "../services/QuoteStore.ts";
import { complaint } from "../themes/voice.ts";

// Totally useless on purpose: one complaint (or a quote) in the middle of the screen.
export function createComplainView(context: ViewContext): View {
  let destroyed = false;
  let book: QuoteBook = { intros: [], quotes: [] };

  const root = new BoxRenderable(context.renderer, {
    width: "100%",
    flexGrow: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: context.colors.panel,
    margin: 1,
  });

  const box = new BoxRenderable(context.renderer, {
    width: "60%",
    flexDirection: "column",
    padding: 2,
    borderStyle: "rounded",
    borderColor: context.colors.panelRaised,
  });

  const message = new TextRenderable(context.renderer, {
    content: "",
    wrapMode: "word",
  });

  const note = new TextRenderable(context.renderer, {
    content: "",
    fg: context.colors.muted,
    marginTop: 1,
  });

  box.add(message);
  root.add(box);
  root.add(note);

  function next(): void {
    const { intro, text, by } = complaint(book);
    const chunks: TextChunk[] = [];
    if (intro) chunks.push(fg(context.colors.muted)(`${intro}\n\n`));
    const isQuote = intro !== undefined || by !== undefined;
    chunks.push(fg(context.colors.foreground)(isQuote ? `“${text}”` : text));
    if (by) chunks.push(fg(context.colors.accent)(`\n\n— ${by}`));
    message.content = new StyledText(chunks);
  }

  // Quotes are re-read on every visit so edits to quotes.json show up at once.
  void new QuoteStore().load().then((loaded) => {
    if (destroyed) return;
    book = loaded;
    note.content = loaded.problem ?? "";
    next();
  });

  return {
    root,
    title: "Complain:=> the most useful useless screen",
    shortcuts: ["Enter/Space => Another one", "ESC => back", "q => Quit"],
    onKey(key: string): void {
      if (key === "q") {
        context.exit();
      } else if (key === "return" || key === "enter" || key === "space") {
        next();
      }
    },
    destroy(): void {
      destroyed = true;
      root.destroyRecursively();
    },
  };
}
