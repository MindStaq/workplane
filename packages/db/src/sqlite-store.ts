import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { makeId } from "../../core/src/ids.js";
import { artifacts, nodes, runInputEvents, runLogs, runs, tasks, workplanRuns, workplanSchedules, workplanStepResults } from "./schema/sqlite.js";
import type * as sqliteSchema from "./schema/sqlite.js";
import type { WorkplaneStore } from "./store-interface.js";
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

type SqliteDb = BetterSQLite3Database<typeof sqliteSchema>;

function nowIso(): string {
  return new Date().toISOString();
}

// Drizzle-typed mappers for simple CRUD methods (camelCase, text timestamps)

function toTaskRecord(row: typeof tasks.$inferSelect): TaskRecord {
  return {
    id: row.id,
    kind: row.kind,
    adapter: row.adapter,
    payload: row.payload,
    requires: row.requires ?? [],
    status: row.status as TaskRecord["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRunRecord(row: typeof runs.$inferSelect): RunRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    nodeId: row.nodeId,
    attempt: row.attempt,
    status: row.status as RunRecord["status"],
    startedAt: row.startedAt ?? null,
    endedAt: row.endedAt ?? null,
    error: row.error ?? null,
  };
}

function toNodeRecord(row: typeof nodes.$inferSelect): NodeRecord {
  return {
    id: row.id,
    name: row.name,
    capabilities: row.capabilities ?? [],
    status: row.status as NodeRecord["status"],
    lastHeartbeatAt: row.lastHeartbeatAt ?? null,
  };
}

function toLogRecord(row: typeof runLogs.$inferSelect): RunLogRecord {
  return {
    id: row.id,
    runId: row.runId,
    stepName: row.stepName ?? null,
    stream: row.stream as RunLogRecord["stream"],
    message: row.message,
    timestamp: row.timestamp,
  };
}

function toArtifactRecord(row: typeof artifacts.$inferSelect): ArtifactRecord {
  return {
    id: row.id,
    runId: row.runId,
    type: row.type,
    name: row.name,
    path: row.path,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

function toInputEventRecord(row: typeof runInputEvents.$inferSelect): RunInputEvent {
  return {
    id: row.id,
    runId: row.runId,
    sequence: row.sequence,
    kind: row.kind as RunInputEvent["kind"],
    payload: row.payload,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt ?? null,
  };
}

function toScheduleRecord(row: typeof workplanSchedules.$inferSelect): WorkplanScheduleRecord {
  return {
    id: row.id,
    planId: row.planId,
    name: row.name,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    inputs: row.inputs ?? {},
    enabled: row.enabled,
    lastRunAt: row.lastRunAt ?? null,
    nextRunAt: row.nextRunAt ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toWorkplanRunRecord(row: typeof workplanRuns.$inferSelect): WorkplanRunRecord {
  return {
    id: row.id,
    scheduleId: row.scheduleId ?? null,
    planId: row.planId,
    planName: row.planName,
    status: row.status as WorkplanRunRecord["status"],
    idempotencyKey: row.idempotencyKey ?? null,
    createdAt: row.createdAt,
    endedAt: row.endedAt ?? null,
    error: row.error ?? null,
  };
}

function toWorkplanStepResultRecord(row: typeof workplanStepResults.$inferSelect): WorkplanStepResultRecord {
  return {
    id: row.id,
    workplanRunId: row.workplanRunId,
    stepId: row.stepId,
    stepName: row.stepName,
    output: row.output ?? null,
    exitCode: row.exitCode ?? null,
    durationMs: row.durationMs ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

// Raw-row mappers for transaction methods that use $client directly.
// better-sqlite3 rejects async transaction callbacks so we use the sync
// $client API with prepared statements for the 4 methods that need atomicity.

interface RawTaskRow {
  id: string; kind: string; adapter: string;
  payload: string; requires: string; status: string;
  created_at: string; updated_at: string;
}

interface RawRunRow {
  id: string; task_id: string; node_id: string; attempt: number; status: string;
  started_at: string | null; ended_at: string | null; error: string | null;
  created_at: string; updated_at: string;
}

function mapRawTask(row: RawTaskRow): TaskRecord {
  return {
    id: row.id, kind: row.kind, adapter: row.adapter,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    requires: JSON.parse(row.requires) as string[],
    status: row.status as TaskRecord["status"],
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRawRun(row: RawRunRow): RunRecord {
  return {
    id: row.id, taskId: row.task_id, nodeId: row.node_id,
    attempt: row.attempt, status: row.status as RunRecord["status"],
    startedAt: row.started_at ?? null, endedAt: row.ended_at ?? null,
    error: row.error ?? null,
  };
}

export class SqliteStore implements WorkplaneStore {
  constructor(private readonly db: SqliteDb) {}

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const now = nowIso();
    const [row] = await this.db.insert(tasks).values({
      id: makeId("task"),
      kind: input.kind,
      adapter: input.adapter,
      payload: input.payload,
      requires: input.requires ?? [],
      status: "queued",
      createdAt: now,
      updatedAt: now,
    }).returning();
    return toTaskRecord(row);
  }

  async listTasks(status?: TaskRecord["status"]): Promise<TaskRecord[]> {
    const rows = await this.db.select().from(tasks)
      .where(status ? eq(tasks.status, status) : undefined)
      .orderBy(desc(tasks.createdAt)).limit(100);
    return rows.map(toTaskRecord);
  }

  async getTask(taskId: string): Promise<TaskRecord | null> {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, taskId));
    return row ? toTaskRecord(row) : null;
  }

  async listRuns(filters?: { taskId?: string; status?: RunRecord["status"] }): Promise<RunRecord[]> {
    const conds = [];
    if (filters?.taskId) conds.push(eq(runs.taskId, filters.taskId));
    if (filters?.status) conds.push(eq(runs.status, filters.status));
    const rows = await this.db.select().from(runs)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(runs.createdAt)).limit(100);
    return rows.map(toRunRecord);
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const [row] = await this.db.select().from(runs).where(eq(runs.id, runId));
    return row ? toRunRecord(row) : null;
  }

  async registerNode(name: string, capabilities: string[], preferredId?: string): Promise<NodeRecord> {
    const now = nowIso();
    const [existing] = await this.db.select().from(nodes).where(eq(nodes.name, name));
    if (existing) {
      const [updated] = await this.db.update(nodes)
        .set({ capabilities, status: "online", lastHeartbeatAt: now, updatedAt: now })
        .where(eq(nodes.id, existing.id)).returning();
      return toNodeRecord(updated);
    }
    const [inserted] = await this.db.insert(nodes).values({
      id: preferredId ?? makeId("node"), name, capabilities,
      status: "online", lastHeartbeatAt: now, createdAt: now, updatedAt: now,
    }).returning();
    return toNodeRecord(inserted);
  }

  async getRunCancellationState(runId: string): Promise<{ runStatus: string; taskStatus: string } | null> {
    const [row] = await this.db
      .select({ runStatus: runs.status, taskStatus: tasks.status })
      .from(runs).innerJoin(tasks, eq(tasks.id, runs.taskId)).where(eq(runs.id, runId));
    return row ? { runStatus: row.runStatus, taskStatus: row.taskStatus ?? "" } : null;
  }

  // Transaction methods use this.db.$client directly because better-sqlite3
  // rejects async callbacks — all operations inside must be synchronous.

  async pollNode(nodeId: string, capabilities: string[]): Promise<NodePollResult | null> {
    const now = nowIso();
    await this.db.update(nodes)
      .set({ capabilities, status: "online", lastHeartbeatAt: now, updatedAt: now })
      .where(eq(nodes.id, nodeId));

    const raw = this.db.$client;
    return raw.transaction(() => {
      const capSet = new Set(capabilities);
      const queued = raw.prepare(
        "SELECT * FROM tasks WHERE status = 'queued' ORDER BY created_at ASC",
      ).all() as RawTaskRow[];

      const task = queued.find((t) =>
        (JSON.parse(t.requires) as string[]).every((r) => capSet.has(r)),
      );
      if (!task) return null;

      const { max_attempt } = raw.prepare(
        "SELECT COALESCE(MAX(attempt), 0) AS max_attempt FROM runs WHERE task_id = ?",
      ).get(task.id) as { max_attempt: number };

      const runId = makeId("run");
      raw.prepare(
        "INSERT INTO runs (id, task_id, node_id, attempt, status, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'assigned', ?, ?, ?)",
      ).run(runId, task.id, nodeId, max_attempt + 1, now, now, now);

      raw.prepare("UPDATE tasks SET status = 'assigned', updated_at = ? WHERE id = ?").run(now, task.id);

      return {
        task: mapRawTask(task),
        run: mapRawRun(raw.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as RawRunRow),
      };
    })();
  }

  async updateRunStatus(runId: string, status: RunRecord["status"], error?: string): Promise<RunRecord | null> {
    const raw = this.db.$client;
    return raw.transaction(() => {
      const current = raw.prepare(
        "SELECT r.*, t.status AS task_status FROM runs r JOIN tasks t ON t.id = r.task_id WHERE r.id = ?",
      ).get(runId) as (RawRunRow & { task_status: string }) | undefined;
      if (!current) return null;

      if (current.task_status === "cancelled" && status !== "cancelled") {
        return mapRawRun(current);
      }

      const now = nowIso();
      const isTerminal = status === "succeeded" || status === "failed" || status === "cancelled";
      if (isTerminal) {
        raw.prepare(
          "UPDATE runs SET status = ?, error = ?, ended_at = ?, updated_at = ? WHERE id = ?",
        ).run(status, error ?? null, now, now, runId);
      } else {
        raw.prepare(
          "UPDATE runs SET status = ?, error = ?, updated_at = ? WHERE id = ?",
        ).run(status, error ?? null, now, runId);
      }

      const updatedRun = raw.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as RawRunRow;
      const nextTaskStatus = isTerminal ? status : "running";
      if (current.task_status !== "cancelled" || status === "cancelled") {
        raw.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(
          nextTaskStatus, now, updatedRun.task_id,
        );
      }
      return mapRawRun(updatedRun);
    })();
  }

  async appendRunLogs(runId: string, logs: RunLogInput[]): Promise<number> {
    if (logs.length === 0) return 0;
    const now = nowIso();
    await this.db.insert(runLogs).values(
      logs.map((log) => ({
        runId, stepName: log.stepName ?? null,
        stream: log.stream, message: log.message, timestamp: now,
      })),
    );
    return logs.length;
  }

  async getRunLogs(runId: string): Promise<RunLogRecord[]> {
    const rows = await this.db.select().from(runLogs)
      .where(eq(runLogs.runId, runId)).orderBy(asc(runLogs.timestamp));
    return rows.map(toLogRecord);
  }

  async createArtifact(runId: string, input: ArtifactInput): Promise<ArtifactRecord> {
    const now = nowIso();
    const [row] = await this.db.insert(artifacts).values({
      id: makeId("artifact"), runId, type: input.type, name: input.name,
      path: input.path, metadata: input.metadata ?? null, createdAt: now,
    }).returning();
    return toArtifactRecord(row);
  }

  async listRunArtifacts(runId: string): Promise<ArtifactRecord[]> {
    const rows = await this.db.select().from(artifacts)
      .where(eq(artifacts.runId, runId)).orderBy(asc(artifacts.createdAt));
    return rows.map(toArtifactRecord);
  }

  async retryTask(taskId: string): Promise<TaskRecord | null> {
    const [row] = await this.db.update(tasks)
      .set({ status: "queued", updatedAt: nowIso() })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "failed"))).returning();
    return row ? toTaskRecord(row) : null;
  }

  async cancelTask(taskId: string): Promise<TaskRecord | null> {
    const raw = this.db.$client;
    return raw.transaction(() => {
      const taskRow = raw.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as RawTaskRow | undefined;
      if (!taskRow) return null;

      const terminal = new Set(["succeeded", "failed", "cancelled"]);
      if (terminal.has(taskRow.status)) return null;

      const now = nowIso();
      if (taskRow.status === "assigned" || taskRow.status === "running") {
        const latestRun = raw.prepare(
          "SELECT * FROM runs WHERE task_id = ? ORDER BY attempt DESC LIMIT 1",
        ).get(taskId) as RawRunRow | undefined;

        if (latestRun && !terminal.has(latestRun.status)) {
          raw.prepare(
            "UPDATE runs SET status = 'cancelled', ended_at = ?, updated_at = ?, error = COALESCE(error, 'task cancelled') WHERE id = ?",
          ).run(now, now, latestRun.id);
        }
      }

      raw.prepare("UPDATE tasks SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now, taskId);
      return mapRawTask(raw.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as RawTaskRow);
    })();
  }

  async appendInputEvent(runId: string, input: AppendInputEventInput): Promise<RunInputEvent> {
    const raw = this.db.$client;
    const now = nowIso();
    const event = raw.transaction(() => {
      const { next_seq } = raw.prepare(
        "SELECT COALESCE(MAX(sequence), 0) + 1 AS next_seq FROM run_input_events WHERE run_id = ?",
      ).get(runId) as { next_seq: number };

      raw.prepare(
        "INSERT INTO run_input_events (run_id, sequence, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(runId, next_seq, input.kind, JSON.stringify(input.payload), now);

      return raw.prepare(
        "SELECT * FROM run_input_events WHERE run_id = ? AND sequence = ?",
      ).get(runId, next_seq) as {
        id: number; run_id: string; sequence: number; kind: string;
        payload: string; created_at: string; delivered_at: string | null;
      };
    })();

    return {
      id: event.id, runId: event.run_id, sequence: event.sequence,
      kind: event.kind as RunInputEvent["kind"],
      payload: JSON.parse(event.payload) as Record<string, unknown>,
      createdAt: event.created_at, deliveredAt: event.delivered_at ?? null,
    };
  }

  async getInputEvents(runId: string, afterSequence: number): Promise<RunInputEvent[]> {
    const rows = await this.db.select().from(runInputEvents)
      .where(and(eq(runInputEvents.runId, runId), gt(runInputEvents.sequence, afterSequence)))
      .orderBy(asc(runInputEvents.sequence));
    return rows.map(toInputEventRecord);
  }

  async markInputDelivered(runId: string, sequence: number): Promise<void> {
    await this.db.update(runInputEvents)
      .set({ deliveredAt: nowIso() })
      .where(and(eq(runInputEvents.runId, runId), eq(runInputEvents.sequence, sequence)));
  }

  async createWorkplanSchedule(input: CreateWorkplanScheduleInput): Promise<WorkplanScheduleRecord> {
    const now = nowIso();
    const [row] = await this.db.insert(workplanSchedules).values({
      id: makeId("sched"),
      planId: input.planId,
      name: input.name,
      cronExpression: input.cronExpression,
      timezone: input.timezone,
      inputs: input.inputs ?? {},
      enabled: input.enabled ?? true,
      nextRunAt: input.enabled === false ? null : input.nextRunAt ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return toScheduleRecord(row);
  }

  async listWorkplanSchedules(enabled?: boolean): Promise<WorkplanScheduleRecord[]> {
    const rows = await this.db.select().from(workplanSchedules)
      .where(enabled === undefined ? undefined : eq(workplanSchedules.enabled, enabled))
      .orderBy(desc(workplanSchedules.createdAt));
    return rows.map(toScheduleRecord);
  }

  async getWorkplanSchedule(scheduleId: string): Promise<WorkplanScheduleRecord | null> {
    const [row] = await this.db.select().from(workplanSchedules).where(eq(workplanSchedules.id, scheduleId));
    return row ? toScheduleRecord(row) : null;
  }

  async updateWorkplanSchedule(
    scheduleId: string,
    input: UpdateWorkplanScheduleInput,
  ): Promise<WorkplanScheduleRecord | null> {
    const patch: Partial<typeof workplanSchedules.$inferInsert> = { updatedAt: nowIso() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.cronExpression !== undefined) patch.cronExpression = input.cronExpression;
    if (input.timezone !== undefined) patch.timezone = input.timezone;
    if (input.inputs !== undefined) patch.inputs = input.inputs;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.nextRunAt !== undefined) patch.nextRunAt = input.nextRunAt;

    const [row] = await this.db.update(workplanSchedules)
      .set(patch)
      .where(eq(workplanSchedules.id, scheduleId))
      .returning();
    return row ? toScheduleRecord(row) : null;
  }

  async deleteWorkplanSchedule(scheduleId: string): Promise<boolean> {
    const raw = this.db.$client;
    return raw.transaction(() => {
      raw.prepare("UPDATE workplan_runs SET schedule_id = NULL WHERE schedule_id = ?").run(scheduleId);
      const result = raw.prepare("DELETE FROM workplan_schedules WHERE id = ?").run(scheduleId);
      return (result.changes ?? 0) > 0;
    })();
  }

  async listDueWorkplanSchedules(asOf: string): Promise<WorkplanScheduleRecord[]> {
    const rows = await this.db.select().from(workplanSchedules)
      .where(and(
        eq(workplanSchedules.enabled, true),
        sql`${workplanSchedules.nextRunAt} IS NOT NULL`,
        lte(workplanSchedules.nextRunAt, asOf),
      ))
      .orderBy(asc(workplanSchedules.nextRunAt));
    return rows.map(toScheduleRecord);
  }

  async markWorkplanScheduleRan(scheduleId: string, lastRunAt: string, nextRunAt: string): Promise<void> {
    await this.db.update(workplanSchedules)
      .set({ lastRunAt, nextRunAt, updatedAt: nowIso() })
      .where(eq(workplanSchedules.id, scheduleId));
  }

  async tryCreateWorkplanRun(input: CreateWorkplanRunInput): Promise<WorkplanRunRecord | null> {
    const now = nowIso();
    try {
      const [row] = await this.db.insert(workplanRuns).values({
        id: makeId("wprun"),
        scheduleId: input.scheduleId ?? null,
        planId: input.planId,
        planName: input.planName,
        status: "running",
        idempotencyKey: input.idempotencyKey ?? null,
        createdAt: now,
      }).returning();
      return toWorkplanRunRecord(row);
    } catch (err) {
      if (input.idempotencyKey && err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        return null;
      }
      throw err;
    }
  }

  async updateWorkplanRun(
    runId: string,
    status: WorkplanRunRecord["status"],
    error?: string,
    endedAt?: string,
  ): Promise<WorkplanRunRecord | null> {
    const [row] = await this.db.update(workplanRuns)
      .set({
        status,
        error: error ?? null,
        endedAt: endedAt ?? (status !== "running" ? nowIso() : null),
      })
      .where(eq(workplanRuns.id, runId))
      .returning();
    return row ? toWorkplanRunRecord(row) : null;
  }

  async getWorkplanRun(runId: string): Promise<WorkplanRunRecord | null> {
    const [row] = await this.db.select().from(workplanRuns).where(eq(workplanRuns.id, runId));
    return row ? toWorkplanRunRecord(row) : null;
  }

  async listWorkplanRuns(filters?: { scheduleId?: string }): Promise<WorkplanRunRecord[]> {
    const rows = await this.db.select().from(workplanRuns)
      .where(filters?.scheduleId ? eq(workplanRuns.scheduleId, filters.scheduleId) : undefined)
      .orderBy(desc(workplanRuns.createdAt))
      .limit(100);
    return rows.map(toWorkplanRunRecord);
  }

  async appendWorkplanStepResults(
    runId: string,
    steps: WorkplanStepResultInput[],
  ): Promise<WorkplanStepResultRecord[]> {
    if (steps.length === 0) return [];
    const now = nowIso();
    const rows = await this.db.insert(workplanStepResults).values(
      steps.map((step) => ({
        id: makeId("wpstep"),
        workplanRunId: runId,
        stepId: step.stepId,
        stepName: step.stepName,
        output: step.output ?? null,
        exitCode: step.exitCode ?? null,
        durationMs: step.durationMs ?? null,
        metadata: step.metadata ?? null,
        createdAt: now,
      })),
    ).returning();
    return rows.map(toWorkplanStepResultRecord);
  }

  async listWorkplanStepResults(runId: string): Promise<WorkplanStepResultRecord[]> {
    const rows = await this.db.select().from(workplanStepResults)
      .where(eq(workplanStepResults.workplanRunId, runId))
      .orderBy(asc(workplanStepResults.createdAt));
    return rows.map(toWorkplanStepResultRecord);
  }
}
