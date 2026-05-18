import { DBOS } from "@dbos-inc/dbos-sdk";
import type { ArtifactInput, CreateTaskInput, RunLogInput, RunStatus } from "../../types/src/index.js";
import { PgStore } from "./store.js";

export interface ServerWorkflows {
  createTask: (input: CreateTaskInput) => Promise<Awaited<ReturnType<PgStore["createTask"]>>>;
  retryTask: (taskId: string) => Promise<Awaited<ReturnType<PgStore["retryTask"]>>>;
  cancelTask: (taskId: string) => Promise<Awaited<ReturnType<PgStore["cancelTask"]>>>;
  updateRunStatus: (
    runId: string,
    status: RunStatus,
    error?: string,
  ) => Promise<Awaited<ReturnType<PgStore["updateRunStatus"]>>>;
  appendRunLogs: (runId: string, logs: RunLogInput[]) => Promise<Awaited<ReturnType<PgStore["appendRunLogs"]>>>;
  createArtifact: (
    runId: string,
    input: ArtifactInput,
  ) => Promise<Awaited<ReturnType<PgStore["createArtifact"]>>>;
}

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

  return {
    createTask,
    retryTask,
    cancelTask,
    updateRunStatus,
    appendRunLogs,
    createArtifact,
  };
}
