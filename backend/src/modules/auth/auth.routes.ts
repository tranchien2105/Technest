import { Router } from "express";
import type { Env } from "../../config/env.js";
import type { RedisClientType } from "redis";
import { validateRequest } from "../../middlewares/validate-request.js";
import type { AuthService } from "./auth.service.js";
import { authenticate } from "./auth.middleware.js";
import { createAuthController } from "./auth.controller.js";
import { createAuthRateLimit } from "./auth.rate-limit.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";

export function createAuthRouter(auth: AuthService, env: Env, redis: RedisClientType) {
  const router = Router();
  const controller = createAuthController(auth, env);
  const rateLimit = createAuthRateLimit(redis);
  router.post("/register", rateLimit, validateRequest({ body: registerSchema.shape.body }), controller.register);
  router.post("/login", rateLimit, validateRequest({ body: loginSchema.shape.body }), controller.login);
  router.post("/refresh", rateLimit, controller.refresh);
  router.post("/logout", controller.logout);
  router.post("/logout-all", authenticate(auth), controller.logoutAll);
  router.get("/me", authenticate(auth), controller.me);
  return router;
}
