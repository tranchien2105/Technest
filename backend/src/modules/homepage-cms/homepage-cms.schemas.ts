import { z } from "zod";

const safeUrl = z.string().max(500).refine((value) => value === "" || value.startsWith("/") || value.startsWith("#") || /^https:\/\//i.test(value), "Chỉ cho phép đường dẫn nội bộ, anchor hoặc HTTPS.");
const sectionKeys = ["categories", "featured", "deals", "flash-sale", "campaigns", "promotional-banners", "style", "trending", "new-arrivals", "trusted-brands", "feature-banner", "services", "shopping-guide", "bottom-banners", "popular-searches"] as const;
const section = z.object({
  visible: z.boolean(),
  eyebrow: z.string().trim().max(80).optional(),
  title: z.string().trim().max(120),
  description: z.string().trim().max(500),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: safeUrl.optional(),
  limit: z.number().int().min(1).max(24),
  categorySlugs: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(30).optional(),
  brandSlugs: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(30).optional(),
  productIds: z.array(z.string().regex(/^\d{1,19}$/)).max(24).optional(),
  sort: z.enum(["recommended", "newest", "priceLow", "priceHigh"]).optional(),
  imageUrl: safeUrl.optional(),
  cards: z.array(z.object({
    key: z.enum(["work", "gaming", "audio"]),
    eyebrow: z.string().trim().max(40),
    title: z.string().trim().max(100),
    titleEn: z.string().trim().max(100),
    description: z.string().trim().max(240),
    descriptionEn: z.string().trim().max(240),
    imageUrl: safeUrl,
    categorySlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  }).strict()).length(3).optional(),
}).strict();

export const homepageConfigSchema = z.object({
  announcement: z.object({ visible: z.boolean(), text: z.string().trim().max(180), href: safeUrl }).strict(),
  sections: z.record(z.enum(sectionKeys), section),
  sectionOrder: z.array(z.enum(sectionKeys)).length(sectionKeys.length).refine((items) => new Set(items).size === sectionKeys.length, "Thứ tự section không hợp lệ."),
}).strict();

export type HomepageConfig = z.infer<typeof homepageConfigSchema>;
