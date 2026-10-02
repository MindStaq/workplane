import type { NodeRecord, RunRecord, TaskRecord, WorkplanRunRecord, WorkplanStepResultRecord } from "@workplane/types";

/** The prototype groups tasks into three families; the API only knows `kind` and `adapter`. */
export type KindGroup = "shell" | "inference" | "harness" | "other";

export function kindGroup(task: Pick<TaskRecord, "kind">): KindGroup {
  switch (task.kind) {
    case "shell.exec":
      return "shell";
    case "inference.batch":
      return "inference";
    case "agent.run":
      return "harness";
    default:
      return "other";
  }
}

export function taskSummary(task: Pick<TaskRecord, "kind" | "payload">): string {
  const { command, prompt } = task.payload;
  if (typeof command === "string") return command;
  if (typeof prompt === "string") return prompt;
  return task.kind;
}

export function isActiveTask(status: TaskRecord["status"]): boolean {
  return status === "running" || status === "assigned";
}

export function isQueuedTask(status: TaskRecord["status"]): boolean {
  return status === "queued" || status === "assigned";
}

export function nodeSatisfies(node: Pick<NodeRecord, "capabilities">, requires: string[]): boolean {
  return requires.every((capability) => node.capabilities.includes(capability));
}

/** Registered nodes that advertise every required capability, whether or not they are online right now. */
export function eligibleNodes<T extends Pick<NodeRecord, "capabilities">>(nodes: T[], requires: string[]): T[] {
  return nodes.filter((node) => nodeSatisfies(node, requires));
}

export function latestRunByTask(runs: RunRecord[]): Map<string, RunRecord> {
  const latest = new Map<string, RunRecord>();
  for (const run of runs) {
    const current = latest.get(run.taskId);
    if (!current || run.attempt > current.attempt || (run.attempt === current.attempt && run.id > current.id)) {
      latest.set(run.taskId, run);
    }
  }
  return latest;
}

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export interface SuccessRate {
  finished: number;
  failed: number;
  /** Whole percent, or null when nothing has finished yet. */
  percent: number | null;
}

export function successRate(runs: RunRecord[]): SuccessRate {
  const finished = runs.filter((run) => run.endedAt);
  const failed = finished.filter((run) => run.status === "failed").length;
  return {
    finished: finished.length,
    failed,
    percent: finished.length === 0 ? null : Math.round(((finished.length - failed) / finished.length) * 100),
  };
}

export type StepState = "ok" | "fail" | "running" | "pending";

export function stepState(result: WorkplanStepResultRecord | undefined, runStatus: WorkplanRunRecord["status"], isNext: boolean): StepState {
  if (result) return result.exitCode === 0 ? "ok" : "fail";
  return runStatus === "running" && isNext ? "running" : "pending";
}

export function newestFirst<T>(items: T[], timestamp: (item: T) => string | null): T[] {
  return [...items].sort((a, b) => (timestamp(b) ?? "9").localeCompare(timestamp(a) ?? "9"));
}
