import { BoxRenderable, TextRenderable, createCliRenderer } from "@opentui/core";
import type { ThemeColors } from "./themes/colors";

import { App } from "./app/App";

new App().start();

// const colors = ThemeColors;
//
// const renderer = await createCliRenderer({
//   exitOnCtrlC: true,
//   backgroundColor: colors.backgroundColor,
// });
//
// const panel = new BoxRenderable(renderer, {
//   width: "100%",
//   height: "100%",
//   padding: 2,
//   flexDirection: "column",
//   gap: 1,
// });
//
// const header = new TextRenderable(renderer, {
//   content: "  CLAIMED BLOOM",
//   fg: colors.green,
// });
//
// const description = new TextRenderable(renderer, {
//   content: "The garden is yours to understand.",
//   fg: colors.muted,
// });
//
// const body = new BoxRenderable(renderer, {
//   backgroundColor: colors.panel,
//   padding: 2,
//   flexDirection: "column",
//   gap: 1,
//   marginTop: 1,
// });
//
// const sections = ["Show...", "Check...", "Do...", "Complain..."];
//
// let selected = 0;
//
// const menu = new TextRenderable(renderer, {
//   content: "",
//   fg: colors.foreground,
// });
//
// const status = new TextRenderable(renderer, {
//   content: "",
//   fg: colors.green,
// });
//
// function update() {
//   menu.content = sections
//     .map((name, index) => (index === selected ? `❯ ${name}` : `  ${name}`))
//     .join("\n");
//
//   status.content = `Selected: ${sections[selected]}`;
// }
//
// function selectSection(index: number) {
//   selected = index;
//   update();
// }
//
// body.add(menu);
// panel.add(header);
// panel.add(description);
// panel.add(body);
// panel.add(status);
//
// panel.add(
//   new TextRenderable(renderer, {
//     content: "↑↓ Navigate  •  Enter Select  •  q Quit",
//     fg: colors.muted,
//   }),
// );
//
// renderer.root.add(panel);
//
// update();
//
// renderer.keyInput.on("keypress", (key) => {
//   if (key.name === "q" || key.name === "escape") {
//     renderer.destroy();
//     return;
//   }
//
//   if (key.name === "up") {
//     selected = (selected - 1 + sections.length) % sections.length;
//   } else if (key.name === "down") {
//     selected = (selected + 1) % sections.length;
//   } else if (key.name === "return" || key.name === "enter") {
//     selectSection(selected);
//     return;
//   } else {
//     return;
//   }
//
//   update();
// });

