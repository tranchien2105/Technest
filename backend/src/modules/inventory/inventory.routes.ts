import { adminAccess } from "../admin-operations/permissions.js";
import { Router } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import { createInventoryController } from "./inventory.controller.js";
import type { InventoryService } from "./inventory.service.js";
import {
  adjustBody,
  inboundBody,
  movementsQuery,
  skuParams,
  variantIdParams,
} from "./inventory.schemas.js";

export function createPublicInventoryRouter(service: InventoryService) {
  const router = Router();
  const controller = createInventoryController(service);
  router.get("/sku/:sku", validateRequest({ params: skuParams }), controller.publicBySku);
  return router;
}

export function createAdminInventoryRouter(service: InventoryService, auth: AuthService) {
  const router = Router();
  const controller = createInventoryController(service);
  router.use(authenticate(auth), adminAccess());
  router.get(
    "/:variantId/movements",
    validateRequest({ params: variantIdParams, query: movementsQuery }),
    controller.movementList,
  );
  router.get("/:variantId", validateRequest({ params: variantIdParams }), controller.adminGet);
  router.post(
    "/:variantId/inbound",
    validateRequest({ params: variantIdParams, body: inboundBody }),
    controller.inbound,
  );
  router.post(
    "/:variantId/adjust",
    validateRequest({ params: variantIdParams, body: adjustBody }),
    controller.adjust,
  );
  return router;
}
