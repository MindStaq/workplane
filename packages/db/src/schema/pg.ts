import { sql } from "drizzle-orm";
import { bigint, bigserial, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  adapter: text("adapter").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  requires: text("requires").array().notNull().default(sql`'{}'::text[]`),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusCreatedAtIdx: index("idx_tasks_status_created_at").on(table.status, table.createdAt),
}));

export const nodes = pgTable("nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  capabilities: text("capabilities").array().notNull().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("online"),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  nodeId: text("node_id").notNull().references(() => nodes.id),
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  taskIdIdx: index("idx_runs_task_id").on(table.taskId),
  nodeIdIdx: index("idx_runs_node_id").on(table.nodeId),
}));

export const runLogs = pgTable("run_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  stepName: text("step_name"),
  stream: text("stream").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runIdTimestampIdx: index("idx_run_logs_run_id_timestamp").on(table.runId, table.timestamp),
}));

export const artifacts = pgTable("artifacts", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runIdIdx: index("idx_artifacts_run_id").on(table.runId),
}));

export const runInputEvents = pgTable("run_input_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  sequence: bigint("sequence", { mode: "number" }).notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
}, (table) => ({
  runSequenceUniqueIdx: uniqueIndex("idx_run_input_events_run_sequence").on(table.runId, table.sequence),
  undeliveredIdx: index("idx_run_input_events_undelivered").on(table.runId, table.sequence),
}));
