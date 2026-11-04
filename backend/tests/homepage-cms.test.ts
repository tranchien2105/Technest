import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homepageConfigSchema } from "../src/modules/homepage-cms/homepage-cms.schemas.js";

const keys = ["categories", "featured", "deals", "flash-sale", "campaigns", "promotional-banners", "style", "trending", "new-arrivals", "trusted-brands", "feature-banner", "services", "shopping-guide", "bottom-banners", "popular-searches"] as const;
const config = {
  announcement: { visible: true, text: "Thông tin giao hàng", href: "/products" },
  sections: Object.fromEntries(keys.map((key) => [key, { visible: true, title: key, description: "", limit: 8 }])) as Record<(typeof keys)[number], { visible: boolean; title: string; description: string; limit: number }>,
  sectionOrder: [...keys],
};

describe("Homepage CMS config validation", () => {
  it("accepts the fixed, typed content model", () => {
    expect(homepageConfigSchema.safeParse(config).success).toBe(true);
  });

  it("rejects script URLs, unknown fields, and duplicate section order", () => {
    expect(homepageConfigSchema.safeParse({ ...config, announcement: { ...config.announcement, href: "javascript:alert(1)" } }).success).toBe(false);
    expect(homepageConfigSchema.safeParse({ ...config, executable: "<script>" }).success).toBe(false);
    expect(homepageConfigSchema.safeParse({ ...config, sectionOrder: keys.map(() => "featured") }).success).toBe(false);
  });

  it("bounds product limits and content lengths", () => {
    expect(homepageConfigSchema.safeParse({ ...config, sections: { ...config.sections, featured: { visible: true, title: "Featured", description: "", limit: 100 } } }).success).toBe(false);
  });

  it("seeds valid existing Homepage copy as both initial states", () => {
    const sql = readFileSync(fileURLToPath(new URL("../src/database/migrations/0014_homepage_cms.sql", import.meta.url)), "utf8");
    const rows = [...sql.matchAll(/'({"announcement".*?})'::jsonb/g)].map((match) => JSON.parse(match[1]!));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(rows[1]);
    const migration = readFileSync(fileURLToPath(new URL("../src/database/migrations/0017_flash_sales.sql", import.meta.url)), "utf8");
    expect(migration).toContain("{sections,flash-sale}");
    const upgraded = rows.map((row) => ({ ...row, sections: { ...row.sections, "flash-sale": { visible: true, title: "Flash Sale", description: "", ctaLabel: "Xem tất cả", ctaUrl: "/flash-sale", limit: 4 } }, sectionOrder: [...row.sectionOrder, "flash-sale"] }));
    expect(upgraded.every((row) => homepageConfigSchema.safeParse(row).success)).toBe(true);
  });

  it("accepts only the three editable setup cards and safe image URLs", () => {
    const cards = ["work", "gaming", "audio"].map((key) => ({
      key,
      eyebrow: key,
      title: key,
      titleEn: key,
      description: "Mô tả",
      descriptionEn: "Description",
      imageUrl: "https://images.example.test/card.jpg",
      categorySlug: "accessories",
    }));
    const next = {
      ...config,
      sections: {
        ...config.sections,
        style: { ...config.sections.style, cards },
        "feature-banner": { ...config.sections["feature-banner"], imageUrl: "/images/banner.jpg" },
      },
    };
    expect(homepageConfigSchema.safeParse(next).success).toBe(true);
    expect(homepageConfigSchema.safeParse({ ...next, sections: { ...next.sections, style: { ...next.sections.style, cards: [...cards, cards[0]] } } }).success).toBe(false);
    expect(homepageConfigSchema.safeParse({ ...next, sections: { ...next.sections, style: { ...next.sections.style, cards: cards.map((card) => ({ ...card, imageUrl: "javascript:alert(1)" })) } } }).success).toBe(false);
  });

  it("adds default card content without replacing existing custom values", () => {
    const sql = readFileSync(fileURLToPath(new URL("../src/database/migrations/0015_homepage_visual_cards.sql", import.meta.url)), "utf8");
    expect(sql).toContain("style,cards");
    expect(sql).toContain("feature-banner,imageUrl");
    expect(sql).toContain("IS NULL");
    expect(sql).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM/i);
  });
});
