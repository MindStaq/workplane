import type { NodeHandle, WorkplanRunContext, WorkplanStep, StepResult } from "./types.js";
import { printStepResult } from "./sinks/stdout.js";

export interface LocalWorkplanContextOptions {
  serverUrl?: string;
  nodeToken?: string;
}

class WorkplaneNodeHandle implements NodeHandle {
  constructor(
    private readonly serverUrl: string,
    private readonly nodeToken: string,
  ) {}

  async execute(step: WorkplanStep): Promise<StepResult> {
    const start = Date.now();
    const taskRes = await fetch(`${this.serverUrl}/tasks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.nodeToken}`,
      },
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
    const output = await this.pollUntilDone(task.id);
    return { stepId: step.id, output, exitCode: 0, durationMs: Date.now() - start };
  }

  private async pollUntilDone(taskId: string): Promise<string> {
    const terminalStatuses = new Set(["succeeded", "failed", "cancelled"]);
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch(`${this.serverUrl}/tasks/${taskId}`, {
        headers: { authorization: `Bearer ${this.nodeToken}` },
      });
      const task = (await res.json()) as { status: string; payload?: Record<string, unknown> };
      if (terminalStatuses.has(task.status)) {
        if (task.status !== "succeeded") {
          throw new Error(`step task ${taskId} ended with status: ${task.status}`);
        }
        return typeof task.payload?.output === "string" ? task.payload.output : "";
      }
    }
  }
}

export class LocalWorkplanContext implements WorkplanRunContext {
  private readonly serverUrl: string;
  private readonly nodeToken: string;

  constructor(opts: LocalWorkplanContextOptions = {}) {
    this.serverUrl = opts.serverUrl ?? process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787";
    this.nodeToken = opts.nodeToken ?? process.env.WORKPLANE_NODE_TOKEN ?? "";
  }

  async resolveNode(_requires: string[], _provider?: string): Promise<NodeHandle> {
    return new WorkplaneNodeHandle(this.serverUrl, this.nodeToken);
  }

  emitResult(_stepId: string, stepName: string, output: string): void {
    printStepResult(stepName, output);
  }
}
