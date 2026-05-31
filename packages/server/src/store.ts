import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { makeId } from "../../core/src/ids.js";
import type { DrizzleDb } from "../../db/src/client.js";
import { artifacts, nodes, runInputEvents, runLogs, runs, tasks } from "../../db/src/schema/pg.js";
import type { WorkplaneStore } from "../../db/src/store-interface.js";
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

// Typed mappers for Drizzle query-builder results (camelCase from schema inference)

function toTaskRecord(row: typeof tasks.$inferSelect): TaskRecord {
  return {
    id: row.id,
    kind: row.kind,
    adapter: row.adapter,
    payload: row.payload,
    requires: row.requires ?? [],
    status: row.status as TaskRecord["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRunRecord(row: typeof runs.$inferSelect): RunRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    nodeId: row.nodeId,
    attempt: row.attempt,
    status: row.status as RunRecord["status"],
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    error: row.error ?? null,
  };
}

function toNodeRecord(row: typeof nodes.$inferSelect): NodeRecord {
  return {
    id: row.id,
    name: row.name,
    capabilities: row.capabilities ?? [],
    status: row.status as NodeRecord["status"],
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
  };
}

function toLogRecord(row: typeof runLogs.$inferSelect): RunLogRecord {
  return {
    id: row.id,
    runId: row.runId,
    stepName: row.stepName ?? null,
    stream: row.stream as RunLogRecord["stream"],
    message: row.message,
    timestamp: row.timestamp.toISOString(),
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
    createdAt: row.createdAt.toISOString(),
  };
}

function toInputEventRecord(row: typeof runInputEvents.$inferSelect): RunInputEvent {
  return {
    id: row.id,
    runId: row.runId,
    sequence: row.sequence,
    kind: row.kind as RunInputEvent["kind"],
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
  };
}

// Raw-row mappers for tx.execute() results (snake_case from Postgres directly)

function mapRawTask(row: Record<string, unknown>): TaskRecord {
  return {
    id: String(row.id),
    kind: String(row.kind),
    adapter: String(row.adapter),
    payload: (row.payload as Record<string, unknown>) ?? {},
    requires: (row.requires as string[]) ?? [],
    status: row.status as TaskRecord["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapRawRun(row: Record<string, unknown>): RunRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    nodeId: String(row.node_id),
    attempt: Number(row.attempt),
    status: row.status as RunRecord["status"],
    startedAt: row.started_at ? new Date(String(row.started_at)).toISOString() : null,
    endedAt: row.ended_at ? new Date(String(row.ended_at)).toISOString() : null,
    error: row.error ? String(row.error) : null,
  };
}

export class PgStore implements WorkplaneStore {
  constructor(private readonly db: DrizzleDb) {}

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const taskId = makeId("task");
    const [row] = await this.db.insert(tasks).values({
      id: taskId,
      kind: input.kind,
      adapter: input.adapter,
      payload: input.payload,
      requires: input.requires ?? [],
      status: "queued",
    }).returning();
    return toTaskRecord(row);
  }

  async listTasks(status?: TaskRecord["status"]): Promise<TaskRecord[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(status ? eq(tasks.status, status) : undefined)
      .orderBy(desc(tasks.createdAt))
      .limit(100);
    return rows.map(toTaskRecord);
  }

  async getTask(taskId: string): Promise<TaskRecord | null> {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, taskId));
    return row ? toTaskRecord(row) : null;
  }

  async listRuns(filters?: { taskId?: string; status?: RunRecord["status"] }): Promise<RunRecord[]> {
    const conditions = [];
    if (filters?.taskId) conditions.push(eq(runs.taskId, filters.taskId));
    if (filters?.status) conditions.push(eq(runs.status, filters.status));

    const rows = await this.db
      .select()
      .from(runs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(runs.createdAt))
      .limit(100);
    return rows.map(toRunRecord);
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const [row] = await this.db.select().from(runs).where(eq(runs.id, runId));
    return row ? toRunRecord(row) : null;
  }

  async registerNode(name: string, capabilities: string[], preferredId?: string): Promise<NodeRecord> {
    const [existing] = await this.db.select().from(nodes).where(eq(nodes.name, name));

    if (existing) {
      const [updated] = await this.db.update(nodes)
        .set({ capabilities, status: "online", lastHeartbeatAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(nodes.id, existing.id))
        .returning();
      return toNodeRecord(updated);
    }

    const nodeId = preferredId ?? makeId("node");
    const [inserted] = await this.db.insert(nodes).values({
      id: nodeId, name, capabilities, status: "online", lastHeartbeatAt: sql`now()`,
    }).returning();
    return toNodeRecord(inserted);
  }

  async getRunCancellationState(runId: string): Promise<{ runStatus: string; taskStatus: string } | null> {
    const [row] = await this.db
      .select({ runStatus: runs.status, taskStatus: tasks.status })
      .from(runs)
      .innerJoin(tasks, eq(tasks.id, runs.taskId))
      .where(eq(runs.id, runId));
    return row ?? null;
  }

  async pollNode(nodeId: string, capabilities: string[]): Promise<NodePollResult | null> {
    return await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE nodes
        SET capabilities = ${capabilities}::text[], status = 'online',
            last_heartbeat_at = now(), updated_at = now()
        WHERE id = ${nodeId}
      `);

      const taskResult = await tx.execute(sql`
        SELECT * FROM tasks
        WHERE status = 'queued' AND requires <@ ${capabilities}::text[]
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      if (taskResult.rows.length === 0) return null;

      const taskRow = taskResult.rows[0] as Record<string, unknown>;
      const taskId = String(taskRow.id);

      const attemptResult = await tx.execute(sql`
        SELECT COALESCE(MAX(attempt), 0) AS max_attempt FROM runs WHERE task_id = ${taskId}
      `);
      const attempt = Number((attemptResult.rows[0] as Record<string, unknown>).max_attempt) + 1;

      const runId = makeId("run");

      const runResult = await tx.execute(sql`
        INSERT INTO runs (id, task_id, node_id, attempt, status, started_at)
        VALUES (${runId}, ${taskId}, ${nodeId}, ${attempt}, 'assigned', now())
        RETURNING *
      `);

      await tx.execute(sql`
        UPDATE tasks SET status = 'assigned', updated_at = now() WHERE id = ${taskId}
      `);

      return {
        task: mapRawTask(taskRow),
        run: mapRawRun(runResult.rows[0] as Record<string, unknown>),
      };
    });
  }

  async updateRunStatus(runId: string, status: RunRecord["status"], error?: string): Promise<RunRecord | null> {
    return await this.db.transaction(async (tx) => {
      const currentResult = await tx.execute(sql`
        SELECT r.*, t.status AS task_status
        FROM runs r JOIN tasks t ON t.id = r.task_id
        WHERE r.id = ${runId}
        FOR UPDATE
      `);

      if (currentResult.rows.length === 0) return null;

      const currentRow = currentResult.rows[0] as Record<string, unknown>;
      const currentTaskStatus = String(currentRow.task_status);

      if (currentTaskStatus === "cancelled" && status !== "cancelled") {
        return mapRawRun(currentRow);
      }

      const isTerminal = status === "succeeded" || status === "failed" || status === "cancelled";
      const [updatedRun] = await tx.update(runs)
        .set(isTerminal
          ? { status, error: error ?? null, endedAt: sql`now()`, updatedAt: sql`now()` }
          : { status, error: error ?? null, updatedAt: sql`now()` })
        .where(eq(runs.id, runId))
        .returning();

      if (!updatedRun) return null;

      const nextTaskStatus = isTerminal ? status : "running";
      if (currentTaskStatus !== "cancelled" || status === "cancelled") {
        await tx.update(tasks)
          .set({ status: nextTaskStatus, updatedAt: sql`now()` })
          .where(eq(tasks.id, updatedRun.taskId));
      }

      return toRunRecord(updatedRun);
    });
  }

  async appendRunLogs(runId: string, logs: RunLogInput[]): Promise<number> {
    if (logs.length === 0) return 0;
    await this.db.insert(runLogs).values(
      logs.map((log) => ({
        runId,
        stepName: log.stepName ?? null,
        stream: log.stream,
        message: log.message,
      })),
    );
    return logs.length;
  }

  async getRunLogs(runId: string): Promise<RunLogRecord[]> {
    const rows = await this.db
      .select()
      .from(runLogs)
      .where(eq(runLogs.runId, runId))
      .orderBy(asc(runLogs.timestamp));
    return rows.map(toLogRecord);
  }

  async createArtifact(runId: string, input: ArtifactInput): Promise<ArtifactRecord> {
    const artifactId = makeId("artifact");
    const [row] = await this.db.insert(artifacts).values({
      id: artifactId,
      runId,
      type: input.type,
      name: input.name,
      path: input.path,
      metadata: input.metadata ?? null,
    }).returning();
    return toArtifactRecord(row);
  }

  async listRunArtifacts(runId: string): Promise<ArtifactRecord[]> {
    const rows = await this.db
      .select()
      .from(artifacts)
      .where(eq(artifacts.runId, runId))
      .orderBy(asc(artifacts.createdAt));
    return rows.map(toArtifactRecord);
  }

  async retryTask(taskId: string): Promise<TaskRecord | null> {
    const [row] = await this.db.update(tasks)
      .set({ status: "queued", updatedAt: sql`now()` })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "failed")))
      .returning();
    return row ? toTaskRecord(row) : null;
  }

  async cancelTask(taskId: string): Promise<TaskRecord | null> {
    return await this.db.transaction(async (tx) => {
      const taskResult = await tx.execute(sql`
        SELECT * FROM tasks WHERE id = ${taskId} FOR UPDATE
      `);

      if (taskResult.rows.length === 0) return null;

      const taskRow = taskResult.rows[0] as Record<string, unknown>;
      const taskStatus = String(taskRow.status);

      if (taskStatus === "succeeded" || taskStatus === "failed" || taskStatus === "cancelled") {
        return null;
      }

      if (taskStatus === "assigned" || taskStatus === "running") {
        const runResult = await tx.execute(sql`
          SELECT * FROM runs WHERE task_id = ${taskId} ORDER BY attempt DESC LIMIT 1 FOR UPDATE
        `);

        if (runResult.rows.length > 0) {
          const runRow = runResult.rows[0] as Record<string, unknown>;
          const runStatus = String(runRow.status);
          if (runStatus !== "succeeded" && runStatus !== "failed" && runStatus !== "cancelled") {
            await tx.execute(sql`
              UPDATE runs SET status = 'cancelled', ended_at = now(), updated_at = now(),
                error = COALESCE(error, 'task cancelled')
              WHERE id = ${runRow.id}
            `);
          }
        }
      }

      const [updatedTask] = await tx.update(tasks)
        .set({ status: "cancelled", updatedAt: sql`now()` })
        .where(eq(tasks.id, taskId))
        .returning();

      return toTaskRecord(updatedTask);
    });
  }

  async appendInputEvent(runId: string, input: AppendInputEventInput): Promise<RunInputEvent> {
    return await this.db.transaction(async (tx) => {
      const seqResult = await tx.execute(sql`
        SELECT COALESCE(MAX(sequence), 0) + 1 AS next_seq FROM run_input_events WHERE run_id = ${runId}
      `);
      const sequence = Number((seqResult.rows[0] as Record<string, unknown>).next_seq);

      const [inserted] = await tx.insert(runInputEvents)
        .values({ runId, sequence, kind: input.kind, payload: input.payload })
        .returning();

      return toInputEventRecord(inserted);
    });
  }

  async getInputEvents(runId: string, afterSequence: number): Promise<RunInputEvent[]> {
    const rows = await this.db
      .select()
      .from(runInputEvents)
      .where(and(eq(runInputEvents.runId, runId), gt(runInputEvents.sequence, afterSequence)))
      .orderBy(asc(runInputEvents.sequence));
    return rows.map(toInputEventRecord);
  }

  async markInputDelivered(runId: string, sequence: number): Promise<void> {
    await this.db.update(runInputEvents)
      .set({ deliveredAt: sql`now()` })
      .where(and(eq(runInputEvents.runId, runId), eq(runInputEvents.sequence, sequence)));
  }
}
