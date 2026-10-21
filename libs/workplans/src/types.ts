export type WorkplanStatus =
  | "running"
  | "step_failed"
  | "completed"
  | "failed"
  | "cancelled";

export type StepOutputDest = "stdout" | "artifact" | "next";

export interface StepOutput {
  dest: StepOutputDest;
  format?: "text" | "json";
  artifactName?: string;
}

export type StepStatus = "succeeded" | "failed" | "skipped";

/**
 * A `gate` step (adapter: "gate") runs no work. With a `check` that passes it succeeds; when the check
 * fails it fails the step (`onFail: "fail"`, the default) or pauses for human approval (`onFail: "approval"`).
 * Without a `check` it always pauses for approval.
 */
export interface GateConfig {
  check?: string;
  onFail?: "fail" | "approval";
  message?: string;
}

export interface WorkplanStep {
  id: string;
  name: string;
  adapter: string;
  payload: Record<string, unknown>;
  requires?: string[];
  provider?: string;
  model?: string;
  output?: StepOutput;
  /** When any step declares dependencies the plan runs as a graph; otherwise steps run in order. */
  dependsOn?: string[];
  continueOnError?: boolean;
  /** Condition over earlier step results, e.g. `steps.tests.exitCode != 0`. The step is skipped when false. */
  when?: string;
  gate?: GateConfig;
}

export interface Workplan {
  id: string;
  name: string;
  description?: string;
  steps: WorkplanStep[];
  /** Graph plans only: how many ready steps may run at once. Defaults to 4. */
  maxParallel?: number;
}

export interface StepResult {
  stepId: string;
  output: string;
  exitCode: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
  /** Set by the runner; a NodeHandle may leave it out. */
  status?: StepStatus;
  /** The fleet task and run a step dispatched to, when it ran on a node. */
  taskId?: string;
  runId?: string;
}

export interface WorkplanResult {
  planId: string;
  status: WorkplanStatus;
  steps: StepResult[];
  succeeded: boolean;
}

export interface NodeHandle {
  execute(step: WorkplanStep): Promise<StepResult>;
}

export interface ApprovalRequest {
  stepId: string;
  stepName: string;
  message: string;
}

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
  by?: string;
}

export interface WorkplanRunContext {
  resolveNode(requires: string[], provider?: string): Promise<NodeHandle>;
  emitResult(stepId: string, stepName: string, output: string): void;
  /** Called as each step finishes or is skipped, so results can be persisted while the run continues. */
  onStepResult?(step: WorkplanStep, result: StepResult): void | Promise<void>;
  /** Gate steps that need a human call this; without it they fail. */
  awaitApproval?(request: ApprovalRequest): Promise<ApprovalDecision>;
}

export interface WorkplanRunner {
  run(plan: Workplan, ctx: WorkplanRunContext): Promise<WorkplanResult>;
}

export interface WorkplanSchedule {
  id: string;
  planId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  inputs: Record<string, unknown>;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdBy?: string;
}
