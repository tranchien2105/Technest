import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import { createDatabase } from "../src/config/database.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/config/logger.js";
import { createOrdersService } from "../src/modules/orders/orders.service.js";
import { createOrderEventHub } from "../src/modules/orders/order-events.js";
import { createApp } from "../src/app.js";

describe.skipIf(process.env.RUN_ADMIN_DB_READ_TESTS !== "1")("Admin PostgreSQL read APIs", () => {
  let pool: ReturnType<typeof createDatabase>["pool"] | undefined;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const env = loadEnv();
    if (env.NODE_ENV === "production") throw new Error("Development database required");
    const database = createDatabase(env.DATABASE_URL);
    pool = database.pool;
    const auth = { authenticate: async () => ({ id: 1, email: "admin@example.test", fullName: "Admin", phone: null, role: "ADMIN" as const, status: "ACTIVE" as const }) } as unknown as AuthService;
    app = createApp({ logger: createLogger("silent"), corsOrigin: env.CORS_ORIGIN,
      health: { postgres: async () => 1, redis: async () => "PONG" }, admin: { db: database.db, auth }, orders: { service: createOrdersService(database.db), auth, hub: createOrderEventHub(), notify: () => {} } });
  });

  afterAll(async () => { await pool?.end(); });

  it("serves overview, products, categories, brands, customers, stock and settings from PostgreSQL", async () => {
    const paths = ["overview", "products?page=1&limit=2", "categories?page=1&limit=2", "brands?page=1&limit=2", "customers?page=1&limit=2", "inventory?page=1&limit=2", "settings"];
    const responses = await Promise.all(paths.map((path) => request(app).get(`/api/v1/admin/${path}`).set("Authorization", "Bearer admin")));
    expect(responses.every((response) => response.status === 200), JSON.stringify(responses.map((response, index) => ({ path: paths[index], status: response.status, body: response.body })))).toBe(true);
    expect(responses[0]!.body.data.revenueSeries).toHaveLength(7);
    expect(responses[1]!.body.data.pagination.limit).toBe(2);
    expect(responses[2]!.body.data.items).toBeInstanceOf(Array);
    expect(responses[3]!.body.data.items).toBeInstanceOf(Array);
    expect(responses[4]!.body.data.items).toBeInstanceOf(Array);
    expect(responses[5]!.body.data.items).toBeInstanceOf(Array);
    expect(responses[6]!.body.data).toHaveProperty("freeShippingThreshold");
  });
  const get = (path: string) => request(app).get(`/api/v1/admin/${path}`).set("Authorization", "Bearer admin");

  it("supports all requested page sizes on every admin list, with consistent totals", async () => {
    for (const resource of ["products", "categories", "brands", "customers", "inventory", "orders"]) {
      let total: number | undefined;
      for (const limit of [50, 100, 200, 500]) {
        const response = await get(`${resource}?limit=${limit}`).expect(200);
        const data = response.body.data;
        expect(data.pagination.limit).toBe(limit);
        expect(data.items.length).toBe(Math.min(limit, data.pagination.total));
        expect(data.pagination.totalPages).toBe(Math.ceil(data.pagination.total / limit));
        if (total !== undefined) expect(data.pagination.total).toBe(total);
        total = data.pagination.total;
      }
      await get(`${resource}?limit=501`).expect(400);
    }
  }, 30000);

  it("combines catalog references, price, status and SKU search filters across the whole dataset", async () => {
    const first = await get("products?limit=1&status=ACTIVE").expect(200);
    if (!first.body.data.items.length) return;
    const detail = await get(`products/${first.body.data.items[0].id}`).expect(200);
    const product = detail.body.data;
    const params = new URLSearchParams({ limit: "500", categoryId: product.categoryId, brandId: product.brandId, minPrice: product.price, maxPrice: product.price, q: product.variants[0].sku, status: "ACTIVE" });
    const result = await get(`products?${params}`).expect(200);
    expect(result.body.data.items.some((item: { id: string }) => item.id === product.id)).toBe(true);
    expect(result.body.data.items.every((item: { price: string; status: string; brand: string; category: string }) => item.price === product.price && item.status === "ACTIVE" && item.brand === product.brand && item.category === product.category)).toBe(true);
    const categoryResponse = await get("categories?limit=500").expect(200);
    const leaf = categoryResponse.body.data.items.find((category: { id: string }) => category.id === product.categoryId);
    if (leaf?.parentCategoryId) {
      const parentResult = await get(`products?categoryId=${leaf.parentCategoryId}&q=${encodeURIComponent(product.variants[0].sku)}`).expect(200);
      expect(parentResult.body.data.items.some((item: { id: string }) => item.id === product.id)).toBe(true);
    }
    await get("products?minPrice=200&maxPrice=100").expect(400);
    await get("products?brandId=invalid").expect(400);
    for (const sort of ["priceAsc", "priceDesc"]) {
      const sorted = await get(`products?limit=100&sort=${sort}`).expect(200);
      const prices = sorted.body.data.items.map((item: { price: string }) => BigInt(item.price));
      expect(prices.every((price: bigint, index: number) => index === 0 || (sort === "priceAsc" ? price >= prices[index - 1] : price <= prices[index - 1]))).toBe(true);
    }
    const second = await get("products?limit=50&page=2").expect(200);
    const pageOne = await get("products?limit=50&page=1").expect(200);
    const ids = new Set(pageOne.body.data.items.map((item: { id: string }) => item.id));
    expect(second.body.data.items.every((item: { id: string }) => !ids.has(item.id))).toBe(true);
  });

  it("returns the primary image instead of the alphabetically first gallery URL", async () => {
    const response = await get("products?limit=50").expect(200);
    for (const item of response.body.data.items.slice(0, 10)) {
      const detail = await get(`products/${item.id}`).expect(200);
      const images = detail.body.data.images;
      const primary = images.find((image: { variantId: string | null }) => !image.variantId) || images[0];
      expect(item.image).toBe(primary?.url ?? null);
    }
  });

  it("filters inventory availability, customer status, catalog usage and category levels", async () => {
    for (const resource of ["products", "inventory"]) {
      for (const stock of ["in", "low", "out"]) {
        const response = await get(`${resource}?stock=${stock}&limit=100`).expect(200);
        expect(response.body.data.items.every((item: { available: number }) => stock === "out" ? item.available <= 0 : stock === "low" ? item.available > 0 && item.available <= 5 : item.available > 0)).toBe(true);
      }
    }
    const customers = await get("customers?status=BLOCKED&limit=500").expect(200);
    expect(customers.body.data.items.every((item: { status: string }) => item.status === "BLOCKED")).toBe(true);
    for (const resource of ["categories", "brands"]) {
      const response = await get(`${resource}?usage=unused&limit=500`).expect(200);
      expect(response.body.data.items.every((item: { productCount: number }) => item.productCount === 0)).toBe(true);
    }
    const roots = await get("categories?level=root&limit=500").expect(200);
    expect(roots.body.data.items.every((item: { parentCategoryId: string | null }) => item.parentCategoryId === null)).toBe(true);
    const children = await get("categories?level=child&limit=500").expect(200);
    expect(children.body.data.items.every((item: { parentCategoryId: string | null }) => item.parentCategoryId !== null)).toBe(true);
    const child = children.body.data.items.find((item: { productCount: number }) => item.productCount > 0);
    if (child) {
      const leafProducts = await get(`products?categoryId=${child.id}&limit=1`).expect(200);
      const sample = leafProducts.body.data.items[0];
      const rootProducts = await get(`products?categoryId=${child.parentCategoryId}&q=${encodeURIComponent(sample.slug)}`).expect(200);
      expect(rootProducts.body.data.items.some((item: { id: string }) => item.id === sample.id)).toBe(true);
    }
  });

  it("combines order dates, payment and status filters and rejects reversed dates", async () => {
    await get("orders?dateFrom=2026-11-01&dateTo=2026-10-01").expect(400);
    const response = await get("orders?status=DELIVERED&paymentStatus=PAID&dateFrom=2020-01-01&dateTo=2030-12-31&limit=500").expect(200);
    expect(response.body.data.items.every((item: { status: string; paymentStatus: string; createdAt: string }) => item.status === "DELIVERED" && item.paymentStatus === "PAID" && item.createdAt >= "2019-12-31T17:00:00Z" && item.createdAt < "2030-12-31T17:00:00Z")).toBe(true);
  });

});
