import { BoxRenderable, TextRenderable, type CliRenderer } from "@opentui/core";

import type { ChoiceDialogOptions, Dialog } from "../app/types.ts";

export function createChoiceDialog<T>(
  renderer: CliRenderer,
  colors: Record<string, string>,
  options: ChoiceDialogOptions<T>,
  onClose: () => void,
): Dialog {
  let selected = 0;
  let destroyed = false;

  /*
   * Full-screen transparent layout container.
   * It centers the actual dialog panel.
   */
  const root = new BoxRenderable(renderer, {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  });

  const panel = new BoxRenderable(renderer, {
    width: options.width ?? "70%",
    height: options.height ?? "70%",
    flexDirection: "column",
    backgroundColor: colors.panel,
    border: true,
    borderStyle: "rounded",
    borderColor: colors.panelRised,
    title: ` ${options.title} `,
    titleColor: colors.green,
    bottomTitle: " ↑↓ Navigate • Enter Select • Esc Close ",
    bottomTitleAlignment: "center",
    padding: 1,
  });

  const content = new BoxRenderable(renderer, {
    width: "100%",
    flexGrow: 1,
    flexDirection: "row",
    overflow: "hidden",
  });

  const choicesBox = new BoxRenderable(renderer, {
    width: "40%",
    height: "100%",
    flexDirection: "column",
    paddingRight: 1,
  });

  const descriptionBox = new BoxRenderable(renderer, {
    width: "60%",
    height: "100%",
    flexDirection: "column",
    paddingLeft: 1,
    border: ["left"],
    borderColor: colors.panelRised,
  });

  const choices = new TextRenderable(renderer, {
    content: "",
    fg: colors.foreground,
  });

  const description = new TextRenderable(renderer, {
    content: "",
    fg: colors.muted,
  });

  function update(): void {
    if (options.items.length === 0) {
      choices.content = "No choices found.";
      description.content = "";
      return;
    }

    choices.content = options.items
      .map((item, index) => {
        return index === selected ? `❯ ${item.label}` : `  ${item.label}`;
      })
      .join("\n");

    description.content = options.items[selected]?.description ?? "";
  }

  function moveSelection(direction: number): void {
    if (options.items.length === 0) {
      return;
    }

    selected = (selected + direction + options.items.length) % options.items.length;

    update();
  }

  function selectCurrent(): void {
    const item = options.items[selected];

    if (!item) {
      return;
    }

    /*
     * Close before running the action. The action may navigate and create
     * another view, so the old dialog should already be out of the way.
     */
    onClose();
    options.onSelect(item.value);
  }

  choicesBox.add(choices);
  descriptionBox.add(description);

  content.add(choicesBox);
  content.add(descriptionBox);

  panel.add(content);
  root.add(panel);

  update();

  return {
    root,

    onKey(key: string): void {
      switch (key) {
        case "up":
          moveSelection(-1);
          break;

        case "down":
          moveSelection(1);
          break;

        case "return":
        case "enter":
          selectCurrent();
          break;

        case "escape":
        case "q":
          onClose();
          break;
      }
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      root.destroyRecursively();
    },
  };
}
