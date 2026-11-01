import type { RequestHandler } from "express";
import { sendData } from "../../shared/response.js";
import type { SafeUser } from "../auth/auth.service.js";
import type { OrdersService } from "./orders.service.js";
import { idempotencyKeySchema } from "./order.schemas.js";
import { AppError } from "../../shared/errors.js";

export type OrderStatusNotifier = (payload: { userId: string; orderId: string; orderNumber: string; status: string; updatedAt: string; notification?: Awaited<ReturnType<OrdersService["transition"]>>["notification"] }) => void;

export function createOrdersController(service: OrdersService, notify: OrderStatusNotifier = () => {}) {
  const create: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    const input = response.locals.validated.body;
    const headerKey = idempotencyKeySchema.safeParse(response.req.get("Idempotency-Key"));
    if (!headerKey.success) throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required");
    const result = await service.create({ ...input, idempotencyKey: headerKey.data }, user);
    sendData(response, result.order, result.replayed ? 200 : 201);
  };
  const preview: RequestHandler = async (_request, response) => sendData(response, await service.preview(response.locals.validated.body, (response.locals.user as SafeUser).id));
  const myList: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    const { page, limit } = response.locals.validated.query;
    sendData(response, await service.listForCustomer(user.id, page, limit, response.locals.validated.query));
  };
  const myDetail: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    const { id } = response.locals.validated.params;
    sendData(response, await service.detailForCustomer(user.id, id));
  };
  const adminList: RequestHandler = async (_request, response) => sendData(response, await service.listForAdmin(response.locals.validated.query));
  const adminDetail: RequestHandler = async (_request, response) => sendData(response, await service.detailForAdmin(response.locals.validated.params.id));
  const changeStatus: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    const { id } = response.locals.validated.params;
    const { status, note } = response.locals.validated.body;
    const result = await service.transition(id, status, user.id, note);
    if (result.changed && result.order?.userId) notify({ userId: result.order.userId, orderId: result.order.id, orderNumber: result.order.orderNumber, status: result.order.status, updatedAt: result.order.updatedAt, notification: result.notification });
    sendData(response, result.order);
  };
  const cancel: RequestHandler = async (_request, response) => {
    const user = response.locals.user as SafeUser;
    const { id } = response.locals.validated.params;
    const result = await service.transition(id, "CANCELLED", user.id, "Cancelled by customer", user.id);
    if (result.changed && result.order) notify({ userId: result.order.userId, orderId: result.order.id, orderNumber: result.order.orderNumber, status: result.order.status, updatedAt: result.order.updatedAt, notification: result.notification });
    sendData(response, result.order);
  };
  return { create, preview, myList, myDetail, adminList, adminDetail, changeStatus, cancel };
}
