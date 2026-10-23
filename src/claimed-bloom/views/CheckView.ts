import {
  BoxRenderable,
  fg,
  ScrollBoxRenderable,
  StyledText,
  TextRenderable,
  type TextChunk,
} from "@opentui/core";

import type { View, ViewContext } from "../app/types.ts";
import { ChangesScanner } from "../services/ChangesScanner.ts";
import type { CacheChange, ChangeKind, ChangesReport, InstallChange } from "../services/types.ts";

type Stage = CacheChange["stage"];

const STAGES: Stage[] = ["sow", "grow", "plant"];

// The first stage that reads a file of this kind; every later stage follows.
const FIRST_STAGE: Record<ChangeKind, Stage> = {
  palette: "sow",
  mood: "sow",
  profile: "sow",
  recipe: "sow",
  target: "sow",
  wallpaper: "sow",
  template: "grow",
  hook: "plant",
  script: "plant",
  stage: "sow",
  other: "plant",
};

const KIND_LABELS: Record<ChangeKind, string> = {
  recipe: "Recipes",
  profile: "Profiles",
  palette: "Palettes",
  mood: "Moods",
  template: "Templates",
  hook: "Hooks",
  script: "Scripts",
  target: "Targets",
  wallpaper: "Wallpaper",
  stage: "Runs",
  other: "Other",
};

const KIND_ORDER = Object.keys(KIND_LABELS) as ChangeKind[];

interface Styles {
  heading(text: string): TextChunk;
  text(text: string): TextChunk;
  muted(text: string): TextChunk;
}

export function createCheckView(context: ViewContext): View {
  let destroyed = false;
  const scanner = new ChangesScanner(context.spore);
  const styles: Styles = {
    heading: fg(context.colors.accent ?? "#80d9ab"),
    text: fg(context.colors.foreground ?? "#d9ebe3"),
    muted: fg(context.colors.muted ?? "#8da89e"),
  };

  const root = new BoxRenderable(context.renderer, {
    width: "100%",
    flexDirection: "column",
    backgroundColor: context.colors.panel,
    padding: 1,
    margin: 1,
  });

  const scroll = new ScrollBoxRenderable(context.renderer, {
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    verticalScrollbarOptions: {
      visible: true,
    },
  });

  const report = new TextRenderable(context.renderer, {
    content: "Checking what the current theme uses...",
    fg: context.colors.muted,
    padding: 1,
  });

  scroll.add(report);
  root.add(scroll);

  function load(): void {
    report.content = "Checking what the current theme uses...";
    void scanner
      .scan()
      .then((loaded) => {
        if (destroyed) return;
        report.content = new StyledText(renderReport(loaded, styles));
      })
      .catch((error: unknown) => {
        if (destroyed) return;
        const message = error instanceof Error ? error.message : String(error);
        report.content = `Check failed:\n${message}`;
      });
  }

  load();

  return {
    root,
    title: "Check:=> is everything the current theme uses installed and applied?",
    shortcuts: ["↑↓ Scroll", "PgUp/PgDn Scroll", "r => Recheck", "ESC => back", "q => Quit"],
    onKey(key: string): void {
      if (key === "q") {
        context.exit();
      } else if (key === "r") {
        load();
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

export function renderReport(report: ChangesReport, s: Styles): TextChunk[] {
  const out: TextChunk[] = [];
  const line = (...chunks: TextChunk[]) => out.push(...chunks, s.text("\n"));

  const inUse = report.install.filter((change) => change.usedBy.length > 0 && change.state !== "only-installed");
  const other = report.install.filter((change) => !inUse.includes(change));
  const running = report.cache.filter((change) => change.state === "running");
  const notApplied = report.cache.filter((change) => change.state !== "running");

  line(s.muted(`Profile ${report.profile ?? "none"}  ·  dev ${report.devDir}  ·  config ${report.configDir}`));
  for (const note of report.notes) line(s.muted(`! ${note}`));
  line();

  // In use ---------------------------------------------------------------
  if (inUse.length === 0 && report.cache.length === 0) {
    line(s.heading("✓ Everything the current theme uses is installed and applied."));
  } else {
    line(s.heading("✗ Outdated and in use by the current theme"));
    line();

    if (inUse.length > 0) {
      line(s.text("  Edited in dev, config still has the old copy"));
      for (const [kind, changes] of groupByKind(inUse)) {
        line(s.text(`    ${KIND_LABELS[kind].padEnd(10)}`), s.text(changes.map((change) => change.name).join(", ")));
        const targets = unique(changes.flatMap((change) => change.usedBy));
        line(s.muted(`    ${"".padEnd(10)}${changes.some((c) => c.state === "not-installed") ? "not installed yet · " : ""}used by ${formatTargets(targets)}`));
      }
      line();
    }

    if (notApplied.length > 0) {
      line(s.text("  Installed, but not applied yet"));
      for (const [kind, changes] of groupByKind(notApplied)) {
        const names = changes.map((change) => kind === "stage" ? describeStage(change) : change.name);
        line(s.text(`    ${KIND_LABELS[kind].padEnd(10)}`), s.text(names.join(", ")));
        if (kind !== "stage") {
          const stages = unique(changes.map((change) => change.stage));
          line(s.muted(`    ${"".padEnd(10)}changed after last ${stages.join("/")} · used by ${formatTargets(unique(changes.flatMap((c) => c.targets)))}`));
        }
      }
      line();
    }

    for (const change of running) {
      line(s.text(`  ${change.stage} is running now`), s.muted(` — still waiting on ${formatTargets(change.targets)}`));
      line();
    }
  }

  // Not in use -----------------------------------------------------------
  line();
  if (other.length === 0) {
    line(s.heading("✓ Nothing else is outdated."));
  } else {
    line(s.heading("Other outdated (not used by the current theme)"));
    line();
    for (const [kind, changes] of groupByKind(other)) {
      line(s.text(`    ${KIND_LABELS[kind].padEnd(10)}`), s.text(changes.map((change) => `${change.name}${stateSuffix(change)}`).join(", ")));
    }
  }

  // Actions --------------------------------------------------------------
  line();
  line();
  line(s.heading("What to do"));
  line();
  for (const [index, step] of actions(report, inUse, other, notApplied, running).entries()) {
    line(s.text(`  ${index + 1}. ${step.command}`));
    line(s.muted(`     ${step.why}`));
  }

  return out;
}

interface Action {
  command: string;
  why: string;
}

function actions(
  report: ChangesReport,
  inUse: InstallChange[],
  other: InstallChange[],
  notApplied: CacheChange[],
  running: CacheChange[],
): Action[] {
  const steps: Action[] = [];
  const profile = report.profile ?? "<profile>";
  const removed = report.install.filter((change) => change.state === "only-installed");

  if (running.length > 0) {
    steps.push({
      command: `wait for ${running.map((change) => change.stage).join(", ")} to finish`,
      why: "Apps change one by one while planting; slow targets (hyprlock, icons) hold back the rest. Press r to check again.",
    });
  }

  const outdated = [...inUse, ...other].filter((change) => change.state !== "only-installed");
  const themeFiles = outdated.filter((change) => change.kind !== "script");
  const scripts = outdated.filter((change) => change.kind === "script");
  const scriptsInUse = scripts.filter((change) => change.usedBy.length > 0);
  const firstFix = steps.length + 1;

  if (themeFiles.length > 0) {
    const inUseTheme = inUse.filter((change) => change.kind !== "script").length;
    steps.push({
      command: "spore sync",
      why: inUseTheme > 0
        ? `Copies the ${inUseTheme} in-use file(s) above (and ${themeFiles.length - inUseTheme} other) from dev into config.`
        : `Optional: only theme files the current theme does not use are outdated (${themeFiles.length} to copy).`,
    });
  }

  if (scriptsInUse.length > 0) {
    steps.push({
      command: "spore sync scripts",
      why: `Hooks of the current theme call ${scriptsInUse.map((change) => change.name).join(", ")}.`,
    });
  }

  const first = earliestStage([
    ...inUse.map((change) => FIRST_STAGE[change.kind]),
    ...notApplied.map((change) => change.kind === "stage" ? change.stage : FIRST_STAGE[change.kind] === "sow" ? "sow" : change.stage),
  ]);

  if (first) {
    for (const stage of STAGES.slice(STAGES.indexOf(first))) {
      steps.push({ command: `spore ${stage} ${profile}`, why: stageReason(stage, first) });
    }
    steps.push({
      command: `or, instead of steps ${firstFix}–${steps.length}: spore sync${scriptsInUse.length > 0 ? " scripts" : ""} --apply`,
      why: "Copies from dev, then reruns wallset with the current wallpaper (matugen, sow, grow, plant) in one go." +
        (scriptsInUse.length > 0 && themeFiles.length > 0 ? " Run spore sync first for the theme files." : ""),
    });
  }

  if (scripts.length > 0 && scriptsInUse.length === 0) {
    steps.push({
      command: "spore sync scripts",
      why: `Optional: no hook of the current theme calls ${scripts.map((change) => change.name).join(", ")}.`,
    });
  }

  const configOnly = removed.filter((change) => change.kind !== "script");
  if (configOnly.length > 0) {
    steps.push({
      command: "spore sync --prune",
      why: `Optional: deletes ${configOnly.length} file(s) that exist only in config: ${configOnly.map((change) => change.path).join(", ")}.`,
    });
  }

  if (steps.length === 0) {
    steps.push({ command: "nothing", why: "Dev, config and the applied theme all agree." });
  }

  return steps;
}

function stageReason(stage: Stage, first: Stage): string {
  const reasons: Record<Stage, string> = {
    sow: "Recomputes the bloom and spores from the installed profile, palette, mood, recipes and wallpaper colours.",
    grow: first === "grow"
      ? "Renders the changed templates with the current spores."
      : "Renders the new spores into the app config files.",
    plant: "Copies the rendered files into place and reloads the apps (hooks).",
  };
  return reasons[stage];
}

function earliestStage(stages: Stage[]): Stage | undefined {
  return STAGES.find((stage) => stages.includes(stage));
}

function describeStage(change: CacheChange): string {
  switch (change.state) {
    case "not-run":
      return `${change.stage} never ran`;
    case "failed":
      return `${change.stage} failed${change.targets.length > 0 ? ` (${formatTargets(change.targets)})` : ""}`;
    case "other-profile":
      return `last ${change.name.replace(" (", " ran for ").replace(")", "")}`;
    default:
      return change.name;
  }
}

function stateSuffix(change: InstallChange): string {
  if (change.state === "not-installed") return " (not installed)";
  if (change.state === "only-installed") return " (only in config)";
  return "";
}

function groupByKind<T extends { kind: ChangeKind }>(changes: T[]): Array<[ChangeKind, T[]]> {
  const groups = new Map<ChangeKind, T[]>();
  for (const change of changes) {
    groups.set(change.kind, [...(groups.get(change.kind) ?? []), change]);
  }
  return [...groups.entries()].sort(([a], [b]) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
}

function formatTargets(targets: string[]): string {
  if (targets.length === 0) return "—";
  return targets.length > 8 ? `${targets.length} targets` : [...targets].sort().join(", ");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
