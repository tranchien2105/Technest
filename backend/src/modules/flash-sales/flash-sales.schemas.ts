import { z } from "zod";

const id = z.string().regex(/^[1-9]\d{0,18}$/).refine((value) => BigInt(value) <= 9223372036854775807n);
const item = z.object({ variantId: id, flashPrice: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), quota: z.number().int().min(0).max(2_147_483_647), perCustomerLimit: z.number().int().min(1).max(100), sortOrder: z.number().int().min(0).max(10000).default(0) });
const campaignBase = z.object({ name: z.string().trim().min(2).max(160), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180).optional(), description: z.string().max(5000).default(""), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "CANCELLED"]).default("DRAFT"), items: z.array(item).min(1).max(100) });
export const campaignInput = campaignBase.refine((input) => new Date(input.startsAt) < new Date(input.endsAt), { path: ["endsAt"], message: "Thời điểm kết thúc phải sau thời điểm bắt đầu" });
export const campaignUpdate = campaignBase.partial().extend({ items: z.array(item).min(1).max(100).optional() }).refine((input) => !input.startsAt || !input.endsAt || new Date(input.startsAt) < new Date(input.endsAt), { path: ["endsAt"], message: "Thời điểm kết thúc phải sau thời điểm bắt đầu" });
export const campaignId = z.object({ id });
export const campaignList = z.object({ status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ENDED", "CANCELLED"]).optional() });
