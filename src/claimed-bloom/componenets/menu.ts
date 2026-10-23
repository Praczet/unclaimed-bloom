import { BoxRenderable, TextRenderable, type CliRenderer } from "@opentui/core";
import type { MenuItem, View, ViewContext } from "../app/types";

export function createMenuView(
  renderer: CliRenderer,
  context: ViewContext,
  title: string,
  items: MenuItem[],
  shortcuts: string[] = ["↑↓ Navigate", "Enter Select", "ESC or q => Quit"],
): View {
  let selected = 0;
  let menuItems = [...items];

  let message: string | null = null;
  let disposed = false;

  const root = new BoxRenderable(renderer, {
    width: "100%",
    flexDirection: "row",
    backgroundColor: context.colors.panel,
    margin: 1,
  });

  const menuBox = new BoxRenderable(renderer, {
    width: "100%",
    flexDirection: "column",
    padding: 1,
    // No flexGrow
  });
  const descriptionBox = new BoxRenderable(renderer, {
    width: "100%",
    flexDirection: "column",
    padding: 1,
    borderColor: context.colors.panelRised,
    borderStyle: "rounded",
    // No flexGrow
  });

  const menu = new TextRenderable(renderer, {
    content: "",
  });
  const description = new TextRenderable(renderer, {
    content: menuItems[selected]?.description || "",
  });

  function update(): void {
    menu.content = menuItems
      .map((item, index) => (index === selected ? `❯ ${item.label}` : `  ${item.label}`))
      .join("\n");
    description.content = menuItems[selected]?.description || "";
  }

  menuBox.add(menu);
  descriptionBox.add(description);
  root.add(menuBox);
  root.add(descriptionBox);
  update();

  return {
    root,
    title,
    shortcuts,
    onKey(key) {
      if (key === "q") {
        context.exit();
        return;
      }
      if (key === "up") {
        selected = (selected - 1 + menuItems.length) % menuItems.length;
      } else if (key === "down") {
        selected = (selected + 1) % menuItems.length;
      } else if ((key === "return" || key === "enter") && menuItems[selected] !== undefined) {
        const item = menuItems[selected]!;
        if (item.onSelect) {
          item.onSelect();
          return;
        } else {
          context.navigate(item.route!);
        }
        return;
      } else {
        return;
      }

      update();
    },

    setItems(items: MenuItem[]) {
      menuItems = [...items];
      selected = 0;
      update();
    },
    setMessage(message: string) {
      menu.content = message;
      description.content = "";
    },

    destroy() {
      disposed = true;
      root.destroyRecursively();
    },
  };
}
