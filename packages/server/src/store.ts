import type { Pool, PoolClient } from "pg";
import { makeId } from "../../core/src/ids.js";
import type {
  ArtifactInput,
  ArtifactRecord,
  CreateTaskInput,
  NodeRecord,
  RunLogInput,
  RunRecord,
  TaskRecord,
} from "../../types/src/index.js";

interface NodePollResult {
  run: RunRecord;
  task: TaskRecord;
}

function mapTask(row: Record<string, unknown>): TaskRecord {
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

function mapRun(row: Record<string, unknown>): RunRecord {
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

function mapArtifact(row: Record<string, unknown>): ArtifactRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    type: String(row.type),
    name: String(row.name),
    path: String(row.path),
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export class PgStore {
  constructor(private readonly pool: Pool) {}

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const taskId = makeId("task");
    const result = await this.pool.query(
      `
      insert into tasks (id, kind, adapter, payload, requires, status)
      values ($1, $2, $3, $4::jsonb, $5::text[], 'queued')
      returning *
      `,
      [taskId, input.kind, input.adapter, JSON.stringify(input.payload), input.requires ?? []],
    );

    return mapTask(result.rows[0] as Record<string, unknown>);
  }

  async listTasks(status?: TaskRecord["status"]): Promise<TaskRecord[]> {
    const result = status
      ? await this.pool.query("select * from tasks where status = $1 order by created_at desc limit 100", [status])
      : await this.pool.query("select * from tasks order by created_at desc limit 100");
    return result.rows.map((row: Record<string, unknown>) => mapTask(row));
  }

  async getTask(taskId: string): Promise<TaskRecord | null> {
    const result = await this.pool.query("select * from tasks where id = $1", [taskId]);
    if (result.rowCount === 0) {
      return null;
    }

    return mapTask(result.rows[0] as Record<string, unknown>);
  }

  async listRuns(filters?: { taskId?: string; status?: RunRecord["status"] }): Promise<RunRecord[]> {
    const taskId = filters?.taskId;
    const status = filters?.status;
    const result =
      taskId && status
        ? await this.pool.query("select * from runs where task_id = $1 and status = $2 order by created_at desc", [
            taskId,
            status,
          ])
        : taskId
          ? await this.pool.query("select * from runs where task_id = $1 order by created_at desc", [taskId])
          : status
            ? await this.pool.query("select * from runs where status = $1 order by created_at desc limit 100", [status])
            : await this.pool.query("select * from runs order by created_at desc limit 100");

    return result.rows.map((row: Record<string, unknown>) => mapRun(row));
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const result = await this.pool.query("select * from runs where id = $1", [runId]);
    if (result.rowCount === 0) {
      return null;
    }

    return mapRun(result.rows[0] as Record<string, unknown>);
  }

  async registerNode(name: string, capabilities: string[], preferredId?: string): Promise<NodeRecord> {
    const existing = await this.pool.query("select * from nodes where name = $1", [name]);
    if (existing.rowCount && existing.rowCount > 0) {
      const row = existing.rows[0] as Record<string, unknown>;
      const nodeId = String(row.id);
      const updated = await this.pool.query(
        `
        update nodes
        set capabilities = $2::text[], status = 'online', last_heartbeat_at = now(), updated_at = now()
        where id = $1
        returning *
        `,
        [nodeId, capabilities],
      );
      return this.mapNodeRecord(updated.rows[0] as Record<string, unknown>);
    }

    const nodeId = preferredId ?? makeId("node");
    const result = await this.pool.query(
      `
      insert into nodes (id, name, capabilities, status, last_heartbeat_at)
      values ($1, $2, $3::text[], 'online', now())
      returning *
      `,
      [nodeId, name, capabilities],
    );

    return this.mapNodeRecord(result.rows[0] as Record<string, unknown>);
  }

  async getRunCancellationState(
    runId: string,
  ): Promise<{ runStatus: string; taskStatus: string } | null> {
    const result = await this.pool.query(
      `
      select r.status as run_status, t.status as task_status
      from runs r
      join tasks t on t.id = r.task_id
      where r.id = $1
      `,
      [runId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    const row = result.rows[0] as Record<string, unknown>;
    return {
      runStatus: String(row.run_status),
      taskStatus: String(row.task_status),
    };
  }

  private mapNodeRecord(row: Record<string, unknown>): NodeRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      capabilities: (row.capabilities as string[]) ?? [],
      status: row.status as NodeRecord["status"],
      lastHeartbeatAt: row.last_heartbeat_at
        ? new Date(String(row.last_heartbeat_at)).toISOString()
        : null,
    };
  }

  async pollNode(nodeId: string, capabilities: string[]): Promise<NodePollResult | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.touchNode(client, nodeId, capabilities);
      const taskResult = await client.query(
        `
        select *
        from tasks
        where status = 'queued'
          and requires <@ $1::text[]
        order by created_at asc
        limit 1
        for update skip locked
        `,
        [capabilities],
      );

      if (taskResult.rowCount === 0) {
        await client.query("commit");
        return null;
      }

      const taskRow = taskResult.rows[0] as Record<string, unknown>;
      const taskId = String(taskRow.id);
      const runId = makeId("run");
      const attemptResult = await client.query("select coalesce(max(attempt), 0) as max_attempt from runs where task_id = $1", [
        taskId,
      ]);
      const attempt = Number(attemptResult.rows[0].max_attempt) + 1;

      const runResult = await client.query(
        `
        insert into runs (id, task_id, node_id, attempt, status, started_at)
        values ($1, $2, $3, $4, 'assigned', now())
        returning *
        `,
        [runId, taskId, nodeId, attempt],
      );

      await client.query("update tasks set status = 'assigned', updated_at = now() where id = $1", [taskId]);

      await client.query("commit");

      return {
        task: mapTask(taskRow),
        run: mapRun(runResult.rows[0] as Record<string, unknown>),
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateRunStatus(runId: string, status: RunRecord["status"], error?: string): Promise<RunRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const currentResult = await client.query(
        `
        select r.*, t.status as task_status
        from runs r
        join tasks t on t.id = r.task_id
        where r.id = $1
        for update
        `,
        [runId],
      );
      if (currentResult.rowCount === 0) {
        await client.query("rollback");
        return null;
      }
      const currentRow = currentResult.rows[0] as Record<string, unknown>;
      const currentTaskStatus = String(currentRow.task_status);
      if (currentTaskStatus === "cancelled" && status !== "cancelled") {
        await client.query("commit");
        return mapRun(currentRow);
      }

      const runResult = await client.query(
        `
        update runs
        set status = $2, error = $3, ended_at = case when $2 in ('succeeded', 'failed', 'cancelled') then now() else ended_at end, updated_at = now()
        where id = $1
        returning *
        `,
        [runId, status, error ?? null],
      );
      if (runResult.rowCount === 0) {
        await client.query("rollback");
        return null;
      }

      const run = mapRun(runResult.rows[0] as Record<string, unknown>);
      const nextTaskStatus =
        status === "succeeded" || status === "failed" || status === "cancelled" ? status : "running";
      if (currentTaskStatus !== "cancelled" || status === "cancelled") {
        await client.query("update tasks set status = $2, updated_at = now() where id = $1", [run.taskId, nextTaskStatus]);
      }
      await client.query("commit");
      return run;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async appendRunLogs(runId: string, logs: RunLogInput[]): Promise<number> {
    let inserted = 0;
    for (const log of logs) {
      await this.pool.query(
        `
        insert into run_logs (run_id, step_name, stream, message)
        values ($1, $2, $3, $4)
        `,
        [runId, log.stepName ?? null, log.stream, log.message],
      );
      inserted += 1;
    }

    return inserted;
  }

  async getRunLogs(runId: string): Promise<Array<Record<string, unknown>>> {
    const result = await this.pool.query("select * from run_logs where run_id = $1 order by timestamp asc", [runId]);
    return result.rows as Array<Record<string, unknown>>;
  }

  async createArtifact(runId: string, input: ArtifactInput): Promise<ArtifactRecord> {
    const artifactId = makeId("artifact");
    const result = await this.pool.query(
      `
      insert into artifacts (id, run_id, type, name, path, metadata)
      values ($1, $2, $3, $4, $5, $6::jsonb)
      returning *
      `,
      [artifactId, runId, input.type, input.name, input.path, input.metadata ? JSON.stringify(input.metadata) : null],
    );
    return mapArtifact(result.rows[0] as Record<string, unknown>);
  }

  async listRunArtifacts(runId: string): Promise<ArtifactRecord[]> {
    const result = await this.pool.query("select * from artifacts where run_id = $1 order by created_at asc", [runId]);
    return result.rows.map((row: Record<string, unknown>) => mapArtifact(row));
  }

  async retryTask(taskId: string): Promise<TaskRecord | null> {
    const result = await this.pool.query(
      `
      update tasks
      set status = 'queued', updated_at = now()
      where id = $1 and status = 'failed'
      returning *
      `,
      [taskId],
    );
    if (result.rowCount === 0) {
      return null;
    }

    return mapTask(result.rows[0] as Record<string, unknown>);
  }

  async cancelTask(taskId: string): Promise<TaskRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const taskResult = await client.query("select * from tasks where id = $1 for update", [taskId]);
      if (taskResult.rowCount === 0) {
        await client.query("rollback");
        return null;
      }

      const taskRow = taskResult.rows[0] as Record<string, unknown>;
      const taskStatus = String(taskRow.status);
      if (taskStatus === "succeeded" || taskStatus === "failed" || taskStatus === "cancelled") {
        await client.query("rollback");
        return null;
      }

      if (taskStatus === "assigned" || taskStatus === "running") {
        const runResult = await client.query(
          `
          select * from runs
          where task_id = $1
          order by attempt desc
          limit 1
          for update
          `,
          [taskId],
        );
        if (runResult.rowCount !== 0) {
          const runStatus = String(runResult.rows[0].status);
          if (runStatus !== "succeeded" && runStatus !== "failed" && runStatus !== "cancelled") {
            await client.query(
              `
              update runs
              set status = 'cancelled', ended_at = now(), updated_at = now(), error = coalesce(error, 'task cancelled')
              where id = $1
              `,
              [runResult.rows[0].id],
            );
          }
        }
      }

      const updateTaskResult = await client.query(
        `
        update tasks
        set status = 'cancelled', updated_at = now()
        where id = $1
        returning *
        `,
        [taskId],
      );

      await client.query("commit");
      return mapTask(updateTaskResult.rows[0] as Record<string, unknown>);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async touchNode(client: PoolClient, nodeId: string, capabilities: string[]): Promise<void> {
    await client.query(
      `
      update nodes
      set capabilities = $2::text[], status = 'online', last_heartbeat_at = now(), updated_at = now()
      where id = $1
      `,
      [nodeId, capabilities],
    );
  }
}
