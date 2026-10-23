import { DEV_DIR } from "./ChangesScanner.ts";
import type { ChangesReport } from "./types.ts";

export interface Action {
  id: string;
  label: string;
  command: string[];
  description: string;
  // Shown in a confirmation dialog before running; set for actions that delete.
  confirm?: string;
}

const THEME_KINDS = ["palettes", "moods", "profiles", "recipes", "templates", "hooks"] as const;

export const ACTIONS: Action[] = [
  {
    id: "sync-apply",
    label: "spore sync --apply",
    command: ["spore", "sync", "--apply"],
    description:
      "Copy changed palettes, moods, profiles, recipes, templates and hooks from dev into config, " +
      "then rerun wallset with the current wallpaper (matugen → sow → grow → plant).\n\n" +
      "Takes about a minute; hyprlock and icons are the slow ones.",
  },
  {
    id: "sync",
    label: "spore sync",
    command: ["spore", "sync"],
    description:
      "Copy changed palettes, moods, profiles, recipes, templates and hooks from dev into config.\n\n" +
      "Scripts are left alone. Nothing is re-applied; run spore sync --apply for that.",
  },
  {
    id: "sync-dry-run",
    label: "spore sync --dry-run",
    command: ["spore", "sync", "--dry-run"],
    description: "Show what spore sync would copy, without copying anything.",
  },
  ...THEME_KINDS.map((kind): Action => ({
    id: `sync-${kind}`,
    label: `spore sync ${kind}`,
    command: ["spore", "sync", kind],
    description: `Copy only changed ${kind} from dev into config.`,
  })),
  {
    id: "sync-scripts",
    label: "spore sync scripts",
    command: ["spore", "sync", "scripts"],
    description:
      "Copy changed scripts from dev into config.\n\n" +
      "Hooks call these as {{data_dir}}/scripts/…; the wallset and spore launchers run the repo copies instead.",
  },
  {
    id: "sync-scripts-apply",
    label: "spore sync scripts --apply",
    command: ["spore", "sync", "scripts", "--apply"],
    description: "Copy changed scripts, then rerun wallset with the current wallpaper so hooks use them.",
  },
  {
    id: "sync-prune",
    label: "spore sync --prune",
    command: ["spore", "sync", "--prune"],
    description:
      "Copy changed theme files and delete theme files that exist only in config " +
      "(retired targets, recipes removed in dev).",
    confirm: "Delete every palette, mood, profile, recipe, template and hook that exists only in config?",
  },
  {
    id: "install-force",
    label: "scripts/install --force",
    command: [`${DEV_DIR}/scripts/install`, "--force"],
    description:
      "Full reinstall: deletes and re-copies palettes, moods, profiles, targets and scripts, " +
      "and rewrites the spore, wallset and workbench launchers and zsh completions.\n\n" +
      "Copies keep their dev timestamps, so Check may miss edits made before the last sow. " +
      "Prefer spore sync unless the launchers changed.",
    confirm: "Delete and re-copy all installed data folders and rewrite the launchers?",
  },
];

export function findAction(id: string): Action | undefined {
  return ACTIONS.find((action) => action.id === id);
}

export interface Suggestion {
  action?: Action;
  why: string;
}

export function suggestAction(report: ChangesReport): Suggestion {
  const isTheme = (kind: string) => kind !== "script" && kind !== "other";
  const outdated = report.install.filter((change) => change.state !== "only-installed");
  const inUse = outdated.filter((change) => change.usedBy.length > 0);
  const notApplied = report.cache.filter((change) => change.state !== "running");
  const running = report.cache.filter((change) => change.state === "running");
  const names = (changes: { name: string }[]) => changes.map((change) => change.name).join(", ");

  if (running.length > 0) {
    return {
      why: `${running.map((change) => change.stage).join(", ")} is running now. Wait for it to finish, then check again.`,
    };
  }

  if (inUse.some((change) => !isTheme(change.kind))) {
    return {
      action: findAction("sync-scripts-apply"),
      why: `Scripts used by hooks of the current theme are outdated: ${names(inUse.filter((c) => !isTheme(c.kind)))}.`,
    };
  }

  if (inUse.length > 0 || notApplied.length > 0) {
    const parts = [
      inUse.length > 0 ? `in use but not installed: ${names(inUse)}` : "",
      notApplied.length > 0 ? `installed but not applied: ${names(notApplied)}` : "",
    ].filter(Boolean);
    return { action: findAction("sync-apply"), why: `The current theme is outdated — ${parts.join("; ")}.` };
  }

  const theme = outdated.filter((change) => isTheme(change.kind));
  if (theme.length > 0) {
    return {
      action: findAction("sync"),
      why: `Theme files not used by the current theme are outdated: ${names(theme)}. Nothing needs re-applying.`,
    };
  }

  const scripts = outdated.filter((change) => change.kind === "script");
  if (scripts.length > 0) {
    return {
      action: findAction("sync-scripts"),
      why: `Only scripts are outdated: ${names(scripts)}. No hook of the current theme uses them.`,
    };
  }

  const configOnly = report.install.filter((change) =>
    change.state === "only-installed" && isTheme(change.kind)
  );
  if (configOnly.length > 0) {
    return {
      action: findAction("sync-prune"),
      why: `Only leftovers: ${names(configOnly)} exist in config but not in dev.`,
    };
  }

  return { why: "Dev, config and the applied theme all agree. Nothing to do." };
}
