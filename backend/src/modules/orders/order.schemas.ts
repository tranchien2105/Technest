import { z } from "zod";

const positiveId = z.string().regex(/^[1-9]\d{0,18}$/).refine((value) => BigInt(value) <= 9223372036854775807n, "ID exceeds BIGINT range");
const orderItemsSchema = z.array(z.object({ variantId: positiveId, quantity: z.number().int().min(1).max(100) })).min(1).max(50);
const addressSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,30}$/),
  address: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(120),
  district: z.string().trim().max(120).optional(),
  ward: z.string().trim().max(120).optional(),
});

export const checkoutPreviewSchema = z.object({ items: orderItemsSchema, shippingAddress: addressSchema, voucherCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/).optional() });
export const createOrderSchema = checkoutPreviewSchema.extend({
  paymentMethod: z.literal("COD").default("COD"),
  customerNote: z.string().trim().max(1000).optional(),
});
export const orderIdSchema = z.object({ id: positiveId });
export const transitionSchema = z.object({
  status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  note: z.string().trim().max(500).optional(),
});
export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(160).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
});
export const adminListOrdersQuerySchema = listOrdersQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  paymentStatus: z.enum(["UNPAID", "PAID"]).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
}).refine((input) => !input.dateFrom || !input.dateTo || input.dateFrom <= input.dateTo,
  { path: ["dateTo"], message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu" });
export const idempotencyKeySchema = z.string().trim().min(8).max(160);
