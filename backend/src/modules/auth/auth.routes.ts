import { Router } from "express";
import { AUTH_COOKIE_PATH, REFRESH_COOKIE, CSRF_COOKIE } from "./auth.http.js";
import type { Env } from "../../config/env.js";
import type { RedisClientType } from "redis";
import { validateRequest } from "../../middlewares/validate-request.js";
import type { AuthService } from "./auth.service.js";
import { authenticate } from "./auth.middleware.js";
import { createAuthController } from "./auth.controller.js";
import { createAuthRateLimit } from "./auth.rate-limit.js";
import type { PasswordResetService } from "./password-reset.service.js";
import { sendData } from "../../shared/response.js";
import { createPasswordResetEmailLimit } from "./auth.rate-limit.js";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  loginSchema,
  registerSchema,
} from "./auth.schemas.js";

export function createAuthRouter(
  auth: AuthService,
  env: Env,
  redis: RedisClientType,
  passwordReset?: PasswordResetService,
) {
  const router = Router();
  const controller = createAuthController(auth, env);
  const rateLimit = createAuthRateLimit(redis);
  if (passwordReset) {
    router.post(
      "/forgot-password",
      rateLimit,
      validateRequest({ body: forgotPasswordSchema }),
      createPasswordResetEmailLimit(redis),
      async (_req, res) => {
        sendData(res, await passwordReset.forgot(res.locals.validated.body.email));
      },
    );
    router.post(
      "/reset-password",
      rateLimit,
      validateRequest({ body: resetPasswordSchema }),
      async (_req, res) => {
        const { token, password } = res.locals.validated.body;
        const result = await passwordReset.reset(token, password);
        res.clearCookie(REFRESH_COOKIE, { path: AUTH_COOKIE_PATH });
        res.clearCookie(CSRF_COOKIE, { path: "/" });
        sendData(res, result);
      },
    );
  }
  router.post(
    "/register",
    rateLimit,
    validateRequest({ body: registerSchema.shape.body }),
    controller.register,
  );
  router.post(
    "/login",
    rateLimit,
    validateRequest({ body: loginSchema.shape.body }),
    controller.login,
  );
  router.post("/refresh", rateLimit, controller.refresh);
  router.post("/logout", controller.logout);
  router.post("/logout-all", authenticate(auth), controller.logoutAll);
  router.get("/me", authenticate(auth), controller.me);
  return router;
}
