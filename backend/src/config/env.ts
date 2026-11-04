import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const connectionUrl = (protocols: string[]) =>
  z
    .string()
    .url()
    .refine((value) => {
      try {
        return protocols.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, "Unsupported connection protocol");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: connectionUrl(["http:", "https:"]).default("http://localhost:5173"),
  SEO_ENFORCE_ORIGIN: z.enum(["true","false"]).default("false").transform(value=>value==="true"),
  SEO_TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
  SEO_SITE_URL: z.string().url().optional(),
  SEO_INDEXING_ENABLED: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
  SEO_GOOGLE_VERIFICATION: z.string().max(200).optional(),
  STOREFRONT_DIST: z.string().optional(),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: connectionUrl(["postgres:", "postgresql:"]),
  REDIS_URL: connectionUrl(["redis:", "rediss:"]),
  SMTP_HOST: z.string().min(1).default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("Technest <no-reply@technest.local>"),
  EMAIL_SUPPORT_EMAIL: z.string().email().default("support@technest.local"),
  EMAIL_SUPPORT_NAME: z.string().min(1).default("Technest Support"),
  FRONTEND_URL: connectionUrl(["http:", "https:"]).default("http://localhost:5173"),
});
export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Never print input values or credentials in startup errors.
    throw new Error(
      `Invalid environment variables: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  if (
    result.data.NODE_ENV === "production" &&
    (!result.data.SMTP_USER || !result.data.SMTP_PASSWORD)
  ) {
    throw new Error("Invalid environment variables: SMTP_USER, SMTP_PASSWORD");
  }
  return result.data;
}

export function loadEnv(): Env {
  config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
  return parseEnv(process.env);
}
