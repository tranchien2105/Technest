import { adminAccess } from "../admin-operations/permissions.js";
import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middlewares/validate-request.js";
import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import { createAdminController } from "./admin.controller.js";
import { createAdminService } from "./admin.service.js";
import { createAdminCatalogService } from "./admin.catalog.service.js";
import { createAdminCatalogController } from "./admin.catalog.controller.js";
import { createAdminSettingsService } from "./admin.settings.service.js";
import { storeSettingsInput } from "./admin.settings.schemas.js";
import { sendData } from "../../shared/response.js";
import { adminIdParams, adminListQuery, productListQuery, brandInput, categoryInput, customerListQuery, customerStatusInput, productInput } from "./admin.catalog.schemas.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../database/schema/index.js";

const listQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(500).default(50), q: z.string().trim().max(160).optional(), lowStock: z.enum(["true", "false"]).optional().transform((value) => value === "true"), stock: z.enum(["in", "low", "out"]).optional(), status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional() });

export function createAdminRouter(db: NodePgDatabase<typeof schema>, auth: AuthService, notify?: Parameters<typeof createAdminCatalogController>[1]) {
  const router = Router();
  const controller = createAdminController(createAdminService(db));
  const catalog = createAdminCatalogController(createAdminCatalogService(db), notify);
  router.use(authenticate(auth), adminAccess());
  router.get("/overview", controller.overview);
  const settings = createAdminSettingsService(db);
  router.get("/settings", async (_request, response) => sendData(response, await settings.get()));
  router.patch("/settings", validateRequest({ body: storeSettingsInput }), async (_request, response) => {
    const user = response.locals.user as { id: number };
    sendData(response, await settings.update(response.locals.validated.body, user.id));
  });
  router.get("/inventory", validateRequest({ query: listQuery }), controller.inventory);
  router.get("/customers", validateRequest({ query: customerListQuery }), controller.customers);
  router.get("/customers/:id", validateRequest({ params: adminIdParams }), catalog.customerDetail);
  router.patch("/customers/:id/status", validateRequest({ params: adminIdParams, body: customerStatusInput }), catalog.customerStatus);

  router.get("/products", validateRequest({ query: productListQuery }), catalog.productList);
  router.post("/products", validateRequest({ body: productInput }), catalog.productCreate);
  router.get("/products/:id", validateRequest({ params: adminIdParams }), catalog.productDetail);
  router.patch("/products/:id", validateRequest({ params: adminIdParams, body: productInput }), catalog.productUpdate);
  router.delete("/products/:id", validateRequest({ params: adminIdParams }), catalog.productArchive);

  router.get("/categories", validateRequest({ query: adminListQuery }), catalog.categoryList);
  router.post("/categories", validateRequest({ body: categoryInput }), catalog.categoryCreate);
  router.patch("/categories/:id", validateRequest({ params: z.object({ id: z.string().uuid() }), body: categoryInput }), catalog.categoryUpdate);
  router.delete("/categories/:id", validateRequest({ params: z.object({ id: z.string().uuid() }) }), catalog.categoryDelete);

  router.get("/brands", validateRequest({ query: adminListQuery }), catalog.brandList);
  router.post("/brands", validateRequest({ body: brandInput }), catalog.brandCreate);
  router.patch("/brands/:id", validateRequest({ params: adminIdParams, body: brandInput }), catalog.brandUpdate);
  router.delete("/brands/:id", validateRequest({ params: adminIdParams }), catalog.brandDelete);
  return router;
}
