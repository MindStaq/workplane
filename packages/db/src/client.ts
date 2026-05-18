import { Pool } from "pg";

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
