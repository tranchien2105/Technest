import { Router } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { sendData } from "../../shared/response.js";
import type { FlashSalesService } from "./flash-sales.service.js";
import { campaignId, campaignInput, campaignList, campaignUpdate } from "./flash-sales.schemas.js";
import type { SafeUser } from "../auth/auth.service.js";

export function createPublicFlashSalesRouter(service: FlashSalesService) {
  const router = Router();
  router.get("/flash-sales/events", (_request, response) => {
    response.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    response.flushHeaders();
    response.write(": connected\n\n");
    const unsubscribe = service.subscribe((event, payload) => response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 25_000);
    heartbeat.unref();
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(heartbeat);
      unsubscribe();
      response.off("close", cleanup);
      response.socket?.off("close", cleanup);
    };
    response.on("close", cleanup);
    response.socket?.on("close", cleanup);
  });
  router.get("/flash-sales", async (_request, response) => sendData(response, await service.listPublic()));
  router.get("/flash-sales/:id", validateRequest({ params: campaignId }), async (_request, response) => sendData(response, await service.publicDetail(response.locals.validated.params.id)));
  return router;
}

export function createAdminFlashSalesRouter(service: FlashSalesService) {
  const router = Router();
  router.get("/", validateRequest({ query: campaignList }), async (_request, response) => sendData(response, await service.listAdmin(response.locals.validated.query.status)));
  router.get("/:id", validateRequest({ params: campaignId }), async (_request, response) => sendData(response, await service.detail(response.locals.validated.params.id)));
  router.post("/", validateRequest({ body: campaignInput }), async (_request, response) => sendData(response, await service.create(response.locals.validated.body, response.locals.user as SafeUser), 201));
  router.patch("/:id", validateRequest({ params: campaignId, body: campaignUpdate }), async (_request, response) => sendData(response, await service.update(response.locals.validated.params.id, response.locals.validated.body)));
  router.delete("/:id", validateRequest({ params: campaignId }), async (_request, response) => { await service.remove(response.locals.validated.params.id); sendData(response, { cancelled: true }); });
  return router;
}
