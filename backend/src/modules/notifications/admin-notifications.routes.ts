import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middlewares/validate-request.js";
import { sendData } from "../../shared/response.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import type { NotificationsService } from "./notifications.service.js";
import type { NotificationsService as ServiceType } from "./notifications.service.js";

const announcementSchema = z.object({
  title: z.string().trim().min(4).max(180),
  message: z.string().trim().min(8).max(2000),
  recipientUserIds: z.array(z.string().regex(/^[1-9]\d{0,15}$/).refine((id) => Number(id) <= Number.MAX_SAFE_INTEGER)).min(1).max(100),
  eventKey: z.string().trim().min(8).max(120),
  targetUrl: z.string().max(500).startsWith("/").refine((value) => !value.startsWith("//") && !value.includes("\\")).optional(),
});

export function createAdminNotificationsRouter(service: NotificationsService, auth: AuthService, publish: (recipientUserId: string, notification: NonNullable<Awaited<ReturnType<ServiceType["createNotification"]>>>) => void = () => {}) {
  const router = Router();
  router.use(authenticate(auth), authorize("ADMIN"));
  router.post("/announcements", validateRequest({ body: announcementSchema }), async (_request, response) => {
    const input = response.locals.validated.body as z.infer<typeof announcementSchema>;
    const rows = await service.createForUsers(input.recipientUserIds, {
      type: "SYSTEM_ANNOUNCEMENT", title: input.title, message: input.message,
      ...(input.targetUrl ? { targetUrl: input.targetUrl } : {}), eventKey: `announcement:${input.eventKey}`,
    });
    for (const { recipientUserId, notification } of rows) publish(recipientUserId, notification);
    sendData(response, { created: rows.length });
  });
  return router;
}
