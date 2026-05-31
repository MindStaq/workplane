import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadServerConfig } from "../../core/src/config.js";
import { getDrizzle, getPool } from "./client.js";

const distDir = dirname(fileURLToPath(import.meta.url));

async function migratePostgres(databaseUrl: string): Promise<void> {
  const adminUrl = new URL(databaseUrl);
  const dbName = adminUrl.pathname.replace(/^\//, "");
  if (!dbName) throw new Error("DATABASE_URL must include a database name");

  adminUrl.pathname = "/postgres";
  const adminPool = getPool(adminUrl.toString());
  try {
    const { rowCount } = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (!rowCount) {
      await adminPool.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
      process.stdout.write(`Created database: ${dbName}\n`);
    }
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "42501") {
      throw new Error(
        `Database "${dbName}" does not exist and the current role lacks CREATE DATABASE permissions.`,
      );
    }
    throw err;
  } finally {
    await adminPool.end();
  }

  const pool = getPool(databaseUrl);
  const sql = await readFile(resolve(distDir, "schema.sql"), "utf8");
  await pool.query(sql);
  await pool.end();
  process.stdout.write("Postgres migrations applied.\n");
}

async function migrateSqlite(databaseUrl: string): Promise<void> {
  // Import lazily to avoid loading better-sqlite3 in postgres-only environments
  const { default: Database } = await import("better-sqlite3");
  const filePath = databaseUrl.startsWith("sqlite://")
    ? databaseUrl.slice("sqlite://".length)
    : databaseUrl || "./workplane.db";

  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  const schema = await readFile(resolve(distDir, "schema.sqlite.sql"), "utf8");
  sqlite.exec(schema);
  sqlite.close();
  process.stdout.write(`SQLite migrations applied: ${filePath}\n`);
}

async function main(): Promise<void> {
  const config = loadServerConfig();
  const url = config.databaseUrl;

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    await migratePostgres(url);
  } else {
    await migrateSqlite(url);
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
