import { DBOS } from "@dbos-inc/dbos-sdk";
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
} from "@workplane/types";

export class DbosWorkflows implements ServerWorkflows {
  private readonly registered: ServerWorkflows;

  constructor(store: ServerWorkflows) {
    const createTask = DBOS.registerWorkflow(
      async (input: CreateTaskInput) =>
        DBOS.runStep(() => store.createTask(input), { name: "store-create-task" }),
      { name: "createTaskWorkflow" },
    );

    const retryTask = DBOS.registerWorkflow(
      async (taskId: string) =>
        DBOS.runStep(() => store.retryTask(taskId), { name: "store-retry-task" }),
      { name: "retryTaskWorkflow" },
    );

    const cancelTask = DBOS.registerWorkflow(
      async (taskId: string) =>
        DBOS.runStep(() => store.cancelTask(taskId), { name: "store-cancel-task" }),
      { name: "cancelTaskWorkflow" },
    );

    const updateRunStatus = DBOS.registerWorkflow(
      async (runId: string, status: RunStatus, error?: string) =>
        DBOS.runStep(() => store.updateRunStatus(runId, status, error), { name: "store-update-run-status" }),
      { name: "updateRunStatusWorkflow" },
    );

    const appendRunLogs = DBOS.registerWorkflow(
      async (runId: string, logs: RunLogInput[]) =>
        DBOS.runStep(() => store.appendRunLogs(runId, logs), { name: "store-append-run-logs" }),
      { name: "appendRunLogsWorkflow" },
    );

    const createArtifact = DBOS.registerWorkflow(
      async (runId: string, input: ArtifactInput) =>
        DBOS.runStep(() => store.createArtifact(runId, input), { name: "store-create-artifact" }),
      { name: "createArtifactWorkflow" },
    );

    const appendInputEvent = DBOS.registerWorkflow(
      async (runId: string, input: AppendInputEventInput) =>
        DBOS.runStep(() => store.appendInputEvent(runId, input), { name: "store-append-input-event" }),
      { name: "appendInputEventWorkflow" },
    );

    const markInputDelivered = DBOS.registerWorkflow(
      async (runId: string, sequence: number) =>
        DBOS.runStep(() => store.markInputDelivered(runId, sequence), { name: "store-mark-input-delivered" }),
      { name: "markInputDeliveredWorkflow" },
    );

    this.registered = {
      createTask,
      retryTask,
      cancelTask,
      updateRunStatus,
      appendRunLogs,
      createArtifact,
      appendInputEvent,
      markInputDelivered,
    };
  }

  async launch(options: {
    appName: string;
    systemDatabaseUrl: string;
    conductorKey?: string;
    conductorUrl?: string;
  }): Promise<void> {
    DBOS.setConfig({
      name: options.appName,
      systemDatabaseUrl: options.systemDatabaseUrl,
    });
    await DBOS.launch({
      conductorKey: options.conductorKey,
      conductorURL: options.conductorUrl,
    });
  }

  async shutdown(): Promise<void> {
    await DBOS.shutdown();
  }

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const handle = await DBOS.startWorkflow(this.registered.createTask)(input);
    return handle.getResult();
  }

  async retryTask(taskId: string): Promise<TaskRecord | null> {
    const handle = await DBOS.startWorkflow(this.registered.retryTask)(taskId);
    return handle.getResult();
  }

  async cancelTask(taskId: string): Promise<TaskRecord | null> {
    const handle = await DBOS.startWorkflow(this.registered.cancelTask)(taskId);
    return handle.getResult();
  }

  async updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<RunRecord | null> {
    const handle = await DBOS.startWorkflow(this.registered.updateRunStatus)(runId, status, error);
    return handle.getResult();
  }

  async appendRunLogs(runId: string, logs: RunLogInput[]): Promise<number> {
    const handle = await DBOS.startWorkflow(this.registered.appendRunLogs)(runId, logs);
    return handle.getResult();
  }

  async createArtifact(runId: string, input: ArtifactInput): Promise<ArtifactRecord> {
    const handle = await DBOS.startWorkflow(this.registered.createArtifact)(runId, input);
    return handle.getResult();
  }

  async appendInputEvent(runId: string, input: AppendInputEventInput): Promise<RunInputEvent> {
    const handle = await DBOS.startWorkflow(this.registered.appendInputEvent)(runId, input);
    return handle.getResult();
  }

  async markInputDelivered(runId: string, sequence: number): Promise<void> {
    const handle = await DBOS.startWorkflow(this.registered.markInputDelivered)(runId, sequence);
    await handle.getResult();
  }
}

export function createDbosWorkflows(store: ServerWorkflows): DbosWorkflows {
  return new DbosWorkflows(store);
}

export { registerDbosSchedulerTick } from "./scheduler.js";
