import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/config/logger.js";
import { createCatalogService } from "../src/modules/catalog/catalog.service.js";

const catalog = {
  productsList: vi.fn(async (query: unknown) => ({
    items: [{ id: "9007199254740993", price: "90071992547409930", query }],
    pagination: { page: 2, limit: 24, total: 25, totalPages: 2 },
  })),
  productById: vi.fn(async (id: string) => (id === "1" ? { id, variants: [], images: [] } : null)),
  categoriesList: vi.fn(async () => [{ id: "keyboards", name: "Bàn phím", nameEn: "Keyboards" }]),
  brandsList: vi.fn(async () => [{ id: "logitech", name: "LOGITECH" }]),
} as unknown as ReturnType<typeof createCatalogService>;

const app = createApp({
  logger: createLogger("silent"),
  corsOrigin: "http://localhost:5173",
  health: { postgres: async () => 1, redis: async () => "PONG" },
  catalog,
});

describe("catalog HTTP API", () => {
  it("applies server filters and returns BIGINT IDs and money as strings", async () => {
    const response = await request(app)
      .get(
        "/api/v1/products?q=keyboard&category=keyboards&brand=logitech&minPrice=10&maxPrice=90071992547409930&sort=priceLow&page=2&limit=24",
      )
      .expect(200);
    expect(response.body.data.items[0]).toMatchObject({
      id: "9007199254740993",
      price: "90071992547409930",
    });
    expect(response.body.data.pagination).toMatchObject({ page: 2, total: 25 });
    expect(catalog.productsList).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: "keyboard",
        category: "keyboards",
        brand: "logitech",
        minPrice: "10",
        maxPrice: "90071992547409930",
        sort: "priceLow",
        page: 2,
        limit: 24,
      }),
    );
  });

  it("rejects malformed filters and invalid product IDs", async () => {
    const invalidFilter = await request(app)
      .get("/api/v1/products?minPrice=100&maxPrice=10")
      .expect(400);
    expect(invalidFilter.body.error.code).toBe("VALIDATION_ERROR");
    await request(app).get("/api/v1/products/not-an-id").expect(400);
  });

  it("returns product details and a consistent not-found response", async () => {
    const found = await request(app).get("/api/v1/products/1").expect(200);
    expect(found.body.data).toEqual({ id: "1", variants: [], images: [] });
    const missing = await request(app).get("/api/v1/products/2").expect(404);
    expect(missing.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });
});
