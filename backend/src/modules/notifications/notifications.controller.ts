import type { RequestHandler } from "express";
import type { SafeUser } from "../auth/auth.service.js";
import { sendData } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import type { NotificationsService } from "./notifications.service.js";

export function createNotificationsController(service: NotificationsService) {
  const list: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    const query = response.locals.validated.query;
    const unread = query.unread === undefined ? undefined : query.unread === "true";
    sendData(response, await service.getNotifications(user.id, { ...query, unread }));
  };
  const unreadCount: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    sendData(response, { unreadCount: await service.getUnreadCount(user.id) });
  };
  const markRead: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    const result = await service.markAsRead(user.id, response.locals.validated.params.id);
    if (!result) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.");
    sendData(response, result);
  };
  const markAllRead: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    sendData(response, await service.markAllAsRead(user.id));
  };
  return { list, unreadCount, markRead, markAllRead };
}
