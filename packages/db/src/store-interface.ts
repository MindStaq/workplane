import type {
  AppendInputEventInput,
  ArtifactInput,
  ArtifactRecord,
  CreateTaskInput,
  CreateWorkplanRunInput,
  CreateWorkplanScheduleInput,
  NodePollResult,
  NodeRecord,
  RunInputEvent,
  RunLogInput,
  RunLogRecord,
  RunRecord,
  TaskRecord,
  UpdateWorkplanScheduleInput,
  WorkplanRunRecord,
  WorkplanScheduleRecord,
  WorkplanStepResultInput,
  WorkplanStepResultRecord,
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
  createWorkplanSchedule(input: CreateWorkplanScheduleInput): Promise<WorkplanScheduleRecord>;
  listWorkplanSchedules(enabled?: boolean): Promise<WorkplanScheduleRecord[]>;
  getWorkplanSchedule(scheduleId: string): Promise<WorkplanScheduleRecord | null>;
  updateWorkplanSchedule(scheduleId: string, input: UpdateWorkplanScheduleInput): Promise<WorkplanScheduleRecord | null>;
  deleteWorkplanSchedule(scheduleId: string): Promise<boolean>;
  listDueWorkplanSchedules(asOf: string): Promise<WorkplanScheduleRecord[]>;
  markWorkplanScheduleRan(scheduleId: string, lastRunAt: string, nextRunAt: string): Promise<void>;
  tryCreateWorkplanRun(input: CreateWorkplanRunInput): Promise<WorkplanRunRecord | null>;
  updateWorkplanRun(
    runId: string,
    status: WorkplanRunRecord["status"],
    error?: string,
    endedAt?: string,
  ): Promise<WorkplanRunRecord | null>;
  getWorkplanRun(runId: string): Promise<WorkplanRunRecord | null>;
  listWorkplanRuns(filters?: { scheduleId?: string }): Promise<WorkplanRunRecord[]>;
  appendWorkplanStepResults(runId: string, steps: WorkplanStepResultInput[]): Promise<WorkplanStepResultRecord[]>;
  listWorkplanStepResults(runId: string): Promise<WorkplanStepResultRecord[]>;
}
