# Workbench

A browser view of profiles, blooms and recipes.

```bash
unclaimed-bloom          # installed launcher
scripts/unclaimed-bloom  # or from the repo
```

It serves on `http://127.0.0.1:7865` and opens it in the browser. If a workbench
is already running, the launcher opens the existing one instead of starting a
second server and losing a small argument with the port.

```bash
UB_WORKBENCH_PORT=7866 unclaimed-bloom   # another port
UB_OPEN_BROWSER=0 unclaimed-bloom        # do not open a browser
```

The log goes to `~/.cache/unclaimed-bloom/workbench.log`.

The workbench shows:

- a profile and target sidebar with current/active markers,
- an overview with profile composition, target status and per-target actions,
- a bloom preview: palette → source/mood → bloom,
- a target inspector: base/bloom/source/mix/result per token,
- a read-only Recipe Workshop scoped to the selected profile and target,
- `sow` and `grow` buttons for all targets or one, with the equivalent CLI command,
- a docs/help view with the README and generated live help.

Recipes are narrowed to the selected target (`profile → target → recipe`). The
profile-assigned recipe is active; other recipes for that target are listed as
available but are not real previews yet.

Build and start it from the repo:

```bash
deno task workbench
```

> [!NOTE]
> `src/deno/server/workbench.ts` does not type-check since derived recipe tokens
> (`{ "token": …, "tint": … }`) arrived; it still runs, because `deno run` does
> not type-check. claimed-bloom covers most of the same ground in the terminal.
