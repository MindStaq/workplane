import type { NodeHandle, WorkplanRunContext, WorkplanStep, StepResult } from "./types.js";
import { StepExecutionError } from "./errors.js";
import { printStepResult } from "./sinks/stdout.js";

export interface LocalWorkplanContextOptions {
  serverUrl?: string;
  /** Submitting tasks is an operator action; this token is used for it when set. */
  operatorToken?: string;
  nodeToken?: string;
}

class WorkplaneNodeHandle implements NodeHandle {
  constructor(
    private readonly serverUrl: string,
    private readonly token: string,
  ) {}

  private headers(): Record<string, string> {
    return { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) };
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.serverUrl}${path}`, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`${res.status} from ${path}`);
    }
    return (await res.json()) as T;
  }

  async execute(step: WorkplanStep): Promise<StepResult> {
    const start = Date.now();
    const taskRes = await fetch(`${this.serverUrl}/tasks`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        kind: "workplan.step",
        adapter: step.adapter,
        payload: step.payload,
        requires: step.requires ?? [],
      }),
    });

    if (!taskRes.ok) {
      throw new Error(`failed to submit step ${step.id}: ${taskRes.status}`);
    }

    const task = (await taskRes.json()) as { id: string };
    const status = await this.pollUntilDone(task.id);
    const { runs } = await this.getJson<{ runs: Array<{ id: string; attempt: number; error: string | null }> }>(
      `/runs?taskId=${encodeURIComponent(task.id)}`,
    );
    const run = [...runs].sort((a, b) => b.attempt - a.attempt)[0];
    const output = run ? await this.stdoutOf(run.id) : "";
    if (status !== "succeeded") {
      throw new StepExecutionError(`step task ${task.id} ended with status: ${status}${run?.error ? ` (${run.error})` : ""}`, {
        taskId: task.id,
        runId: run?.id,
        output,
      });
    }
    return { stepId: step.id, output, exitCode: 0, durationMs: Date.now() - start, taskId: task.id, runId: run?.id };
  }

  private async stdoutOf(runId: string): Promise<string> {
    const { logs } = await this.getJson<{ logs: Array<{ stream: string; message: string }> }>(`/runs/${runId}/logs`);
    return logs.filter((log) => log.stream === "stdout").map((log) => log.message).join("");
  }

  private async pollUntilDone(taskId: string): Promise<string> {
    const terminalStatuses = new Set(["succeeded", "failed", "cancelled"]);
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      const task = await this.getJson<{ status: string }>(`/tasks/${taskId}`);
      if (terminalStatuses.has(task.status)) {
        return task.status;
      }
    }
  }
}

export class LocalWorkplanContext implements WorkplanRunContext {
  private readonly serverUrl: string;
  private readonly token: string;

  constructor(opts: LocalWorkplanContextOptions = {}) {
    this.serverUrl = opts.serverUrl ?? process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787";
    this.token =
      opts.operatorToken ?? process.env.WORKPLANE_OPERATOR_TOKEN ?? opts.nodeToken ?? process.env.WORKPLANE_NODE_TOKEN ?? "";
  }

  async resolveNode(_requires: string[], _provider?: string): Promise<NodeHandle> {
    return new WorkplaneNodeHandle(this.serverUrl, this.token);
  }

  emitResult(_stepId: string, stepName: string, output: string): void {
    printStepResult(stepName, output);
  }
}
