import { z } from "zod";

export const notificationTypes = [
  "ORDER_STATUS_UPDATED", "ORDER_CANCELLED", "ORDER_DELIVERED",
  "PROMOTION_AVAILABLE", "PROMOTION_EXPIRING", "PAYMENT_SUCCEEDED", "PAYMENT_FAILED",
  "ACCOUNT_UPDATED", "ACCOUNT_LOCKED", "SECURITY_ALERT", "SYSTEM_ANNOUNCEMENT",
] as const;

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(notificationTypes).optional(),
  category: z.enum(["ORDERS", "PROMOTIONS", "ACCOUNT", "SYSTEM"]).optional(),
  unread: z.enum(["true", "false"]).optional(),
});

export const notificationIdSchema = z.object({ id: z.string().regex(/^[1-9]\d{0,18}$/).refine((id) => BigInt(id) <= 9223372036854775807n) });
