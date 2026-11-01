import type { RequestHandler } from "express";
import { sendData } from "../../shared/response.js";
import type { createHealthService } from "./health.service.js";

export function createHealthController(
  getHealth: ReturnType<typeof createHealthService>,
): RequestHandler {
  return async (_request, response) => {
    const health = await getHealth();
    response.setHeader("Cache-Control", "no-store");
    sendData(response, health, health.status === "ok" ? 200 : 503);
  };
}
