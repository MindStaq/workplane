export type TaskStatus =
  | "queued"
  | "assigned"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type RunStatus = TaskStatus;

export interface TaskRecord {
  id: string;
  kind: string;
  adapter: string;
  payload: Record<string, unknown>;
  requires: string[];
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RunRecord {
  id: string;
  taskId: string;
  nodeId: string;
  attempt: number;
  status: RunStatus;
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;
}

export interface NodeRecord {
  id: string;
  name: string;
  capabilities: string[];
  status: "online" | "offline";
  lastHeartbeatAt: string | null;
}

export interface CreateTaskInput {
  kind: string;
  adapter: string;
  payload: Record<string, unknown>;
  requires?: string[];
}

export interface RunLogInput {
  stream: "stdout" | "stderr" | "system";
  message: string;
  stepName?: string;
}

export interface ArtifactRecord {
  id: string;
  runId: string;
  type: string;
  name: string;
  path: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ArtifactInput {
  type: string;
  name: string;
  path: string;
  metadata?: Record<string, unknown>;
}

export type InputEventKind = "stdin" | "signal" | "resize";

export interface RunInputEvent {
  id: number;
  runId: string;
  sequence: number;
  kind: InputEventKind;
  payload: Record<string, unknown>;
  createdAt: string;
  deliveredAt: string | null;
}

export interface AppendInputEventInput {
  kind: InputEventKind;
  payload: Record<string, unknown>;
}

export interface RunLogRecord {
  id: number;
  runId: string;
  stepName: string | null;
  stream: "stdout" | "stderr" | "system";
  message: string;
  timestamp: string;
}

export interface NodePollResult {
  run: RunRecord;
  task: TaskRecord;
}

export interface ServerWorkflows {
  createTask: (input: CreateTaskInput) => Promise<TaskRecord>;
  retryTask: (taskId: string) => Promise<TaskRecord | null>;
  cancelTask: (taskId: string) => Promise<TaskRecord | null>;
  updateRunStatus: (runId: string, status: RunStatus, error?: string) => Promise<RunRecord | null>;
  appendRunLogs: (runId: string, logs: RunLogInput[]) => Promise<number>;
  createArtifact: (runId: string, input: ArtifactInput) => Promise<ArtifactRecord>;
  appendInputEvent: (runId: string, input: AppendInputEventInput) => Promise<RunInputEvent>;
  markInputDelivered: (runId: string, sequence: number) => Promise<void>;
}

export type WorkplanRunStatus =
  | "running"
  | "step_failed"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkplanScheduleRecord {
  id: string;
  planId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  inputs: Record<string, unknown>;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkplanScheduleInput {
  planId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  inputs?: Record<string, unknown>;
  enabled?: boolean;
  nextRunAt?: string | null;
  createdBy?: string;
}

export interface UpdateWorkplanScheduleInput {
  name?: string;
  cronExpression?: string;
  timezone?: string;
  inputs?: Record<string, unknown>;
  enabled?: boolean;
  nextRunAt?: string | null;
}

export interface WorkplanRunRecord {
  id: string;
  scheduleId: string | null;
  planId: string;
  planName: string;
  status: WorkplanRunStatus;
  idempotencyKey: string | null;
  createdAt: string;
  endedAt: string | null;
  error: string | null;
}

export interface WorkplanStepResultRecord {
  id: string;
  workplanRunId: string;
  stepId: string;
  stepName: string;
  output: string | null;
  exitCode: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreateWorkplanRunInput {
  scheduleId?: string;
  planId: string;
  planName: string;
  idempotencyKey?: string;
}

export interface WorkplanStepResultInput {
  stepId: string;
  stepName: string;
  output?: string;
  exitCode?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}
