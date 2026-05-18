import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(databaseUrl: string): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }

  return pool;
}

