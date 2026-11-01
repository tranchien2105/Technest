import { adminAccess } from "../admin-operations/permissions.js";
import { Router } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import { checkoutPreviewSchema, createOrderSchema, listOrdersQuerySchema, adminListOrdersQuerySchema, orderIdSchema, transitionSchema } from "./order.schemas.js";
import { createOrdersController, type OrderStatusNotifier } from "./orders.controller.js";
import type { OrdersService } from "./orders.service.js";
import type { OrderEventHub } from "./order-events.js";
import type { SafeUser } from "../auth/auth.service.js";

function eventStream(hub: OrderEventHub, admin: boolean) {
  return (_request: import("express").Request, response: import("express").Response) => {
    const user = response.locals.user as SafeUser;
    response.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    response.flushHeaders();
    response.write(": connected\n\n");
    const unsubscribe = hub.subscribe({ ...(admin ? {} : { userId: String(user.id) }), admin, send: (event) => response.write(`event: order:status-updated\ndata: ${JSON.stringify(event)}\n\n`) });
    const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 25_000);
    heartbeat.unref();
    response.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
  };
}

export function createCustomerOrdersRouter(service: OrdersService, auth: AuthService, hub: OrderEventHub, notify?: OrderStatusNotifier) {
  const router = Router();
  const controller = createOrdersController(service, notify);
  router.use(authenticate(auth));
  router.get("/events", eventStream(hub, false));
  router.post("/", validateRequest({ body: createOrderSchema }), controller.create);
  router.get("/", validateRequest({ query: listOrdersQuerySchema }), controller.myList);
  router.get("/:id", validateRequest({ params: orderIdSchema }), controller.myDetail);
  router.post("/:id/cancel", validateRequest({ params: orderIdSchema }), controller.cancel);
  return router;
}

export function createAdminOrdersRouter(service: OrdersService, auth: AuthService, hub: OrderEventHub, notify?: OrderStatusNotifier) {
  const router = Router();
  const controller = createOrdersController(service, notify);
  router.use(authenticate(auth), adminAccess());
  router.get("/events", eventStream(hub, true));
  router.get("/", validateRequest({ query: adminListOrdersQuerySchema }), controller.adminList);
  router.get("/:id", validateRequest({ params: orderIdSchema }), controller.adminDetail);
  router.patch("/:id/status", validateRequest({ params: orderIdSchema, body: transitionSchema }), controller.changeStatus);
  return router;
}

export function createCheckoutRouter(service: OrdersService, auth: AuthService) {
  const router = Router();
  router.post("/preview", authenticate(auth), validateRequest({ body: checkoutPreviewSchema }), createOrdersController(service).preview);
  return router;
}
