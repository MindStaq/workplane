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

export interface WorkplanStep {
  id: string;
  name: string;
  adapter: string;
  payload: Record<string, unknown>;
  requires?: string[];
  provider?: string;
  model?: string;
  output?: StepOutput;
  dependsOn?: string[];
  continueOnError?: boolean;
}

export interface Workplan {
  id: string;
  name: string;
  description?: string;
  steps: WorkplanStep[];
}

export interface StepResult {
  stepId: string;
  output: string;
  exitCode: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
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

export interface WorkplanRunContext {
  resolveNode(requires: string[], provider?: string): Promise<NodeHandle>;
  emitResult(stepId: string, stepName: string, output: string): void;
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
