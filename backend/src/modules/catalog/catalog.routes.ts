import { Router } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { createCatalogController } from "./catalog.controller.js";
import type { createCatalogService } from "./catalog.service.js";
import { listProductsSchema, productIdSchema, listBrandsSchema } from "./catalog.schemas.js";

export function createCatalogRouter(service: ReturnType<typeof createCatalogService>) {
  const router = Router();
  const controller = createCatalogController(service);
  router.get("/categories", controller.categories);
  router.get("/brands", validateRequest({ query: listBrandsSchema }), controller.brands);
  router.get("/products", validateRequest({ query: listProductsSchema }), controller.list);
  router.get("/products/:id", validateRequest({ params: productIdSchema }), controller.detail);
  return router;
}
