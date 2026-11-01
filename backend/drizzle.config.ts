import { defineConfig } from "drizzle-kit";
import { loadEnv } from "./src/config/env.js";

const env = loadEnv();
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema/index.ts",
  out: "./src/database/migrations",
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
});
