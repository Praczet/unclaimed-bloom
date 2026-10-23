import { BoxRenderable, StyledText, TextRenderable } from "@opentui/core";

import type { ViewContext } from "../app/types.ts";
import { createSelectableTable, type SelectableTable } from "./SelectableTable.ts";

export interface DetailLayout {
  root: BoxRenderable;
  table: SelectableTable;
  setTitle(title: string): void;
  setInfo(content: string | StyledText): void;
  setFooter(content: string): void;
}

// Info box on top, selectable table below, one status line at the bottom:
// the shape every Show detail screen shares.
export function createDetailLayout(context: ViewContext): DetailLayout {
  const root = new BoxRenderable(context.renderer, {
    width: "100%",
    flexDirection: "column",
    backgroundColor: context.colors.panel,
    padding: 1,
    margin: 1,
  });

  const details = new BoxRenderable(context.renderer, {
    title: "Loading...",
    borderColor: context.colors.muted,
    borderStyle: "rounded",
    marginBottom: 1,
    flexShrink: 0,
    padding: 1,
  });
  const info = new TextRenderable(context.renderer, {
    content: "Loading...",
    fg: context.colors.foreground,
  });
  details.add(info);

  const table = createSelectableTable(context.renderer, context.colors);
  const footer = new TextRenderable(context.renderer, {
    content: "",
    fg: context.colors.muted,
    flexShrink: 0,
  });

  root.add(details);
  root.add(table.root);
  root.add(footer);

  return {
    root,
    table,
    setTitle: (title) => (details.title = title),
    setInfo: (content) => (info.content = trimTrailingNewline(content)),
    setFooter: (content) => (footer.content = content),
  };
}

// Info blocks are built line by line ending in "\n"; the last one would leave
// an empty line that the table below needs on small terminals.
function trimTrailingNewline(content: string | StyledText): string | StyledText {
  if (typeof content === "string") return content.replace(/\n+$/, "");
  const chunks = [...content.chunks];
  while (chunks.length > 0 && /^\n*$/.test(chunks[chunks.length - 1]!.text)) chunks.pop();
  const last = chunks[chunks.length - 1];
  if (last) chunks[chunks.length - 1] = { ...last, text: last.text.replace(/\n+$/, "") };
  return new StyledText(chunks);
}
