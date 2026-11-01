import { z } from "zod";

const id = z.string().trim().min(1).max(40);
const slug = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const money = z.string().regex(/^\d{1,20}$/);
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(500).default(50);
const status = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export const imageUrl = z.string().trim().min(1).max(2048).refine((value) => {
  if (value.startsWith("/images/")) return !value.includes("\\") && ![...value].some((character) => character.charCodeAt(0) <= 32)
    && new URL(value, "https://technest.invalid").pathname.startsWith("/images/") && !value.split("/").includes("..");
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Dùng đường dẫn https://… hoặc ảnh trong /images/…");

export const adminListQuery = z.object({ page, limit, q: z.string().trim().max(160).optional(), status: status.optional(),
  usage: z.enum(["used", "unused"]).optional(), level: z.enum(["root", "child"]).optional() });
export const productListQuery = adminListQuery.extend({
  categoryId: z.string().uuid().optional(),
  brandId: z.string().regex(/^[1-9]\d{0,18}$/).refine((value) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n).optional(),
  stock: z.enum(["in", "low", "out"]).optional(),
  minPrice: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  maxPrice: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  sort: z.enum(["newest", "oldest", "name", "priceAsc", "priceDesc"]).default("newest"),
}).refine((input) => input.minPrice === undefined || input.maxPrice === undefined || input.minPrice <= input.maxPrice,
  { path: ["maxPrice"], message: "Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu" });
export const customerListQuery = z.object({ page, limit, q: z.string().trim().max(160).optional(), status: z.enum(["ACTIVE", "BLOCKED"]).optional() });
export const adminIdParams = z.object({ id });

const variantInput = z.object({
  id: z.string().regex(/^\d+$/).optional(),
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(180),
  price: money.optional(),
  compareAtPrice: money.nullable().optional(),
  status: status.default("ACTIVE"),
  attributes: z.record(z.string(), z.unknown()).default({}),
  initialStock: z.number().int().min(0).max(2_147_483_647).default(0),
});

export const productInput = z.object({
  slug,
  name: z.string().trim().min(2).max(220),
  description: z.string().max(20_000).default(""),
  categoryId: z.string().uuid(),
  brandId: z.string().regex(/^\d+$/),
  price: money,
  compareAtPrice: money.nullable().optional(),
  status: status.default("ACTIVE"),
  badge: z.string().trim().max(24).nullable().optional(),
  isFeatured: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  attributes: z.record(z.string(), z.unknown()).default({}),
  compatibleWith: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  images: z.array(z.object({ url: imageUrl, altText: z.string().max(220).optional() })).max(20).default([]),
  variants: z.array(variantInput).min(1).max(50),
}).superRefine((product, context) => {
  if (product.status === "ACTIVE" && product.images.length === 0) context.addIssue({ code: "custom", path: ["images"], message: "Active products must include a gallery image" });
});

export const categoryInput = z.object({
  name: z.string().trim().min(2).max(100),
  nameEn: z.string().trim().max(100).default(""),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentCategoryId: z.string().uuid().nullable().optional(),
});

export const brandInput = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const customerStatusInput = z.object({ status: z.enum(["ACTIVE", "BLOCKED"]) });
