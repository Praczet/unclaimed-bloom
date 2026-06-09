import type { BloomPaths } from "../paths/BloomPaths.ts";

export interface CopyStep {
  readonly type: "copy";
  readonly dest: string[];
}

export interface ExecStep {
  readonly type: "exec";
  readonly command: string;
  readonly args: string[];
}

export type HookStep = CopyStep | ExecStep;

export interface PlantHook {
  readonly steps: HookStep[];
}

export interface PlantContext {
  readonly rendered: string;
  readonly profile: string;
  readonly target: string;
  readonly recipe: string;
  readonly cacheDir: string;
  readonly dataDir: string;
}

export interface StepResult {
  readonly type: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface PlantResult {
  readonly target: string;
  readonly hookPath: string | null;
  readonly steps: StepResult[];
}

export class HookRunner {
  public async run(
    paths: BloomPaths,
    profile: string,
    target: string,
    dryRun = false,
  ): Promise<PlantResult> {
    const recipe = await this.readRecipeFromSpore(paths.sporeFile(profile, target), target);
    const rendered = await this.findRenderedFile(paths.renderedDir(profile, target), target);
    const hookPath = await this.findHookFile(paths, target);

    if (!hookPath) {
      return { target, hookPath: null, steps: [] };
    }

    const hook = await this.loadHook(hookPath);
    const context: PlantContext = {
      rendered,
      profile,
      target,
      recipe,
      cacheDir: paths.cacheDir,
      dataDir: paths.dataDir,
    };

    const steps: StepResult[] = [];
    for (const step of hook.steps) {
      steps.push(
        dryRun
          ? this.dryRunStep(step, context)
          : await this.executeStep(step, context),
      );
    }

    return { target, hookPath, steps };
  }

  public async loadHook(path: string): Promise<PlantHook> {
    let raw: string;
    try {
      raw = await Deno.readTextFile(path);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        throw new Error(`Hook file not found:\n  ${path}`);
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in hook file:\n  ${path}`);
    }

    return this.validateHook(parsed, path);
  }

  public substitute(template: string, context: PlantContext): string {
    return template
      .replace(/\{\{rendered\}\}/g, context.rendered)
      .replace(/\{\{profile\}\}/g, context.profile)
      .replace(/\{\{target\}\}/g, context.target)
      .replace(/\{\{recipe\}\}/g, context.recipe)
      .replace(/\{\{cache_dir\}\}/g, context.cacheDir)
      .replace(/\{\{data_dir\}\}/g, context.dataDir);
  }

  private async readRecipeFromSpore(sporePath: string, target: string): Promise<string> {
    try {
      const raw = await Deno.readTextFile(sporePath);
      const spore = JSON.parse(raw) as Record<string, unknown>;
      return typeof spore["recipe"] === "string" ? spore["recipe"] : target;
    } catch {
      return target;
    }
  }

  private async findRenderedFile(renderedDir: string, target: string): Promise<string> {
    try {
      for await (const entry of Deno.readDir(renderedDir)) {
        if (entry.isFile) return `${renderedDir}/${entry.name}`;
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        throw new Error(
          `No rendered output for target "${target}".\n  Run: grow <profile> ${target}`,
        );
      }
      throw err;
    }
    throw new Error(
      `Rendered directory is empty for target "${target}".\n  Run: grow <profile> ${target}`,
    );
  }

  private async findHookFile(paths: BloomPaths, target: string): Promise<string | null> {
    const candidates = [
      `${paths.dataDir}/targets/${target}/hooks/plant.json`,
      `${paths.cwd}/targets/${target}/hooks/plant.json`,
    ];
    for (const path of candidates) {
      try {
        await Deno.stat(path);
        return path;
      } catch { /* try next */ }
    }
    return null;
  }

  private validateHook(raw: unknown, path: string): PlantHook {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error(`Hook file must be a JSON object:\n  ${path}`);
    }

    const obj = raw as Record<string, unknown>;
    if (!Array.isArray(obj["steps"])) {
      throw new Error(`Hook file missing "steps" array:\n  ${path}`);
    }

    const steps: HookStep[] = obj["steps"].map((s: unknown, i: number) => {
      if (typeof s !== "object" || s === null) {
        throw new Error(`Step ${i} must be an object in hook file:\n  ${path}`);
      }
      const step = s as Record<string, unknown>;
      const type = step["type"];

      if (type === "copy") {
        if (!Array.isArray(step["dest"]) || step["dest"].some((d) => typeof d !== "string")) {
          throw new Error(`Step ${i} "copy" requires a "dest" string array:\n  ${path}`);
        }
        return { type: "copy", dest: step["dest"] as string[] };
      }

      if (type === "exec") {
        if (typeof step["command"] !== "string") {
          throw new Error(`Step ${i} "exec" requires a "command" string:\n  ${path}`);
        }
        if (!Array.isArray(step["args"]) || step["args"].some((a) => typeof a !== "string")) {
          throw new Error(`Step ${i} "exec" requires an "args" string array:\n  ${path}`);
        }
        return { type: "exec", command: step["command"], args: step["args"] as string[] };
      }

      throw new Error(`Step ${i} has unknown type "${type}" in hook file:\n  ${path}`);
    });

    return { steps };
  }

  private async executeStep(step: HookStep, context: PlantContext): Promise<StepResult> {
    if (step.type === "copy") return await this.executeCopy(step, context);
    if (step.type === "exec") return await this.executeExec(step, context);
    throw new Error(`Unknown hook step type: ${(step as { type: string }).type}`);
  }

  private async executeCopy(step: CopyStep, context: PlantContext): Promise<StepResult> {
    const dests = step.dest.map((d) => this.expandHome(this.substitute(d, context)));
    for (const dest of dests) {
      const dir = dest.slice(0, dest.lastIndexOf("/"));
      if (dir) await Deno.mkdir(dir, { recursive: true });
      await Deno.copyFile(context.rendered, dest);
    }
    return { type: "copy", ok: true, detail: dests.join(", ") };
  }

  private async executeExec(step: ExecStep, context: PlantContext): Promise<StepResult> {
    const command = this.expandHome(this.substitute(step.command, context));
    const args = step.args.map((a) => this.substitute(a, context));
    const result = await new Deno.Command(command, { args, stderr: "piped" }).output();
    if (!result.success) {
      const stderr = new TextDecoder().decode(result.stderr).trim();
      throw new Error(
        `Command failed: ${command} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`,
      );
    }
    return { type: "exec", ok: true, detail: `${command} ${args.join(" ")}` };
  }

  private dryRunStep(step: HookStep, context: PlantContext): StepResult {
    if (step.type === "copy") {
      const dests = step.dest.map((d) => this.expandHome(this.substitute(d, context)));
      return { type: "copy", ok: true, detail: `would copy to: ${dests.join(", ")}` };
    }
    if (step.type === "exec") {
      const command = this.expandHome(this.substitute(step.command, context));
      const args = step.args.map((a) => this.substitute(a, context));
      return { type: "exec", ok: true, detail: `would run: ${command} ${args.join(" ")}` };
    }
    return { type: (step as { type: string }).type, ok: false, detail: "unknown step type" };
  }

  private expandHome(path: string): string {
    return path.replace(/^~(?=\/|$)/, Deno.env.get("HOME") ?? "");
  }
}
