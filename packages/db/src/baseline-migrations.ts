import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type pg from "pg";

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

function readJournal(migrationsFolder: string): Journal {
  return JSON.parse(
    readFileSync(resolve(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as Journal;
}

function migrationHash(migrationsFolder: string, tag: string): string {
  const sql = readFileSync(resolve(migrationsFolder, `${tag}.sql`), "utf8");
  return createHash("sha256").update(sql).digest("hex");
}

function baselineEntries(migrationsFolder: string, upToIdx: number): Array<{ hash: string; createdAt: number; tag: string }> {
  const journal = readJournal(migrationsFolder);
  return journal.entries
    .filter((entry) => entry.idx <= upToIdx)
    .map((entry) => ({
      hash: migrationHash(migrationsFolder, entry.tag),
      createdAt: entry.when,
      tag: entry.tag,
    }));
}

async function tableExistsPg(pool: pg.Pool, tableName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [tableName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function getLastMigrationCreatedAtPg(pool: pg.Pool): Promise<number | null> {
  await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const result = await pool.query<{ created_at: string | null }>(
    "SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
  );
  const value = result.rows[0]?.created_at;
  return value === null || value === undefined ? null : Number(value);
}

async function insertBaselinePg(
  pool: pg.Pool,
  entries: Array<{ hash: string; createdAt: number; tag: string }>,
): Promise<string[]> {
  const inserted: string[] = [];
  const lastCreatedAt = await getLastMigrationCreatedAtPg(pool);

  for (const entry of entries) {
    if (lastCreatedAt !== null && lastCreatedAt >= entry.createdAt) {
      continue;
    }

    const existing = await pool.query<{ id: number }>(
      "SELECT id FROM drizzle.__drizzle_migrations WHERE created_at = $1 LIMIT 1",
      [entry.createdAt],
    );
    if (existing.rowCount) {
      continue;
    }

    await pool.query(
      'INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)',
      [entry.hash, entry.createdAt],
    );
    inserted.push(entry.tag);
  }

  return inserted;
}

export async function baselineLegacyPostgresMigrations(
  pool: pg.Pool,
  migrationsFolder: string,
): Promise<void> {
  const hasTasks = await tableExistsPg(pool, "tasks");
  if (!hasTasks) {
    return;
  }

  const hasWorkplanSchedules = await tableExistsPg(pool, "workplan_schedules");
  const upToIdx = hasWorkplanSchedules ? 1 : 0;
  const inserted = await insertBaselinePg(pool, baselineEntries(migrationsFolder, upToIdx));

  if (inserted.length > 0) {
    process.stdout.write(
      `Baselined existing Postgres schema for migration(s): ${inserted.join(", ")}\n`,
    );
  }
}

function tableExistsSqlite(db: import("better-sqlite3").Database, tableName: string): boolean {
  const row = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
  ).get(tableName);
  return Boolean(row);
}

function getLastMigrationCreatedAtSqlite(db: import("better-sqlite3").Database): number | null {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  const row = db.prepare(
    "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
  ).get() as { created_at: number } | undefined;

  return row?.created_at ?? null;
}

function insertBaselineSqlite(
  db: import("better-sqlite3").Database,
  entries: Array<{ hash: string; createdAt: number; tag: string }>,
): string[] {
  const inserted: string[] = [];
  const lastCreatedAt = getLastMigrationCreatedAtSqlite(db);

  const insert = db.prepare(
    'INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)',
  );
  const exists = db.prepare(
    "SELECT 1 FROM __drizzle_migrations WHERE created_at = ? LIMIT 1",
  );

  for (const entry of entries) {
    if (lastCreatedAt !== null && lastCreatedAt >= entry.createdAt) {
      continue;
    }
    if (exists.get(entry.createdAt)) {
      continue;
    }
    insert.run(entry.hash, entry.createdAt);
    inserted.push(entry.tag);
  }

  return inserted;
}

export function baselineLegacySqliteMigrations(
  db: import("better-sqlite3").Database,
  migrationsFolder: string,
): void {
  if (!tableExistsSqlite(db, "tasks")) {
    return;
  }

  const hasWorkplanSchedules = tableExistsSqlite(db, "workplan_schedules");
  const upToIdx = hasWorkplanSchedules ? 1 : 0;
  const inserted = insertBaselineSqlite(db, baselineEntries(migrationsFolder, upToIdx));

  if (inserted.length > 0) {
    process.stdout.write(
      `Baselined existing SQLite schema for migration(s): ${inserted.join(", ")}\n`,
    );
  }
}
