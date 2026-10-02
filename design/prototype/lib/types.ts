// Mirrors @workplane/types so screens can switch to @workplane/client without reshaping data.

export type TaskStatus = "queued" | "assigned" | "running" | "succeeded" | "failed" | "cancelled"
export type RunStatus = TaskStatus
export type WorkplanRunStatus = "running" | "step_failed" | "completed" | "failed" | "cancelled"
export type LogStream = "stdout" | "stderr" | "system"
export type InputEventKind = "stdin" | "signal" | "resize"

export interface TaskRecord {
  id: string
  kind: string
  adapter: string
  payload: Record<string, unknown>
  requires: string[]
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

export interface RunRecord {
  id: string
  taskId: string
  nodeId: string
  attempt: number
  status: RunStatus
  startedAt: string | null
  endedAt: string | null
  error: string | null
}

export interface NodeRecord {
  id: string
  name: string
  capabilities: string[]
  status: "online" | "offline"
  lastHeartbeatAt: string | null
  // UI-only fields below are not in NodeRecord yet; they are proposed API gaps for GET /nodes (plan 8.3).
  host: string
  network: "tailscale" | "wireguard" | "lan"
  platform: string
  role: string
  models?: string[]
}

export interface RunLogRecord {
  id: number
  runId: string
  stepName: string | null
  stream: LogStream
  message: string
  timestamp: string
}

export interface ArtifactRecord {
  id: string
  runId: string
  type: string
  name: string
  path: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface RunInputEvent {
  id: number
  runId: string
  sequence: number
  kind: InputEventKind
  payload: Record<string, unknown>
  createdAt: string
  deliveredAt: string | null
}

export interface WorkplanScheduleRecord {
  id: string
  planId: string
  name: string
  cronExpression: string
  timezone: string
  inputs: Record<string, unknown>
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkplanRunRecord {
  id: string
  scheduleId: string | null
  planId: string
  planName: string
  status: WorkplanRunStatus
  idempotencyKey: string | null
  createdAt: string
  endedAt: string | null
  error: string | null
}

export interface WorkplanStepResultRecord {
  id: string
  workplanRunId: string
  stepId: string
  stepName: string
  output: string | null
  exitCode: number | null
  durationMs: number | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface SkillInput {
  name: string
  type: "string" | "path" | "model"
  required: boolean
  description: string
  default?: string
}

export interface SkillStep {
  id: string
  name: string
  provider: "shell" | "ollama" | "anthropic" | "openai" | "file"
  model?: string
}

export interface SkillEntry {
  id: string
  name: string
  description: string
  inputs: SkillInput[]
  steps: SkillStep[]
}
