import { Router } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import type { RedisClientType } from "redis";
import type { AuthService } from "../auth/auth.service.js";
import { authenticate } from "../auth/auth.middleware.js";
import { createAccountController } from "./account.controller.js";
import { createAuthRateLimit } from "../auth/auth.rate-limit.js";
import type { AccountService } from "./account.service.js";
import { addressBodySchema, addressIdSchema, addressPatchSchema, passwordBodySchema, profilePatchSchema, sessionIdSchema } from "./account.schemas.js";

export function createAccountRouter(service: AccountService, auth: AuthService, redis: RedisClientType, notify?: Parameters<typeof createAccountController>[1]) {
  const router = Router();
  const controller = createAccountController(service, notify);
  router.use(authenticate(auth));
  const rateLimit = createAuthRateLimit(redis);
  router.get("/profile", controller.profile);
  router.patch("/profile", validateRequest({ body: profilePatchSchema }), controller.updateProfile);
  router.get("/addresses", controller.addresses);
  router.post("/addresses", validateRequest({ body: addressBodySchema }), controller.createAddress);
  router.patch("/addresses/:id", validateRequest({ params: addressIdSchema, body: addressPatchSchema }), controller.updateAddress);
  router.patch("/addresses/:id/default", validateRequest({ params: addressIdSchema }), controller.setDefaultAddress);
  router.delete("/addresses/:id", validateRequest({ params: addressIdSchema }), controller.deleteAddress);
  router.post("/change-password", rateLimit, validateRequest({ body: passwordBodySchema }), controller.changePassword);
  router.get("/sessions", controller.sessions);
  router.delete("/sessions/:id", validateRequest({ params: sessionIdSchema }), controller.revokeSession);
  return router;
}
