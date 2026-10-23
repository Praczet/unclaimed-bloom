import {
  bg,
  fg,
  ScrollBoxRenderable,
  TextTableRenderable,
  type CliRenderer,
  type TextChunk,
} from "@opentui/core";

import type { ThemeColors } from "../themes/colors.ts";

export interface SelectableRow {
  cells: TextChunk[][];
  // Rows without onSelect are shown but skipped by the cursor.
  onSelect?: () => void;
}

export interface SelectableTable {
  root: ScrollBoxRenderable;
  setRows(header: string[], rows: SelectableRow[]): void;
  // Handles up/down/pageup/pagedown/return; returns true when the key was used.
  onKey(key: string): boolean;
}

// A text table with a highlighted, keyboard-driven row. Rows are one line
// (no wrapping) so the selected row's position is known for scrolling.
export function createSelectableTable(renderer: CliRenderer, colors: ThemeColors): SelectableTable {
  let header: string[] = [];
  let rows: SelectableRow[] = [];
  let selected = -1;

  const root = new ScrollBoxRenderable(renderer, {
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    verticalScrollbarOptions: {
      visible: true,
    },
  });

  const table = new TextTableRenderable(renderer, {
    width: "100%",
    content: [],
    columnWidthMode: "full",
    columnFitter: "proportional",
    cellPaddingX: 1,
    showBorders: true,
    outerBorder: true,
    borderStyle: "single",
    borderColor: colors.panelRaised,
    backgroundColor: colors.panel,
    fg: colors.foreground,
    wrapMode: "none",
  });
  root.add(table);

  const selectable = () => rows.map((row, index) => (row.onSelect ? index : -1)).filter((index) => index >= 0);

  function render(): void {
    const heading = header.map((label, column) => [fg(colors.accent)(column === 0 ? `  ${label}` : label)]);
    table.content = [
      heading,
      ...rows.map((row, index) =>
        row.cells.map((cell, column) => {
          const marker = column === 0 ? [fg(colors.accent)(index === selected ? "❯ " : "  ")] : [];
          const chunks = [...marker, ...cell];
          // The selected row is drawn in full-strength text so dimmed cells stay
          // readable on the highlight; chunks with their own background
          // (colour swatches) keep it.
          return index === selected
            ? chunks.map((chunk) => (chunk.bg ? chunk : bg(colors.panelRaised)(fg(colors.foreground)(chunk))))
            : chunks;
        })
      ),
    ];
  }

  // Top border, header and its separator take three lines; each row then
  // takes one line plus a separator.
  function keepVisible(): void {
    const line = 3 + selected * 2;
    const height = root.height || 10;
    if (line < root.scrollTop) root.scrollTop = Math.max(0, line - 3);
    else if (line >= root.scrollTop + height - 1) root.scrollTop = line - height + 3;
  }

  function move(step: number): void {
    const indexes = selectable();
    if (indexes.length === 0) {
      root.scrollBy({ x: 0, y: step }, "step");
      return;
    }
    const position = indexes.indexOf(selected);
    const next = Math.min(indexes.length - 1, Math.max(0, (position === -1 ? 0 : position) + step));
    selected = indexes[next]!;
    render();
    keepVisible();
  }

  return {
    root,
    setRows(nextHeader, nextRows) {
      header = nextHeader;
      rows = nextRows;
      selected = selectable()[0] ?? -1;
      render();
      root.scrollTop = 0;
    },
    onKey(key) {
      if (key === "up") move(-1);
      else if (key === "down") move(1);
      else if (key === "pageup") move(-8);
      else if (key === "pagedown") move(8);
      else if ((key === "return" || key === "enter") && selected >= 0) rows[selected]?.onSelect?.();
      else return false;
      return true;
    },
  };
}
