import type {
  AppendInputEventInput,
  ArtifactInput,
  ArtifactRecord,
  CreateTaskInput,
  NodePollResult,
  NodeRecord,
  RunInputEvent,
  RunLogInput,
  RunLogRecord,
  RunRecord,
  TaskRecord,
} from "../../types/src/index.js";

export type { NodePollResult };

export interface WorkplaneStore {
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  listTasks(status?: TaskRecord["status"]): Promise<TaskRecord[]>;
  getTask(taskId: string): Promise<TaskRecord | null>;
  listRuns(filters?: { taskId?: string; status?: RunRecord["status"] }): Promise<RunRecord[]>;
  getRun(runId: string): Promise<RunRecord | null>;
  registerNode(name: string, capabilities: string[], preferredId?: string): Promise<NodeRecord>;
  getRunCancellationState(runId: string): Promise<{ runStatus: string; taskStatus: string } | null>;
  pollNode(nodeId: string, capabilities: string[]): Promise<NodePollResult | null>;
  updateRunStatus(runId: string, status: RunRecord["status"], error?: string): Promise<RunRecord | null>;
  appendRunLogs(runId: string, logs: RunLogInput[]): Promise<number>;
  getRunLogs(runId: string): Promise<RunLogRecord[]>;
  createArtifact(runId: string, input: ArtifactInput): Promise<ArtifactRecord>;
  listRunArtifacts(runId: string): Promise<ArtifactRecord[]>;
  retryTask(taskId: string): Promise<TaskRecord | null>;
  cancelTask(taskId: string): Promise<TaskRecord | null>;
  appendInputEvent(runId: string, input: AppendInputEventInput): Promise<RunInputEvent>;
  getInputEvents(runId: string, afterSequence: number): Promise<RunInputEvent[]>;
  markInputDelivered(runId: string, sequence: number): Promise<void>;
}
