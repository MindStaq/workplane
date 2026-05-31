import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { makeId } from "../../core/src/ids.js";
import { artifacts, nodes, runInputEvents, runLogs, runs, tasks } from "./schema/sqlite.js";
import type * as sqliteSchema from "./schema/sqlite.js";
import type { WorkplaneStore } from "./store-interface.js";
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
}
