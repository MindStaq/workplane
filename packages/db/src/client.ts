import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/pg.js";

export type DrizzleDb = NodePgDatabase<typeof schema>;

const pools = new Map<string, Pool>();

export function getPool(databaseUrl: string): Pool {
  const existing = pools.get(databaseUrl);
  if (existing) {
    return existing;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  pools.set(databaseUrl, pool);
  return pool;
}

export function getDrizzle(pool: Pool): DrizzleDb {
  return drizzle(pool, { schema });
}
