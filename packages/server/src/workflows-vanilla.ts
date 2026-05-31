import type {
  AppendInputEventInput,
  ArtifactInput,
  ArtifactRecord,
  CreateTaskInput,
  RunInputEvent,
  RunLogInput,
  RunRecord,
  RunStatus,
  ServerWorkflows,
  TaskRecord,
} from "../../types/src/index.js";
import type { WorkplaneStore } from "../../db/src/store-interface.js";

export class VanillaWorkflows implements ServerWorkflows {
  constructor(private readonly store: WorkplaneStore) {}

  createTask(input: CreateTaskInput): Promise<TaskRecord> {
    return this.store.createTask(input);
  }

  retryTask(taskId: string): Promise<TaskRecord | null> {
    return this.store.retryTask(taskId);
  }

  cancelTask(taskId: string): Promise<TaskRecord | null> {
    return this.store.cancelTask(taskId);
  }

  updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<RunRecord | null> {
    return this.store.updateRunStatus(runId, status, error);
  }

  appendRunLogs(runId: string, logs: RunLogInput[]): Promise<number> {
    return this.store.appendRunLogs(runId, logs);
  }

  createArtifact(runId: string, input: ArtifactInput): Promise<ArtifactRecord> {
    return this.store.createArtifact(runId, input);
  }

  appendInputEvent(runId: string, input: AppendInputEventInput): Promise<RunInputEvent> {
    return this.store.appendInputEvent(runId, input);
  }

  markInputDelivered(runId: string, sequence: number): Promise<void> {
    return this.store.markInputDelivered(runId, sequence);
  }
}
