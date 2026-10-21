import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  WorkplanRunRecord,
  WorkplanScheduleRecord,
  WorkplanStepResultInput,
} from "@workplane/types";
import { WorkplanScheduler } from "./scheduler.js";
import type { Workplan, WorkplanRunContext } from "./types.js";

class MemoryScheduleStore {
  schedules = new Map<string, WorkplanScheduleRecord>();
  runs: WorkplanRunRecord[] = [];
  stepResults: WorkplanStepResultInput[] = [];
  idempotency = new Set<string>();

  async listDueWorkplanSchedules(asOf: string): Promise<WorkplanScheduleRecord[]> {
    return [...this.schedules.values()].filter(
      (schedule) => schedule.enabled && schedule.nextRunAt && schedule.nextRunAt <= asOf,
    );
  }

  async getWorkplanSchedule(scheduleId: string): Promise<WorkplanScheduleRecord | null> {
    return this.schedules.get(scheduleId) ?? null;
  }

  async markWorkplanScheduleRan(scheduleId: string, lastRunAt: string, nextRunAt: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return;
    this.schedules.set(scheduleId, { ...schedule, lastRunAt, nextRunAt });
  }

  async tryCreateWorkplanRun(input: {
    scheduleId?: string;
    planId: string;
    planName: string;
    idempotencyKey?: string;
    inputs?: Record<string, unknown>;
  }): Promise<WorkplanRunRecord | null> {
    if (input.idempotencyKey && this.idempotency.has(input.idempotencyKey)) {
      return null;
    }
    if (input.idempotencyKey) {
      this.idempotency.add(input.idempotencyKey);
    }
    const run: WorkplanRunRecord = {
      id: `wprun_${this.runs.length + 1}`,
      scheduleId: input.scheduleId ?? null,
      planId: input.planId,
      planName: input.planName,
      status: "running",
      idempotencyKey: input.idempotencyKey ?? null,
      inputs: input.inputs ?? null,
      createdAt: new Date().toISOString(),
      endedAt: null,
      error: null,
    };
    this.runs.push(run);
    return run;
  }

  async updateWorkplanRun(
    runId: string,
    status: WorkplanRunRecord["status"],
    error?: string,
  ): Promise<WorkplanRunRecord | null> {
    const run = this.runs.find((item) => item.id === runId);
    if (!run) return null;
    run.status = status;
    run.error = error ?? null;
    run.endedAt = status === "running" || status === "waiting_for_approval" ? null : new Date().toISOString();
    this.statusHistory.push(status);
    return run;
  }

  statusHistory: WorkplanRunRecord["status"][] = [];

  async appendWorkplanStepResults(_runId: string, steps: WorkplanStepResultInput[]): Promise<unknown> {
    this.stepResults.push(...steps);
    return steps;
  }
}

const noopContext: WorkplanRunContext = {
  async resolveNode() {
    throw new Error("not implemented");
  },
  emitResult() {},
};

test("WorkplanScheduler tick launches due schedules with idempotency", async () => {
  const store = new MemoryScheduleStore();
  store.schedules.set("sched_1", {
    id: "sched_1",
    planId: "demo",
    name: "Daily demo",
    cronExpression: "* * * * *",
    timezone: "UTC",
    inputs: {},
    enabled: true,
    lastRunAt: null,
    nextRunAt: "2026-01-01T09:00:00.000Z",
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const scheduler = new WorkplanScheduler(
    store,
    {
      resolve(planId): Workplan {
        return {
          id: planId,
          name: "Demo",
          steps: [{
            id: "s1",
            name: "Echo",
            adapter: "shell",
            provider: "shell",
            payload: { command: "echo ok" },
          }],
        };
      },
    },
    () => noopContext,
  );

  const launched = await scheduler.tick(new Date("2026-01-01T09:00:30.000Z"));
  assert.equal(launched.length, 1);
  assert.equal(launched[0]?.status, "completed");
  assert.equal(store.stepResults.length, 1);

  const duplicate = await scheduler.tick(new Date("2026-01-01T09:00:30.000Z"));
  assert.equal(duplicate.length, 0);
});

test("WorkplanScheduler runNow does not advance schedule", async () => {
  const store = new MemoryScheduleStore();
  store.schedules.set("sched_2", {
    id: "sched_2",
    planId: "demo",
    name: "Manual",
    cronExpression: "0 9 * * *",
    timezone: "UTC",
    inputs: {},
    enabled: true,
    lastRunAt: null,
    nextRunAt: "2026-01-01T09:00:00.000Z",
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const scheduler = new WorkplanScheduler(
    store,
    {
      resolve(planId): Workplan {
        return { id: planId, name: "Demo", steps: [] };
      },
    },
    () => noopContext,
  );

  const run = await scheduler.runNow("sched_2");
  assert.ok(run);
  assert.equal(store.schedules.get("sched_2")?.nextRunAt, "2026-01-01T09:00:00.000Z");
});

const linkedNodeContext: WorkplanRunContext = {
  async resolveNode() {
    return {
      async execute(step) {
        return { stepId: step.id, output: `ran ${step.id}`, exitCode: 0, durationMs: 1, taskId: `task_${step.id}`, runId: `run_${step.id}` };
      },
    };
  },
  emitResult() {},
};

test("WorkplanScheduler startRun returns the run at once and records linked step results as they finish", async () => {
  const store = new MemoryScheduleStore();
  const scheduler = new WorkplanScheduler(
    store,
    {
      resolve(planId, inputs): Workplan {
        return {
          id: planId,
          name: "Ad hoc",
          steps: [
            { id: "a", name: "A", adapter: "shell", payload: { command: String(inputs.command) } },
            { id: "b", name: "B", adapter: "shell", payload: {}, dependsOn: ["a"] },
          ],
        };
      },
    },
    () => linkedNodeContext,
  );

  const { run, completion } = await scheduler.startRun("adhoc", { command: "echo hi" });
  assert.equal(run.status, "running");
  assert.deepEqual(run.inputs, { command: "echo hi" });
  assert.equal(run.scheduleId, null);

  const finished = await completion;
  assert.equal(finished?.status, "completed");
  assert.deepEqual(
    store.stepResults.map((step) => [step.stepId, step.status, step.taskId, step.runId]),
    [
      ["a", "succeeded", "task_a", "run_a"],
      ["b", "succeeded", "task_b", "run_b"],
    ],
  );
});

test("WorkplanScheduler startRun rejects an invalid plan before recording a run", async () => {
  const store = new MemoryScheduleStore();
  const scheduler = new WorkplanScheduler(
    store,
    {
      resolve(planId): Workplan {
        return {
          id: planId,
          name: "Cycle",
          steps: [
            { id: "a", name: "A", adapter: "shell", payload: {}, dependsOn: ["b"] },
            { id: "b", name: "B", adapter: "shell", payload: {}, dependsOn: ["a"] },
          ],
        };
      },
    },
    () => linkedNodeContext,
  );
  await assert.rejects(scheduler.startRun("cycle"), /dependency cycle: a -> b -> a/);
  assert.equal(store.runs.length, 0);
});

test("WorkplanScheduler marks a run waiting_for_approval while a gate waits, then running again", async () => {
  const store = new MemoryScheduleStore();
  let approve: (approved: boolean) => void = () => {};
  const scheduler = new WorkplanScheduler(
    store,
    {
      resolve(planId): Workplan {
        return {
          id: planId,
          name: "Gated",
          steps: [
            { id: "approve", name: "Approve", adapter: "gate", payload: {}, gate: { message: "ship it?" } },
            { id: "deploy", name: "Deploy", adapter: "shell", payload: {} },
          ],
        };
      },
    },
    () => ({
      ...linkedNodeContext,
      awaitApproval: (request) => {
        assert.equal(request.message, "ship it?");
        return new Promise((resolve) => {
          approve = (approved) => resolve({ approved, by: "operator" });
        });
      },
    }),
  );

  const { run, completion } = await scheduler.startRun("gated");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(store.runs.find((item) => item.id === run.id)?.status, "waiting_for_approval");
  approve(true);
  const finished = await completion;
  assert.equal(finished?.status, "completed");
  assert.deepEqual(store.statusHistory, ["waiting_for_approval", "running", "completed"]);
  assert.equal(store.stepResults[0].output, "approved by operator");
});
