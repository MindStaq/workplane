import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadServerConfig } from "../../core/src/config.js";
import { getPool } from "./client.js";

async function main(): Promise<void> {
  const config = loadServerConfig();
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

