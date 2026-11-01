import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "../database/schema/index.js";

export function createDatabase(
  connectionString: string,
  timeouts: Pick<
    PoolConfig,
    "connectionTimeoutMillis" | "statement_timeout" | "query_timeout"
  > = {},
) {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000,
    statement_timeout: 2000,
    query_timeout: 2500,
    ...timeouts,
  });
  return { pool, db: drizzle(pool, { schema }) };
}
