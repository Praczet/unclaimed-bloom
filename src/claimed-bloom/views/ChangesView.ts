import {
  BoxRenderable,
  fg,
  ScrollBoxRenderable,
  TextRenderable,
  TextTableRenderable,
  type TextChunk,
} from "@opentui/core";

import type { ChoiceDialogItem, View, ViewContext } from "../app/types.ts";
import { ChangesScanner } from "../services/ChangesScanner.ts";
import type { CacheChange, ChangesReport, InstallChange } from "../services/types.ts";

type Where = "dev → config" | "config → cache";

interface ChangeRow {
  where: Where;
  kind: string;
  name: string;
  state: string;
  detail: string;
}

interface ChangeFilter {
  label: string;
  test(row: ChangeRow): boolean;
}

const ALL: ChangeFilter = { label: "All", test: () => true };

export function createChangesView(context: ViewContext): View {
  let destroyed = false;
  let report: ChangesReport | undefined;
  let rows: ChangeRow[] = [];
  let filter = ALL;
  const scanner = new ChangesScanner(context.spore);

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
  const detailsContent = new TextRenderable(context.renderer, {
    content: "Comparing dev, config and cache...",
    fg: context.colors.muted,
    padding: 1,
  });
  details.add(detailsContent);

  const scroll = new ScrollBoxRenderable(context.renderer, {
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    viewportCulling: true,
    verticalScrollbarOptions: {
      visible: true,
    },
  });

  const actionStatus = new TextRenderable(context.renderer, {
    content: "",
    fg: context.colors.muted,
    flexShrink: 0,
  });

  const table = new TextTableRenderable(context.renderer, {
    width: "100%",
    content: [],
    columnWidthMode: "full",
    columnFitter: "proportional",
    cellPaddingX: 1,
    showBorders: true,
    outerBorder: true,
    borderStyle: "single",
    borderColor: context.colors.panelRaised,
    backgroundColor: context.colors.panel,
    fg: context.colors.foreground,
    wrapMode: "word",
  });

  root.add(details);
  scroll.add(table);
  root.add(scroll);
  root.add(actionStatus);

  function render(): void {
    if (!report) return;
    const visible = rows.filter(filter.test);
    const shown = filter === ALL ? `${rows.length}` : `${visible.length} of ${rows.length}, filter: ${filter.label}`;
    details.title = rows.length === 0 ? "Changes (all in place)" : `Changes (${shown})`;
    detailsContent.content = renderDetails(report);
    table.content = visible.length === 0 ? [] : createTableContent(visible, context.colors);
    actionStatus.content = renderNextSteps(report);
  }

  function load(): void {
    details.title = "Loading...";
    void scanner
      .scan()
      .then((loaded) => {
        if (destroyed) return;
        report = loaded;
        rows = toRows(loaded);
        if (!rows.some(filter.test)) filter = ALL;
        render();
      })
      .catch((error: unknown) => {
        if (destroyed) return;
        const message = error instanceof Error ? error.message : String(error);
        detailsContent.content = `Failed to compare files:\n${message}`;
      });
  }

  function openFilterDialog(): void {
    context.openChoiceDialog({
      title: "Filter changes",
      items: filterChoices(rows),
      onSelect: (selected) => {
        filter = selected;
        render();
      },
    });
  }

  load();

  return {
    root,
    title: "Changes:=> what is in dev but not installed, sown, grown or planted",
    shortcuts: ["↑↓ Scroll", "PgUp/PgDn Scroll", "f => Filter", "r => Rescan", "ESC => back", "q => Quit"],
    onKey(key: string): void {
      if (key === "q") {
        context.exit();
      } else if (key === "r") {
        load();
      } else if (key === "f") {
        openFilterDialog();
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

function filterChoices(rows: ChangeRow[]): ChoiceDialogItem<ChangeFilter>[] {
  const count = (test: (row: ChangeRow) => boolean) => rows.filter(test).length;
  const choice = (label: string, test: (row: ChangeRow) => boolean, description: string) => ({
    label: `${label} (${count(test)})`,
    value: { label, test },
    description,
  });
  const distinct = (pick: (row: ChangeRow) => string) => [...new Set(rows.map(pick))].sort();

  return [
    choice("All", ALL.test, "Every change, nothing hidden."),
    choice(
      "Wallpaper",
      (row) => row.kind === "wallpaper" || (row.kind === "stage" && row.where === "config → cache"),
      "Why a new wallpaper did not show up yet:\nmatugen colours newer than the spores,\nand sow/grow/plant runs that are running, failed or out of order.",
    ),
    choice("dev → config", (row) => row.where === "dev → config", "Edited in the repo but not copied by scripts/install."),
    choice("config → cache", (row) => row.where === "config → cache", "Installed, but sow/grow/plant has not run since."),
    ...distinct((row) => row.kind).map((kind) =>
      choice(`Kind: ${kind}`, (row) => row.kind === kind, `Only ${kind} rows.`)
    ),
    ...distinct((row) => row.state).map((state) =>
      choice(`State: ${state}`, (row) => row.state === state, `Only rows that are "${state}".`)
    ),
  ];
}

function renderDetails(report: ChangesReport): string {
  const { wallpaper } = report;
  const sporesBehind = report.cache.find((change) => change.kind === "wallpaper");
  const wallpaperState = wallpaper.planting
    ? "planting now — apps change one by one, slow targets (hyprlock, icons) hold the rest"
    : sporesBehind
      ? "colours are newer than the spores — run sow, grow and plant"
      : wallpaper.plantedAt
        ? `in place, planted ${formatShort(wallpaper.plantedAt)}`
        : "not planted for this profile";

  const lines = [
    `Profile:           ${report.profile ?? "none"}`,
    `Wallpaper:         ${wallpaper.path ? wallpaper.path.split("/").pop() : "unknown"}${wallpaper.pickedAt ? ` (picked ${formatShort(wallpaper.pickedAt)})` : ""}`,
    `Matugen colours:   ${wallpaper.colorsAt ? formatShort(wallpaper.colorsAt) : "no matugen source"}`,
    `Wallpaper state:   ${wallpaperState}`,
    "",
    `Not installed:     ${report.sameDir ? "—" : report.install.length}  (dev → config)`,
    `Not re-run:        ${report.cache.length}  (config → cache)`,
    "",
    `Dev Dir:           ${report.devDir}`,
    `Config Dir:        ${report.configDir}`,
  ];

  if (report.notes.length > 0) {
    lines.push("", ...report.notes.map((note) => `  ! ${note}`));
  }

  return lines.join("\n");
}

function renderNextSteps(report: ChangesReport): string {
  const steps: string[] = [];
  if (report.install.length > 0) steps.push("scripts/install --force");
  for (const stage of ["sow", "grow", "plant"] as const) {
    if (report.cache.some((change) => change.stage === stage && change.state !== "running")) {
      steps.push(`spore ${stage} ${report.profile}`);
    }
  }
  return steps.length > 0 ? `Next: ${steps.join("  →  ")}` : "";
}

const installStates: Record<InstallChange["state"], string> = {
  "modified": "edited in dev",
  "not-installed": "not installed",
  "only-installed": "only in config",
};

function toRows(report: ChangesReport): ChangeRow[] {
  return [
    ...report.install.map((change): ChangeRow => ({
      where: "dev → config",
      kind: change.kind,
      name: change.name,
      state: installStates[change.state],
      detail: change.path,
    })),
    ...report.cache.map((change): ChangeRow => ({
      where: "config → cache",
      kind: change.kind,
      name: change.name,
      state: cacheState(change),
      detail: cacheDetail(change),
    })),
  ];
}

function cacheState(change: CacheChange): string {
  switch (change.state) {
    case "changed-after":
      return change.kind === "stage" ? "out of order" : `changed after ${change.stage}`;
    case "not-run":
      return `never ${pastTense(change.stage)}`;
    case "running":
      return `${change.stage} running`;
    case "failed":
      return `${change.stage} failed`;
    case "other-profile":
      return `${change.stage} ran for other profile`;
  }
}

function cacheDetail(change: CacheChange): string {
  const when = change.state === "running"
    ? `started ${formatShort(change.lastRun!)}, waiting on`
    : change.changedAt
      ? `changed ${formatShort(change.changedAt)}${change.lastRun ? `, ${change.stage} ${formatShort(change.lastRun)}` : ""}`
      : "";
  const targets = change.targets.length > 6
    ? `${change.targets.length} targets`
    : change.targets.join(", ");
  return [when, targets, change.path].filter(Boolean).join("\n");
}

function createTableContent(rows: ChangeRow[], colors: Record<string, string>): TextChunk[][][] {
  const header = ["WHERE", "KIND", "NAME", "STATE", "DETAIL"].map((label) => [
    fg(themeColor(colors, "accent", "#80d9ab"))(label),
  ]);
  const foreground = fg(themeColor(colors, "foreground", "#d9ebe3"));
  const muted = fg(themeColor(colors, "muted", "#8da89e"));

  return [
    header,
    ...rows.map((row) => [
      [muted(row.where)],
      [muted(row.kind)],
      [foreground(row.name)],
      [foreground(row.state)],
      [muted(row.detail)],
    ]),
  ];
}

function pastTense(stage: CacheChange["stage"]): string {
  return { sow: "sown", grow: "grown", plant: "planted" }[stage];
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function themeColor(colors: Record<string, string>, name: string, fallback: string): string {
  return colors[name] ?? fallback;
}
