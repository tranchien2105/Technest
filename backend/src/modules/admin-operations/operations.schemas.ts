import { z } from "zod";
import { imageUrl } from "../admin/admin.catalog.schemas.js";
import { idString, money } from "./common.js";
import { permissionKeys } from "./permissions.js";
export const bannerInput = z
  .object({
    title: z.string().trim().min(2).max(160),
    subtitle: z.string().max(1000).default(""),
    imageUrl,
    link: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")),
    buttonText: z.string().trim().min(1).max(60).default("Khám phá ngay"),
    position: z.enum(["HOME_HERO", "HOME_HERO_RIGHT_TOP", "HOME_HERO_RIGHT_BOTTOM", "HOME_PROMO", "HOME_BOTTOM", "HOME_SETUP_STUDIO"]).nullable().default("HOME_PROMO"),
    sortOrder: z.number().int().min(0).max(999).default(0),
    active: z.boolean().default(true),
    startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.startsAt) < new Date(v.endsAt), {
    path: ["endsAt"],
    message: "Ngày kết thúc phải sau ngày bắt đầu",
  });
export const bannerPlacementsInput = z.object({
  placements: z.object({
    HOME_HERO: z.array(idString).max(100),
    HOME_HERO_RIGHT_TOP: z.array(idString).max(100),
    HOME_HERO_RIGHT_BOTTOM: z.array(idString).max(100),
    HOME_PROMO: z.array(idString).max(100),
    HOME_BOTTOM: z.array(idString).max(100),
    HOME_SETUP_STUDIO: z.array(idString).max(100),
  }),
}).superRefine(({ placements }, ctx) => {
  const ids = Object.values(placements).flat();
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Một banner không thể được gán nhiều vị trí cùng lúc." });
});
export const voucherInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/),
    name: z.string().trim().min(2).max(160),
    type: z.enum(["FIXED", "PERCENT"]),
    value: money.refine((v) => BigInt(v) > 0n),
    minSubtotal: money.default("0"),
    maxDiscount: money.nullable().default(null),
    usageLimit: z.number().int().min(1).max(1000000),
    perUserLimit: z.number().int().min(1).max(1000).default(1),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    active: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PERCENT" && BigInt(v.value) > 100n)
      ctx.addIssue({ code: "custom", path: ["value"], message: "Giảm phần trăm tối đa 100%" });
    if (new Date(v.startsAt) >= new Date(v.endsAt))
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Ngày kết thúc phải sau ngày bắt đầu",
      });
    if (v.maxDiscount !== null && BigInt(v.maxDiscount) <= 0n)
      ctx.addIssue({
        code: "custom",
        path: ["maxDiscount"],
        message: "Mức giảm tối đa phải lớn hơn 0",
      });
  });
export const bulkInput = z
  .object({
    ids: z
      .array(idString)
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length),
    key: z.string().min(8).max(160),
    action: z.enum(["STATUS", "CATEGORY", "BRAND", "PRICE"]),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
    categoryId: z.string().uuid().optional(),
    brandId: idString.optional(),
    price: money.optional(),
    priceMode: z.enum(["SET", "INCREASE_PERCENT", "DECREASE_PERCENT"]).default("SET"),
    includeVariants: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (
      (v.action === "STATUS" && !v.status) ||
      (v.action === "CATEGORY" && !v.categoryId) ||
      (v.action === "BRAND" && !v.brandId) ||
      (v.action === "PRICE" && v.price === undefined)
    )
      ctx.addIssue({ code: "custom", message: "Chọn giá trị cập nhật" });
    if (v.action === "PRICE" && v.priceMode !== "SET" && BigInt(v.price || "0") > 100n)
      ctx.addIssue({ code: "custom", path: ["price"], message: "Phần trăm từ 0 đến 100" });
  });
export const staffInput = z.object({
  email: z
    .email()
    .max(320)
    .transform((v) => v.toLowerCase()),
  fullName: z.string().trim().min(2).max(200),
  password: z.string().min(8).max(128).optional(),
  status: z.enum(["ACTIVE", "BLOCKED"]).default("ACTIVE"),
  permissions: z.array(z.string().refine((v) => permissionKeys.includes(v))).max(40),
});
export const afterSalesInput = z.object({
  orderId: idString,
  itemId: idString,
  type: z.enum(["RETURN", "WARRANTY"]),
  quantity: z.number().int().min(1).max(100),
  reason: z.string().trim().min(10).max(2000),
});
export const afterSalesUpdate = z
  .object({
    status: z.enum(["APPROVED", "RECEIVED", "RESOLVED", "REJECTED"]),
    adminNote: z.string().trim().max(2000).default(""),
    resolution: z.enum(["REFUND", "REPLACEMENT", "REPAIRED"]).nullable().default(null),
    refundAmount: money.default("0"),
    restock: z.boolean().default(false),
  })
  .refine((v) => v.status !== "RESOLVED" || v.resolution !== null, {
    path: ["resolution"],
    message: "Chọn kết quả xử lý",
  });
export const reportQuery = z
  .object({ dateFrom: z.iso.date().optional(), dateTo: z.iso.date().optional() })
  .refine(
    (v) =>
      !v.dateFrom ||
      !v.dateTo ||
      (v.dateFrom <= v.dateTo &&
        new Date(v.dateTo).getTime() - new Date(v.dateFrom).getTime() <= 366 * 86400000),
    { message: "Khoảng báo cáo hợp lệ tối đa 366 ngày" },
  );
