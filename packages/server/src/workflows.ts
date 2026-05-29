import { DBOS } from "@dbos-inc/dbos-sdk";
import type { AppendInputEventInput, ArtifactInput, CreateTaskInput, RunLogInput, RunStatus, ServerWorkflows } from "../../types/src/index.js";
import { PgStore } from "./store.js";

export type { ServerWorkflows };

export function registerWorkflows(store: PgStore): ServerWorkflows {
  const createTask = DBOS.registerWorkflow(
    async (input: CreateTaskInput) =>
      DBOS.runStep(() => store.createTask(input), {
        name: "store-create-task",
      }),
    { name: "createTaskWorkflow" },
  );

  const retryTask = DBOS.registerWorkflow(
    async (taskId: string) =>
      DBOS.runStep(() => store.retryTask(taskId), {
        name: "store-retry-task",
      }),
    { name: "retryTaskWorkflow" },
  );

  const cancelTask = DBOS.registerWorkflow(
    async (taskId: string) =>
      DBOS.runStep(() => store.cancelTask(taskId), {
        name: "store-cancel-task",
      }),
    { name: "cancelTaskWorkflow" },
  );

  const updateRunStatus = DBOS.registerWorkflow(
    async (runId: string, status: RunStatus, error?: string) =>
      DBOS.runStep(() => store.updateRunStatus(runId, status, error), {
        name: "store-update-run-status",
      }),
    { name: "updateRunStatusWorkflow" },
  );

  const appendRunLogs = DBOS.registerWorkflow(
    async (runId: string, logs: RunLogInput[]) =>
      DBOS.runStep(() => store.appendRunLogs(runId, logs), {
        name: "store-append-run-logs",
      }),
    { name: "appendRunLogsWorkflow" },
  );

  const createArtifact = DBOS.registerWorkflow(
    async (runId: string, input: ArtifactInput) =>
      DBOS.runStep(() => store.createArtifact(runId, input), {
        name: "store-create-artifact",
      }),
    { name: "createArtifactWorkflow" },
  );

  const appendInputEvent = DBOS.registerWorkflow(
    async (runId: string, input: AppendInputEventInput) =>
      DBOS.runStep(() => store.appendInputEvent(runId, input), {
        name: "store-append-input-event",
      }),
    { name: "appendInputEventWorkflow" },
  );

  const markInputDelivered = DBOS.registerWorkflow(
    async (runId: string, sequence: number) =>
      DBOS.runStep(() => store.markInputDelivered(runId, sequence), {
        name: "store-mark-input-delivered",
      }),
    { name: "markInputDeliveredWorkflow" },
  );

  return {
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
