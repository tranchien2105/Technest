import { describe, expect, it } from "vitest";
import { CURATED_PRODUCTS, ROOT_BRANDS, ROOTS, STOREFRONT_BATCH, storefrontFixture } from "../src/database/seeds/storefront-demo-data.js";
import { listBrandsSchema, listProductsSchema } from "../src/modules/catalog/catalog.schemas.js";

describe("storefront fixtures and defaults", () => {
  it("uses a stable curated model list with valid brand/category mapping and category illustrations", () => {
    const rows = CURATED_PRODUCTS.map((_, i) => storefrontFixture(i));
    expect(rows.length).toBe(60);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
    expect(new Set(rows.map((row) => row.name.toLowerCase())).size).toBe(rows.length);
    expect(new Set(rows.map((row) => row.brandSlug)).size).toBeGreaterThan(30);
    expect(rows.every((row) => ROOT_BRANDS[row.root].includes(row.brandSlug))).toBe(true);
    expect(rows.every((row) => row.slug.startsWith(`${STOREFRONT_BATCH}-`) && row.sku.startsWith("TNQ26-") && row.price > 0)).toBe(true);
    expect(rows.every((row) => row.image.includes(`/images/storefront-curated/${row.imageKey}.svg`))).toBe(true);
    expect(new Set(rows.map((row) => row.imageKey)).size).toBeGreaterThan(8);
    for (const root of ROOTS) expect(rows.filter((row) => row.root === root)).toHaveLength(12);
    expect(JSON.stringify(storefrontFixture(31))).toBe(JSON.stringify(storefrontFixture(31)));
    expect(storefrontFixture(31).sku).toBe(storefrontFixture(31).sku);
    expect(storefrontFixture(31).image).toBe(storefrontFixture(31).image);
    expect(rows.every((row) => row.description.includes("giá và tồn kho chỉ phục vụ môi trường phát triển"))).toBe(true);
    expect(rows.some((row) => row.name.includes("Demo") || row.name.includes("Willow"))).toBe(false);
  });
  it("defaults newest and validates explicit sorts and bounded brands pagination", () => {
    expect(listProductsSchema.parse({}).sort).toBe("newest");
    expect(listProductsSchema.parse({ sort: "recommended" }).sort).toBe("recommended");
    expect(listProductsSchema.parse({ sort: "priceLow", category: "mice", brand: "demo-brand" })).toMatchObject({ sort: "priceLow", category: "mice", brand: "demo-brand" });
    expect(listBrandsSchema.safeParse({ limit: 2000 }).success).toBe(false);
    expect(listBrandsSchema.parse({ page: "2", limit: "10", q: "Sony" })).toMatchObject({ page: 2, limit: 10, q: "Sony" });
  });
});
