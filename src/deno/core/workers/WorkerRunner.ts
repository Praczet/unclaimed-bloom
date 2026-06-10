export interface WorkerSpec {
  readonly command: string;
  readonly args: string[];
}

export interface WorkerProgress {
  readonly current: number;
  readonly total: number;
  readonly msg: string;
}

export interface WorkerResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export type ProgressCallback = (progress: WorkerProgress) => void | Promise<void>;

export class WorkerRunner {
  public async run(
    spec: WorkerSpec,
    onProgress?: ProgressCallback,
  ): Promise<WorkerResult> {
    const startMs = Date.now();

    const command = new Deno.Command(spec.command, {
      args: spec.args,
      stdout: "piped",
      stderr: "piped",
    });

    const process = command.spawn();
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    await Promise.all([
      this.collectLines(process.stdout, stdoutLines, async (line) => {
        if (onProgress) {
          const progress = this.parseProgressLine(line);
          if (progress) await onProgress(progress);
        }
      }),
      this.collectLines(process.stderr, stderrLines),
    ]);

    const status = await process.status;

    return {
      ok: status.success,
      exitCode: status.code,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
      durationMs: Date.now() - startMs,
    };
  }

  private async collectLines(
    stream: ReadableStream<Uint8Array>,
    lines: string[],
    onLine?: (line: string) => void | Promise<void>,
  ): Promise<void> {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer) {
          lines.push(buffer);
          await onLine?.(buffer);
        }
        break;
      }
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        lines.push(line);
        await onLine?.(line);
        buffer = buffer.slice(nl + 1);
      }
    }
  }

  public parseProgressLine(line: string): WorkerProgress | null {
    if (!line.startsWith("{")) return null;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const p = obj["progress"];
      if (typeof p !== "object" || p === null) return null;
      const progress = p as Record<string, unknown>;
      if (
        typeof progress["current"] !== "number" ||
        typeof progress["total"] !== "number"
      ) return null;
      return {
        current: progress["current"] as number,
        total: progress["total"] as number,
        msg: typeof progress["msg"] === "string" ? (progress["msg"] as string) : "",
      };
    } catch {
      return null;
    }
  }
}
