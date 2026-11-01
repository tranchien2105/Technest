import { pino } from "pino";
import type { Env } from "./env.js";

export function createLogger(level: Env["LOG_LEVEL"]) {
  return pino({
    level,
    base: { service: "technest-api" },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
        "password",
        "DATABASE_URL",
        "REDIS_URL",
      ],
      censor: "[REDACTED]",
    },
  });
}
