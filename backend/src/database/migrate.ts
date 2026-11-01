import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnv } from "../config/env.js";
import { createDatabase } from "../config/database.js";
import { createLogger } from "../config/logger.js";

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
// DDL and migration locks may legitimately take longer than API queries.
const { db, pool } = createDatabase(env.DATABASE_URL, {
  connectionTimeoutMillis: 10000,
  statement_timeout: 60000,
  query_timeout: 65000,
});
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)) });
  logger.info("Database migrations applied");
} catch {
  logger.error("Database migration failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
