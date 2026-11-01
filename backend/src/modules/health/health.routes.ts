import { Router } from "express";
import { createHealthController } from "./health.controller.js";
import { createHealthService, type HealthDependencies } from "./health.service.js";

export function createHealthRouter(dependencies: HealthDependencies) {
  const router = Router();
  router.get("/", createHealthController(createHealthService(dependencies)));
  return router;
}
