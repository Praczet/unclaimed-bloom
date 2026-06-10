export type StageStatus = "pending" | "running" | "done" | "error" | "skipped";
export type RunStatus = "running" | "done" | "error";

export interface WorkerProgress {
  readonly current: number;
  readonly total: number;
  readonly pct: number;
  readonly msg?: string;
}

export interface TargetState {
  readonly status: StageStatus;
  readonly duration_ms?: number;
  readonly worker?: WorkerProgress;
}

export interface RunState {
  readonly run_id: string;
  readonly profile: string;
  readonly stage: string;
  readonly status: RunStatus;
  readonly started_at: string;
  readonly updated_at: string;
  readonly targets: Record<string, TargetState>;
}

export type UBEvent =
  | {
    type: "run:start";
    run_id: string;
    profile: string;
    stage: string;
    targets: string[];
    ts: string;
  }
  | {
    type: "run:done";
    run_id: string;
    profile: string;
    stage: string;
    duration_ms: number;
    ts: string;
  }
  | {
    type: "run:error";
    run_id: string;
    profile: string;
    stage: string;
    error: string;
    ts: string;
  }
  | {
    type: "target:start";
    run_id: string;
    stage: string;
    target: string;
    ts: string;
  }
  | {
    type: "target:done";
    run_id: string;
    stage: string;
    target: string;
    duration_ms: number;
    ts: string;
  }
  | {
    type: "target:error";
    run_id: string;
    stage: string;
    target: string;
    error: string;
    ts: string;
  }
  | {
    type: "target:skip";
    run_id: string;
    stage: string;
    target: string;
    reason: string;
    ts: string;
  }
  | {
    type: "worker:start";
    run_id: string;
    target: string;
    worker: string;
    ts: string;
  }
  | {
    type: "worker:progress";
    run_id: string;
    target: string;
    worker: string;
    current: number;
    total: number;
    msg: string;
    ts: string;
  }
  | {
    type: "worker:done";
    run_id: string;
    target: string;
    worker: string;
    current: number;
    total: number;
    duration_ms: number;
    ts: string;
  }
  | {
    type: "worker:error";
    run_id: string;
    target: string;
    worker: string;
    error: string;
    ts: string;
  };

export class EventEmitter {
  private state: RunState;
  private startMs: number;
  private targetStartMs: Map<string, number>;

  public constructor(
    private readonly eventsFile: string,
    private readonly stateFile: string,
  ) {
    this.state = this.emptyState();
    this.startMs = 0;
    this.targetStartMs = new Map();
  }

  public async startRun(
    profile: string,
    stage: string,
    targets: string[],
  ): Promise<void> {
    const ts = new Date().toISOString();
    this.startMs = Date.now();
    this.targetStartMs = new Map();
    this.state = {
      run_id: this.generateId(),
      profile,
      stage,
      status: "running",
      started_at: ts,
      updated_at: ts,
      targets: Object.fromEntries(
        targets.map((t) => [t, { status: "pending" as StageStatus }]),
      ),
    };
    await this.appendEvent({
      type: "run:start",
      run_id: this.state.run_id,
      profile,
      stage,
      targets,
      ts,
    });
    await this.writeState();
  }

  public async startTarget(target: string): Promise<void> {
    this.targetStartMs.set(target, Date.now());
    const ts = new Date().toISOString();
    this.state = this.withTarget(target, { status: "running" }, ts);
    await this.appendEvent({
      type: "target:start",
      run_id: this.state.run_id,
      stage: this.state.stage,
      target,
      ts,
    });
    await this.writeState();
  }

  public async doneTarget(target: string): Promise<void> {
    const duration_ms = Date.now() - (this.targetStartMs.get(target) ?? Date.now());
    const ts = new Date().toISOString();
    this.state = this.withTarget(target, { status: "done", duration_ms }, ts);
    await this.appendEvent({
      type: "target:done",
      run_id: this.state.run_id,
      stage: this.state.stage,
      target,
      duration_ms,
      ts,
    });
    await this.writeState();
  }

  public async errorTarget(target: string, error: string): Promise<void> {
    const ts = new Date().toISOString();
    this.state = this.withTarget(target, { status: "error" }, ts);
    await this.appendEvent({
      type: "target:error",
      run_id: this.state.run_id,
      stage: this.state.stage,
      target,
      error,
      ts,
    });
    await this.writeState();
  }

  public async skipTarget(target: string, reason: string): Promise<void> {
    const ts = new Date().toISOString();
    this.state = this.withTarget(target, { status: "skipped" }, ts);
    await this.appendEvent({
      type: "target:skip",
      run_id: this.state.run_id,
      stage: this.state.stage,
      target,
      reason,
      ts,
    });
    await this.writeState();
  }

  public async startWorker(target: string, worker: string): Promise<void> {
    const ts = new Date().toISOString();
    const existing = this.state.targets[target] ?? { status: "running" as StageStatus };
    this.state = this.withTarget(
      target,
      { ...existing, worker: { current: 0, total: 0, pct: 0 } },
      ts,
    );
    await this.appendEvent({
      type: "worker:start",
      run_id: this.state.run_id,
      target,
      worker,
      ts,
    });
    await this.writeState();
  }

  public async progressWorker(
    target: string,
    worker: string,
    current: number,
    total: number,
    msg: string,
  ): Promise<void> {
    const ts = new Date().toISOString();
    const pct = total > 0 ? current / total : 0;
    const existing = this.state.targets[target] ?? { status: "running" as StageStatus };
    this.state = this.withTarget(
      target,
      { ...existing, worker: { current, total, pct, msg } },
      ts,
    );
    await this.appendEvent({
      type: "worker:progress",
      run_id: this.state.run_id,
      target,
      worker,
      current,
      total,
      msg,
      ts,
    });
    await this.writeState();
  }

  public async doneWorker(
    target: string,
    worker: string,
    current: number,
    total: number,
  ): Promise<void> {
    const duration_ms = Date.now() - (this.targetStartMs.get(target) ?? Date.now());
    const ts = new Date().toISOString();
    const existing = this.state.targets[target] ?? { status: "running" as StageStatus };
    this.state = this.withTarget(
      target,
      { ...existing, worker: { current, total, pct: 1 } },
      ts,
    );
    await this.appendEvent({
      type: "worker:done",
      run_id: this.state.run_id,
      target,
      worker,
      current,
      total,
      duration_ms,
      ts,
    });
    await this.writeState();
  }

  public async errorWorker(
    target: string,
    worker: string,
    error: string,
  ): Promise<void> {
    const ts = new Date().toISOString();
    await this.appendEvent({
      type: "worker:error",
      run_id: this.state.run_id,
      target,
      worker,
      error,
      ts,
    });
    await this.writeState();
  }

  public async finishRun(): Promise<void> {
    const duration_ms = Date.now() - this.startMs;
    const ts = new Date().toISOString();
    this.state = {
      ...this.state,
      status: "done",
      updated_at: ts,
    };
    await this.appendEvent({
      type: "run:done",
      run_id: this.state.run_id,
      profile: this.state.profile,
      stage: this.state.stage,
      duration_ms,
      ts,
    });
    await this.writeState();
  }

  public async errorRun(error: string): Promise<void> {
    const ts = new Date().toISOString();
    this.state = {
      ...this.state,
      status: "error",
      updated_at: ts,
    };
    await this.appendEvent({
      type: "run:error",
      run_id: this.state.run_id,
      profile: this.state.profile,
      stage: this.state.stage,
      error,
      ts,
    });
    await this.writeState();
  }

  private withTarget(
    target: string,
    targetState: TargetState,
    ts: string,
  ): RunState {
    return {
      ...this.state,
      updated_at: ts,
      targets: { ...this.state.targets, [target]: targetState },
    };
  }

  private async appendEvent(event: UBEvent): Promise<void> {
    const dir = this.dirname(this.eventsFile);
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(
      this.eventsFile,
      `${JSON.stringify(event)}\n`,
      { append: true },
    );
  }

  private async writeState(): Promise<void> {
    const dir = this.dirname(this.stateFile);
    await Deno.mkdir(dir, { recursive: true });
    const tmp = `${this.stateFile}.tmp`;
    await Deno.writeTextFile(tmp, `${JSON.stringify(this.state, null, 2)}\n`);
    await Deno.rename(tmp, this.stateFile);
  }

  private generateId(): string {
    return crypto.randomUUID().slice(0, 8);
  }

  private dirname(path: string): string {
    const i = path.lastIndexOf("/");
    return i === -1 ? "." : path.slice(0, i);
  }

  private emptyState(): RunState {
    return {
      run_id: "",
      profile: "",
      stage: "",
      status: "running",
      started_at: "",
      updated_at: "",
      targets: {},
    };
  }
}
