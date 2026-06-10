import type { Report } from "../reports/ReportWriter.ts";
import { ReportWriter } from "../reports/ReportWriter.ts";
import { BloomPaths } from "../paths/BloomPaths.ts";

export class TemplateRenderer {
  public render(template: string, colors: Record<string, string>): string {
    const missingTokens: string[] = [];

    const output = template.replace(
      /\{\{([a-zA-Z0-9_]+)(?:\|([^}]+))?\}\}/g,
      (_m, key: string, modifier: string | undefined) => {
        const value = colors[key];
        if (value === undefined) {
          missingTokens.push(key);
          return "";
        }
        return modifier !== undefined ? this.applyModifier(value, modifier, key) : value;
      },
    );

    if (missingTokens.length > 0) {
      throw new Error(`Missing template tokens: ${missingTokens.join(", ")}`);
    }

    return output;
  }

  public async renderToCache(
    paths: BloomPaths,
    profile: string,
    target: string,
    dryRun = false,
  ): Promise<{ outputPath: string; reportPath: string }> {
    const templatesDirs = [
      paths.targetTemplatesDir(target),
      paths.repoTargetTemplatesDir(target),
    ];

    let templatePath = "";
    for (const dir of templatesDirs) {
      try {
        for await (const entry of Deno.readDir(dir)) {
          if (entry.isFile) {
            templatePath = `${dir}/${entry.name}`;
            break;
          }
        }
      } catch { /* dir does not exist — try next */ }
      if (templatePath) break;
    }

    if (!templatePath) {
      throw new Error(
        `No template found for target "${target}". Add at least one file to:\n  ${templatesDirs[0]}`,
      );
    }

    const templateText = await Deno.readTextFile(templatePath);

    const sporePath = paths.sporeFile(profile, target);
    let sporeRaw: string;
    try {
      sporeRaw = await Deno.readTextFile(sporePath);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        throw new Error(
          `Cached spore not found:\n  ${sporePath}\n  Run: deno task spore:dev -- sow ${profile} ${target}`,
        );
      }
      throw err;
    }

    let spore: unknown;
    try {
      spore = JSON.parse(sporeRaw);
    } catch {
      throw new Error(`Invalid JSON in spore file:\n  ${sporePath}`);
    }

    const colors: Record<string, string> =
      spore !== null && typeof spore === "object" && "colors" in spore
        ? { ...(spore as { colors: Record<string, string> }).colors }
        : {};

    try {
      const wallpaper = (await Deno.readTextFile(paths.currentWallpaperFile())).trim();
      if (wallpaper) colors["wallpaper"] = wallpaper;
    } catch { /* no wallpaper set yet — skip */ }

    let outputText: string;
    try {
      outputText = this.render(templateText, colors);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${message}\n  Template: ${templatePath}\n  Spore: ${sporePath}`);
    }

    const outputDir = paths.renderedDir(profile, target);
    const outputFileName = templatePath.split("/").pop() ?? `${target}.rendered`;
    const outputPath = `${outputDir}/${outputFileName}`;

    const startedAt = new Date().toISOString();
    const safeTimestamp = startedAt.replace(/[:.]/g, "-");
    const reportPath = `${paths.reportsDir()}/${safeTimestamp}-grow-${profile}-${target}.json`;

    if (!dryRun) {
      await Deno.mkdir(outputDir, { recursive: true });
      await Deno.writeTextFile(outputPath, outputText);

      const recipeField =
        spore !== null && typeof spore === "object" && "recipe" in spore
          ? (spore as { recipe: string }).recipe
          : "(unknown)";

      const writer = new ReportWriter();
      const report: Report = {
        target,
        profile,
        recipe: recipeField,
        status: "ok",
        inputs: { sporePath, templatePath },
        outputs: [outputPath],
        warnings: [],
        errors: [],
        startedAt,
        finishedAt: new Date().toISOString(),
      };
      await writer.write(reportPath, report);
    }

    return { outputPath, reportPath };
  }

  private applyModifier(hex: string, modifier: string, token: string): string {
    if (modifier === "rgb") {
      return this.toCssRgb(hex, token);
    }
    if (modifier === "rgba") {
      return `rgba(${this.normalizeHex(hex, token)}ff)`;
    }
    if (modifier.startsWith("rgba:")) {
      const alpha = modifier.slice(5);
      return this.toCssRgba(hex, alpha, token);
    }
    throw new Error(
      `Unknown modifier "${modifier}" in template token "{{${token}|${modifier}}}"`,
    );
  }

  private toCssRgb(hex: string, token: string): string {
    const clean = this.normalizeHex(hex, token);
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private toCssRgba(hex: string, alpha: string, token: string): string {
    const clean = this.normalizeHex(hex, token);
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const alphaNum = parseFloat(alpha);
    if (isNaN(alphaNum) || alphaNum < 0 || alphaNum > 1) {
      throw new Error(
        `Invalid alpha "${alpha}" in modifier "rgba:${alpha}" for token "${token}" — must be 0.0 to 1.0`,
      );
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private normalizeHex(hex: string, token: string): string {
    const raw = hex.trim().replace(/^#/, "");
    let clean = raw;
    if (raw.length === 3 || raw.length === 4) {
      clean = raw.split("").map((c) => `${c}${c}`).join("").slice(0, 6);
    } else if (raw.length === 8) {
      clean = raw.slice(0, 6);
    }
    if (clean.length !== 6) {
      throw new Error(`Invalid hex color "${hex}" for token "${token}"`);
    }
    return clean;
  }
}
