export interface Report {
  readonly target: string;
  readonly profile: string;
  readonly recipe: string;
  readonly status: "ok" | "error" | "warning";
  readonly inputs: Record<string, unknown>;
  readonly outputs: string[];
  readonly warnings: string[];
  readonly errors: string[];
  readonly startedAt: string;
  readonly finishedAt: string;
}

export class ReportWriter {
  public async write(path: string, report: Report): Promise<void> {
    await this.writeJson(path, report);
  }

  public async writeJson(path: string, data: unknown): Promise<void> {
    await Deno.mkdir(this.dirname(path), { recursive: true });
    await Deno.writeTextFile(path, `${JSON.stringify(data, null, 2)}\n`);
  }

  private dirname(path: string): string {
    const index = path.lastIndexOf("/");
    return index === -1 ? "." : path.slice(0, index);
  }
}
