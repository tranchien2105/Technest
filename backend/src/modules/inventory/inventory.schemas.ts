import { z } from "zod";

const pgBigintId = z
  .string()
  .regex(/^\d+$/)
  .refine((id) => {
    try {
      return BigInt(id) > 0n && BigInt(id) <= 9_223_372_036_854_775_807n;
    } catch {
      return false;
    }
  }, "Expected a positive BIGINT ID");
const quantity = z.number().int().min(1).max(2_147_483_647);
const reference = z
  .object({ type: z.string().trim().min(1).max(80), id: z.string().trim().min(1).max(180) })
  .optional();
const idempotencyKey = z.string().trim().min(1).max(200).optional();

export const variantIdParams = z.object({ variantId: pgBigintId });
export const reservationIdParams = z.object({ reservationId: pgBigintId });
export const skuParams = z.object({ sku: z.string().trim().min(1).max(100) });

export const inboundBody = z.object({ quantity, idempotencyKey, reference });
export const adjustBody = z.object({
  newQuantity: z.number().int().min(0).max(2_147_483_647),
  idempotencyKey,
  reference,
});
export const movementsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
