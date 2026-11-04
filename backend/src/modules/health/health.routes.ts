import { Router } from "express";
import { createHealthController } from "./health.controller.js";
import { createHealthService, type HealthDependencies } from "./health.service.js";
import { sendData } from "../../shared/response.js";

export function createHealthRouter(dependencies: HealthDependencies) {
  const router = Router();
  const readiness = createHealthController(createHealthService(dependencies));
  router.get("/live", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    sendData(response, { status: "ok", timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
  });
  router.get("/ready", readiness);
  router.get("/", readiness);
  return router;
}
