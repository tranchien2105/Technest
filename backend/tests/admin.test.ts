import { describe, expect, it, vi } from "vitest";
import { productInput } from "../src/modules/admin/admin.catalog.schemas.js";
import request from "supertest";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createApp } from "../src/app.js";
import type * as schema from "../src/database/schema/index.js";
import { createLogger } from "../src/config/logger.js";
import { AppError } from "../src/shared/errors.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";

const auth = { authenticate: vi.fn(async (token?: string) => {
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  return { id: 1, email: "admin@example.test", fullName: "Admin", phone: null, role: token === "admin" ? "ADMIN" as const : "CUSTOMER" as const, status: "ACTIVE" as const };
}) } as unknown as AuthService;
const db = { insert: () => ({values:()=>({returning:async()=>[{id:1n}]})}), update:()=>({set:()=>({where:async()=>[]})}) } as unknown as NodePgDatabase<typeof schema>;
const app = createApp({
  logger: createLogger("silent"), corsOrigin: "http://localhost:5173",
  health: { postgres: async () => 1, redis: async () => "PONG" },
  admin: { db, auth },
});

describe("Admin API access and validation", () => {
  it("accepts existing local gallery paths and rejects unsupported image sources", () => {
    const product = { slug: "valid-product", name: "Valid product", categoryId: "a41c6ed0-e72a-4c6b-aa85-8e38a40890d4", brandId: "1", price: "10000", variants: [{ sku: "VALID-1", name: "Default" }] };
    for (const url of ["/images/catalog-illustrations/keyboards-view-1.svg", "https://example.test/product.webp"]) {
      expect(productInput.safeParse({ ...product, images: [{ url }] }).success).toBe(true);
    }
    for (const url of ["/images/../private", "/images/%2e%2e/private", "//example.test/image.webp", "javascript:alert(1)"]) {
      expect(productInput.safeParse({ ...product, images: [{ url }] }).success).toBe(false);
    }
  });
  it("protects all admin catalog endpoints with ADMIN role", async () => {
    await request(app).get("/api/v1/admin/products").expect(401);
    await request(app).get("/api/v1/admin/products").set("Authorization", "Bearer customer").expect(403);
    await request(app).get("/api/v1/admin/products/references?type=brands").expect(401);
    await request(app).get("/api/v1/admin/products/references?type=brands").set("Authorization", "Bearer customer").expect(403);
  });

  it("rejects incomplete product and settings writes before changing catalog data", async () => {
    await request(app).post("/api/v1/admin/products").set("Authorization", "Bearer admin").send({}).expect(400);
    await request(app).patch("/api/v1/admin/settings").set("Authorization", "Bearer admin").send({ standardShippingFee: -1 }).expect(400);
  });

  it("requires gallery images on active products and validates catalog identifiers", async () => {
    await request(app).post("/api/v1/admin/products").set("Authorization", "Bearer admin").send({
      slug: "valid-slug", name: "Valid product", categoryId: "a41c6ed0-e72a-4c6b-aa85-8e38a40890d4", brandId: "1", price: "10000",
      status: "ACTIVE", images: [], variants: [{ sku: "VALID-1", name: "Default" }],
    }).expect(400);
    await request(app).patch("/api/v1/admin/categories/not-a-uuid").set("Authorization", "Bearer admin").send({ name: "Valid", nameEn: "", slug: "valid" }).expect(400);
  });
});
