import { imageUrl } from "../admin/admin.catalog.schemas.js";
import { z } from "zod";

export const orderEmailEventSchema = z.enum([
  "ORDER_PLACED",
  "ORDER_CONFIRMED",
  "ORDER_PROCESSING",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
]);
export type OrderEmailEvent = z.infer<typeof orderEmailEventSchema>;

const money = z.string().regex(/^\d+$/);

export const orderEmailPayloadSchema = z.object({
  orderNumber: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(220),
        sku: z.string().max(100).default(""),
        imageUrl: imageUrl.optional(),
        quantity: z.number().int().positive(),
        unitPrice: money,
      }),
    )
    .default([]),
  subtotal: money.default("0"),
  shipping: money.default("0"),
  discount: money.default("0"),
  total: money.default("0"),
  shippingAddress: z
    .object({
      recipient: z.string().max(200).default(""),
      phone: z.string().max(40).default(""),
      line1: z.string().max(300).default(""),
      line2: z.string().max(300).optional(),
      ward: z.string().max(120).optional(),
      district: z.string().max(120).optional(),
      city: z.string().max(120).default(""),
      postalCode: z.string().max(30).optional(),
    })
    .default({ recipient: "", phone: "", line1: "", city: "" }),
  shipment: z
    .object({
      carrierName: z.string().max(160).optional(),
      trackingNumber: z.string().max(160).optional(),
      trackingUrl: z.string().url().optional(),
    })
    .optional(),
});
export type OrderEmailPayload = z.infer<typeof orderEmailPayloadSchema>;

export const orderEmailJobSchema = z.object({ outboxId: z.string().regex(/^\d+$/) });
export type OrderEmailJob = z.infer<typeof orderEmailJobSchema>;
