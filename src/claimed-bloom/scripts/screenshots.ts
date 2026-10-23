// Renders claimed-bloom screens to SVG for the README, using the selected
// theme and the live spore data on this machine.
//
//   bun run screenshots [name...]     all screens, or only the named ones
//
// Output: docs/images/claimed-bloom-<name>.svg at the repo root. The home
// directory path is left out of the files and drawn as a blurred smudge, so it
// is not readable in the picture or in the SVG source.

import { resolve } from "node:path";
import { BoxRenderable, TextAttributes, type CapturedFrame } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";

import type { AppContext, View, ViewContext } from "../app/types.ts";
import { routeBreadcrumbs, type Route } from "../app/routes.ts";
import { Footer } from "../componenets/Footer.ts";
import { Header } from "../componenets/Header.ts";
import { SporeClient } from "../services/SporeClient.ts";
import { ThemeStore } from "../services/ThemeStore.ts";
import { viewTitle } from "../themes/voice.ts";
import { createCheckView } from "../views/CheckView.ts";
import { createComplainView } from "../views/ComplainView.ts";
import { createCurrentStatusView } from "../views/CurrentStatusView.ts";
import { createDoView } from "../views/DoView.ts";
import { createHomeView } from "../views/HomeView.ts";
import { createMoodsView } from "../views/MoodsView.ts";
import { createProfileDetailView } from "../views/ProfileDetailView.ts";
import { createTargetDetailView } from "../views/TargetDetailView.ts";
import { createThemeView } from "../views/ThemeView.ts";

interface Shot {
  name: string;
  route: Route;
  history: Route[];
  create(context: ViewContext): View;
  keys?: string[];
  // Rows of the virtual terminal; screens with a long header need more.
  height?: number;
}

const SHOTS: Shot[] = [
  { name: "home", route: "home", history: ["home"], create: createHomeView, keys: ["down"] },
  { name: "check", route: "check", history: ["home", "check"], create: createCheckView },
  { name: "do", route: "do", history: ["home", "do"], create: createDoView },
  { name: "current", route: "current", history: ["home", "show", "current"], create: createCurrentStatusView, height: 52 },
  {
    name: "composition",
    route: { name: "profile", id: "desktop-graphite-blooming" },
    history: ["home", "show", "profiles", { name: "profile", id: "desktop-graphite-blooming" }],
    create: (context) => createProfileDetailView(context, "desktop-graphite-blooming"),
  },
  {
    name: "target",
    route: { name: "target", id: "hyprlock" },
    history: ["home", "show", "targets", { name: "target", id: "hyprlock" }],
    create: (context) => createTargetDetailView(context, "hyprlock"),
  },
  { name: "moods", route: "moods", history: ["home", "show", "moods"], create: createMoodsView },
  { name: "theme", route: "theme", history: ["home", "theme"], create: createThemeView, keys: ["down"] },
  { name: "complain", route: "complain", history: ["home", "complain"], create: createComplainView },
];

const WIDTH = 140;
const HEIGHT = 34;
const CELL_W = 8.4;
const CELL_H = 18;
const outDir = resolve(import.meta.dir, "../../../docs/images");

const wanted = Bun.argv.slice(2);
const themes = new ThemeStore();
const theme = await themes.current();

for (const shot of SHOTS.filter((s) => wanted.length === 0 || wanted.includes(s.name))) {
  const setup = await createTestRenderer({ width: WIDTH, height: shot.height ?? HEIGHT });
  const renderer = setup.renderer;
  renderer.setBackgroundColor(theme.colors.background);

  const app: AppContext = {
    renderer,
    colors: { ...theme.colors },
    spore: new SporeClient(),
    themes,
    route: shot.route,
  };
  const context: ViewContext = {
    ...app,
    navigate() {},
    back() {},
    exit() {},
    openChoiceDialog() {},
    closeDialog() {},
    applyTheme: async () => {},
  };

  // Same layout as App: header, body, footer.
  const container = new BoxRenderable(renderer, { width: "100%", height: "100%", flexDirection: "column" });
  const body = new BoxRenderable(renderer, {
    width: "100%",
    flexGrow: 1,
    flexDirection: "column",
    overflow: "hidden",
    paddingLeft: 2,
    paddingRight: 2,
  });
  const header = new Header(app);
  const footer = new Footer(app);
  const view = shot.create(context);

  header.setTitle((typeof shot.route === "string" ? viewTitle(shot.route) : undefined) ?? view.title);
  header.setBreadcrumbs(shot.history.flatMap(routeBreadcrumbs));
  footer.setShortcuts(view.shortcuts ?? []);
  body.add(view.root);
  container.add(header.root);
  container.add(body);
  container.add(footer.root);
  renderer.root.add(container);

  await Bun.sleep(2000);
  await setup.flush();
  for (const key of shot.keys ?? []) {
    view.onKey?.(key);
    await setup.flush();
  }
  await setup.renderOnce();

  const path = resolve(outDir, `claimed-bloom-${shot.name}.svg`);
  await Bun.write(path, toSvg(setup.captureSpans(), theme.colors.background, Bun.env.HOME));
  console.log(`wrote ${path}`);

  view.destroy();
  await setup.dispose();
}
process.exit(0);

function toSvg(frame: CapturedFrame, background: string, redact?: string): string {
  const hex = (rgba: { toInts(): [number, number, number, number] }) => {
    const [r, g, b, a] = rgba.toInts();
    return a === 0 ? undefined : `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  const escape = (text: string) =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const width = Math.ceil(frame.cols * CELL_W);
  const height = frame.rows * CELL_H;
  const rects: string[] = [];
  const texts: string[] = [];

  frame.lines.forEach((line, row) => {
    let col = 0;
    for (const span of line.spans) {
      const x = (col * CELL_W).toFixed(1);
      const y = row * CELL_H;
      const bg = hex(span.bg);
      if (bg && bg !== background) {
        rects.push(`<rect x="${x}" y="${y}" width="${(span.width * CELL_W).toFixed(1)}" height="${CELL_H}" fill="${bg}"/>`);
      }
      const fg = hex(span.fg) ?? "#ffffff";
      const bold = span.attributes & TextAttributes.BOLD ? ' font-weight="bold"' : "";
      const dim = span.attributes & TextAttributes.DIM ? ' opacity="0.6"' : "";
      // Split around the redacted text; each piece keeps its own column.
      const pieces = redact ? span.text.split(redact) : [span.text];
      let offset = col;
      pieces.forEach((piece, index) => {
        if (index > 0) {
          const smudgeX = (offset * CELL_W).toFixed(1);
          rects.push(
            `<rect x="${smudgeX}" y="${y + 4}" width="${(redact!.length * CELL_W).toFixed(1)}" height="${CELL_H - 8}" rx="4" fill="${fg}" opacity="0.45" filter="url(#smudge)"/>`,
          );
          offset += redact!.length;
        }
        if (piece.trim() !== "") {
          texts.push(
            `<text x="${(offset * CELL_W).toFixed(1)}" y="${y + CELL_H - 5}" fill="${fg}"${bold}${dim} textLength="${(piece.length * CELL_W).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${escape(piece)}</text>`,
          );
        }
        offset += piece.length;
      });
      col += span.width;
    }
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><filter id="smudge" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="3"/></filter></defs>`,
    `<rect width="100%" height="100%" rx="8" fill="${background}"/>`,
    ...rects,
    `<g font-family="'JetBrains Mono','DejaVu Sans Mono',Menlo,Consolas,monospace" font-size="14" xml:space="preserve">`,
    ...texts,
    "</g>",
    "</svg>",
    "",
  ].join("\n");
}
