import { isNull, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  adapter: text("adapter").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  requires: text("requires", { mode: "json" }).$type<string[]>().notNull().default([]),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(nowDefault),
  updatedAt: text("updated_at").notNull().default(nowDefault),
}, (table) => ({
  statusCreatedAtIdx: index("idx_tasks_status_created_at").on(table.status, table.createdAt),
}));

export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  capabilities: text("capabilities", { mode: "json" }).$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("online"),
  lastHeartbeatAt: text("last_heartbeat_at"),
  createdAt: text("created_at").notNull().default(nowDefault),
  updatedAt: text("updated_at").notNull().default(nowDefault),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  nodeId: text("node_id").notNull().references(() => nodes.id),
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(nowDefault),
  updatedAt: text("updated_at").notNull().default(nowDefault),
}, (table) => ({
  taskIdIdx: index("idx_runs_task_id").on(table.taskId),
  nodeIdIdx: index("idx_runs_node_id").on(table.nodeId),
}));

export const runLogs = sqliteTable("run_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull().references(() => runs.id),
  stepName: text("step_name"),
  stream: text("stream").notNull(),
  message: text("message").notNull(),
  timestamp: text("timestamp").notNull().default(nowDefault),
}, (table) => ({
  runIdTimestampIdx: index("idx_run_logs_run_id_timestamp").on(table.runId, table.timestamp),
}));

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(nowDefault),
}, (table) => ({
  runIdIdx: index("idx_artifacts_run_id").on(table.runId),
}));

export const runInputEvents = sqliteTable("run_input_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull().references(() => runs.id),
  sequence: integer("sequence").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: text("created_at").notNull().default(nowDefault),
  deliveredAt: text("delivered_at"),
}, (table) => ({
  runSequenceUniqueIdx: uniqueIndex("idx_run_input_events_run_sequence").on(table.runId, table.sequence),
  undeliveredIdx: index("idx_run_input_events_undelivered").on(table.runId, table.sequence).where(isNull(table.deliveredAt)),
}));
