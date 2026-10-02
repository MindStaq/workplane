import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { baselineLegacySqliteMigrations } from "./baseline-migrations.js";
import * as sqliteSchema from "./schema/sqlite.js";

const migrationsFolder = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "migrations/sqlite",
);

test("baselineLegacySqliteMigrations marks 0000 applied for legacy schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "workplane-baseline-"));
  const dbPath = join(dir, "legacy.db");
  const sqlite = new Database(dbPath);

  sqlite.exec(`
    CREATE TABLE tasks (
      id text PRIMARY KEY NOT NULL,
      kind text NOT NULL,
      adapter text NOT NULL,
      payload text NOT NULL DEFAULT '{}',
      requires text NOT NULL DEFAULT '[]',
      status text NOT NULL,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  baselineLegacySqliteMigrations(sqlite, migrationsFolder);

  const row = sqlite.prepare(
    "SELECT hash FROM __drizzle_migrations ORDER BY created_at ASC LIMIT 1",
  ).get() as { hash: string } | undefined;
  assert.ok(row?.hash);

  const db = drizzle(sqlite, { schema: sqliteSchema });
  migrate(db, { migrationsFolder });

  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'workplan_%' ORDER BY name",
  ).all() as Array<{ name: string }>;

  assert.deepEqual(tables.map((t) => t.name), [
    "workplan_runs",
    "workplan_schedules",
    "workplan_step_results",
  ]);

  sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});
