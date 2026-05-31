import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { Pool } from "pg";
import { PgStore } from "./pg-store.js";
import { SqliteStore } from "./sqlite-store.js";
import * as pgSchema from "./schema/pg.js";
import * as sqliteSchema from "./schema/sqlite.js";
import type { WorkplaneStore } from "./store-interface.js";

export type DrizzleDb = NodePgDatabase<typeof pgSchema>;

export interface StoreHandle {
  store: WorkplaneStore;
  close: () => Promise<void>;
}

const pools = new Map<string, Pool>();

export function getPool(databaseUrl: string): Pool {
  const existing = pools.get(databaseUrl);
  if (existing) return existing;
  const pool = new Pool({ connectionString: databaseUrl });
  pools.set(databaseUrl, pool);
  return pool;
}

export function getDrizzle(pool: Pool): DrizzleDb {
  return drizzlePg(pool, { schema: pgSchema });
}

function parseSqlitePath(url: string): string {
  if (url.startsWith("sqlite://")) return url.slice("sqlite://".length);
  return url || "./workplane.db";
}

export function createStore(databaseUrl?: string): StoreHandle {
  const url = databaseUrl ?? "";

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const pool = getPool(url);
    return {
      store: new PgStore(getDrizzle(pool)),
      close: () => pool.end(),
    };
  }

  const filePath = parseSqlitePath(url);
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  const db = drizzleSqlite(sqlite, { schema: sqliteSchema });
  return {
    store: new SqliteStore(db),
    close: async () => { sqlite.close(); },
  };
}
