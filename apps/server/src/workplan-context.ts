import type { WorkplaneStore } from "@workplane/db";
import type { ServerWorkflows, WorkplanRunRecord } from "@workplane/types";
import {
  printStepResult,
  StepExecutionError,
  type ApprovalDecision,
  type ApprovalRequest,
  type NodeHandle,
  type StepResult,
  type WorkplanRunContext,
  type WorkplanStep,
} from "@workplane/workplans";

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

export interface PendingApproval extends ApprovalRequest {
  workplanRunId: string;
  requestedAt: string;
}

/**
 * Gate steps waiting for a human, keyed by workplan run and step. Held in memory: a server restart
 * drops pending approvals along with the in-process run (durable runs are a v0.7.0 item).
 */
export class ApprovalRegistry {
  private readonly pending = new Map<string, { request: PendingApproval; resolve: (decision: ApprovalDecision) => void }>();

  private key(runId: string, stepId: string): string {
    return `${runId}\u0000${stepId}`;
  }

  wait(workplanRunId: string, request: ApprovalRequest): Promise<ApprovalDecision> {
    return new Promise((resolve) => {
      this.pending.set(this.key(workplanRunId, request.stepId), {
        request: { ...request, workplanRunId, requestedAt: new Date().toISOString() },
        resolve,
      });
    });
  }

  list(workplanRunId?: string): PendingApproval[] {
    return [...this.pending.values()]
      .map((entry) => entry.request)
      .filter((request) => !workplanRunId || request.workplanRunId === workplanRunId);
  }

  decide(workplanRunId: string, stepId: string, decision: ApprovalDecision): boolean {
    const key = this.key(workplanRunId, stepId);
    const entry = this.pending.get(key);
    if (!entry) {
      return false;
    }
    this.pending.delete(key);
    entry.resolve(decision);
    return true;
  }
}

/** Dispatches a workplan step as a fleet task through the server's own workflows, then waits for it. */
class InProcessNodeHandle implements NodeHandle {
  constructor(
    private readonly store: WorkplaneStore,
    private readonly workflows: ServerWorkflows,
    private readonly pollIntervalMs: number,
  ) {}

  async execute(step: WorkplanStep): Promise<StepResult> {
    const start = Date.now();
    const task = await this.workflows.createTask({
      kind: "workplan.step",
      adapter: step.adapter,
      payload: step.payload,
      requires: step.requires ?? [],
    });

    let status = task.status as string;
    while (!TERMINAL.has(status)) {
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      status = (await this.store.getTask(task.id))?.status ?? "failed";
    }

    const runs = await this.store.listRuns({ taskId: task.id });
    const run = [...runs].sort((a, b) => b.attempt - a.attempt)[0];
    const output = run
      ? (await this.store.getRunLogs(run.id)).filter((log) => log.stream === "stdout").map((log) => log.message).join("")
      : "";
    if (status !== "succeeded") {
      throw new StepExecutionError(`step task ${task.id} ended with status: ${status}${run?.error ? ` (${run.error})` : ""}`, {
        taskId: task.id,
        runId: run?.id,
        output,
      });
    }
    return { stepId: step.id, output, exitCode: 0, durationMs: Date.now() - start, taskId: task.id, runId: run?.id };
  }
}

export interface ServerWorkplanContextOptions {
  store: WorkplaneStore;
  workflows: ServerWorkflows;
  approvals: ApprovalRegistry;
  run: WorkplanRunRecord;
  pollIntervalMs?: number;
}

export class ServerWorkplanContext implements WorkplanRunContext {
  private readonly handle: InProcessNodeHandle;

  constructor(private readonly options: ServerWorkplanContextOptions) {
    this.handle = new InProcessNodeHandle(options.store, options.workflows, options.pollIntervalMs ?? 500);
  }

  async resolveNode(): Promise<NodeHandle> {
    return this.handle;
  }

  emitResult(_stepId: string, stepName: string, output: string): void {
    printStepResult(stepName, output);
  }

  awaitApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
    return this.options.approvals.wait(this.options.run.id, request);
  }
}
