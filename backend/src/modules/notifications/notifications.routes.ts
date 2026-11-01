import { Router } from "express";
import { validateRequest } from "../../middlewares/validate-request.js";
import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import type { NotificationsService } from "./notifications.service.js";
import { notificationIdSchema, notificationsQuerySchema } from "./notification.schemas.js";
import { createNotificationsController } from "./notifications.controller.js";

export function createNotificationsRouter(service: NotificationsService, auth: AuthService) {
  const router = Router();
  const controller = createNotificationsController(service);
  router.use(authenticate(auth));
  router.get("/", validateRequest({ query: notificationsQuerySchema }), controller.list);
  router.get("/unread-count", controller.unreadCount);
  router.patch("/read-all", controller.markAllRead);
  router.patch("/:id/read", validateRequest({ params: notificationIdSchema }), controller.markRead);
  return router;
}
