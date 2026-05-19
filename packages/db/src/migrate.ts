import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadServerConfig } from "../../core/src/config.js";
import { getPool } from "./client.js";

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function parseDatabaseName(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const name = url.pathname.replace(/^\//, "");
  if (!name) {
    throw new Error("DATABASE_URL must include a database name");
  }
  return name;
}

async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const databaseName = parseDatabaseName(databaseUrl);
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = getPool(adminUrl.toString());

  try {
    const existsResult = await adminPool.query("select 1 from pg_database where datname = $1", [databaseName]);
    if (existsResult.rowCount !== 0) {
      return;
    }
    await adminPool.query(`create database ${quoteIdentifier(databaseName)}`);
    process.stdout.write(`Created database: ${databaseName}\n`);
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === "42501") {
      throw new Error(
        `Database "${databaseName}" does not exist and the current role lacks CREATE DATABASE permissions.`,
      );
    }
    throw error;
  } finally {
    await adminPool.end();
  }
}

async function main(): Promise<void> {
  const config = loadServerConfig();
  await ensureDatabaseExists(config.databaseUrl);
  const pool = getPool(config.databaseUrl);
  const filePath = resolve(dirname(fileURLToPath(import.meta.url)), "schema.sql");
  const sql = await readFile(filePath, "utf8");
  await pool.query(sql);
  await pool.end();
  process.stdout.write("Migrations applied.\n");
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
