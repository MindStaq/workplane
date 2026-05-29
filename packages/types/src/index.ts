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
