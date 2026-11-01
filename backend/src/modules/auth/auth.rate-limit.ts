import type { RequestHandler } from "express";
import type { RedisClientType } from "redis";
import { AppError } from "../../shared/errors.js";
import { createHash } from "node:crypto";

export function createAuthRateLimit(redis: RedisClientType): RequestHandler {
  return async (request, response, next) => {
    try {
      const identity = createHash("sha256").update(request.ip ?? "unknown").digest("hex");
      const key = `auth:rate:${request.path}:${identity}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 60);
      response.setHeader("RateLimit-Limit", "10");
      response.setHeader("RateLimit-Remaining", String(Math.max(0, 10 - count)));
      if (count > 10) {
        next(new AppError(429, "RATE_LIMITED", "Too many authentication attempts; try again later"));
        return;
      }
      next();
    } catch {
      next(new AppError(503, "RATE_LIMIT_UNAVAILABLE", "Authentication is temporarily unavailable"));
    }
  };
}
