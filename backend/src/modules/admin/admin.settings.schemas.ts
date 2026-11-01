import { z } from "zod";

const money = z.string().regex(/^\d{1,16}$/);
export const storeSettingsInput = z.object({
  storeName: z.string().trim().min(2).max(120),
  supportEmail: z.email().max(320),
  supportPhone: z.string().trim().max(30),
  standardShippingFee: money,
  freeShippingThreshold: money,
  codEnabled: z.boolean(),
});
