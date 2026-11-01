import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/config/logger.js";
import type { Env } from "../src/config/env.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import type { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { AppError } from "../src/shared/errors.js";

const auth = {
  authenticate: vi.fn(async (token?: string) => {
    if (token === "admin")
      return {
        id: 1,
        email: "admin@example.test",
        fullName: null,
        role: "ADMIN",
        status: "ACTIVE",
      };
    if (token === "customer")
      return {
        id: 2,
        email: "customer@example.test",
        fullName: null,
        role: "CUSTOMER",
        status: "ACTIVE",
      };
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  }),
} as unknown as AuthService;
const inventory = {
  adminStock: vi.fn(async (variantId: string) => ({ variantId, onHand: 3, reserved: 1 })),
  increaseStock: vi.fn(async () => ({ onHand: 4 })),
  adjustStock: vi.fn(async () => ({ onHand: 4 })),
  movements: vi.fn(async () => ({
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  })),
  publicStockBySku: vi.fn(async (sku: string) => ({
    sku,
    availableQuantity: 2,
    inStock: true,
    stockStatus: "IN_STOCK",
  })),
} as unknown as InventoryService;
const app = createApp({
  logger: createLogger("silent"),
  corsOrigin: "http://localhost:5173",
  health: { postgres: async () => 1, redis: async () => "PONG" },
  auth: { service: auth, env: {} as Env, redis: {} as never },
  inventory: { service: inventory, auth },
});

describe("inventory HTTP API", () => {
  it("exposes only safe stock fields by active SKU", async () => {
    const response = await request(app).get("/api/v1/inventory/sku/TN-1-STD").expect(200);
    expect(response.body.data).toEqual({
      sku: "TN-1-STD",
      availableQuantity: 2,
      inStock: true,
      stockStatus: "IN_STOCK",
    });
    expect(response.body.data).not.toHaveProperty("onHand");
    expect(response.body.data).not.toHaveProperty("reserved");
  });

  it("protects inventory admin routes and allows ADMIN only", async () => {
    await request(app).get("/api/v1/admin/inventory/1").expect(401);
    await request(app)
      .get("/api/v1/admin/inventory/1")
      .set("Authorization", "Bearer customer")
      .expect(403);
    await request(app)
      .get("/api/v1/admin/inventory/1")
      .set("Authorization", "Bearer admin")
      .expect(200);
  });

  it("validates quantities and serves movement pagination", async () => {
    await request(app)
      .post("/api/v1/admin/inventory/1/inbound")
      .set("Authorization", "Bearer admin")
      .send({ quantity: 0 })
      .expect(400);
    await request(app)
      .get("/api/v1/admin/inventory/1/movements?page=2&limit=10")
      .set("Authorization", "Bearer admin")
      .expect(200);
    expect(inventory.movements).toHaveBeenLastCalledWith("1", 2, 10);
  });
});

const integration = process.env.INVENTORY_DB_TESTS === "1";
describe.skipIf(!integration)("inventory PostgreSQL integration and concurrency", () => {
  let fixture: {
    productId: bigint;
    variantId: bigint;
    service: InventoryService;
    pool: import("pg").Pool;
  };

  beforeAll(async () => {
    const [{ loadEnv }, { createDatabase }, { createInventoryService }, schema, drizzle] =
      await Promise.all([
        import("../src/config/env.js"),
        import("../src/config/database.js"),
        import("../src/modules/inventory/inventory.service.js"),
        import("../src/database/schema/index.js"),
        import("drizzle-orm"),
      ]);
    const env = loadEnv();
    if (env.NODE_ENV === "production")
      throw new Error("Inventory DB integration tests are disabled in production");
    const { db, pool } = createDatabase(env.DATABASE_URL, { connectionTimeoutMillis: 5000 });
    const [{ id: categoryId } = {}] = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .limit(1);
    const [{ id: brandId } = {}] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .limit(1);
    if (!categoryId || !brandId)
      throw new Error("Run the development catalog seed before inventory integration tests");
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [product] = await db
      .insert(schema.products)
      .values({
        slug: `inventory-test-${suffix}`,
        name: "Inventory integration test",
        description: "Temporary test fixture",
        categoryId,
        brandId,
        price: "1",
        status: "ACTIVE",
      })
      .returning({ id: schema.products.id });
    const [variant] = await db
      .insert(schema.productVariants)
      .values({
        productId: product!.id,
        sku: `INV-TEST-${suffix}`,
        name: "Test",
        price: "1",
        status: "ACTIVE",
      })
      .returning({ id: schema.productVariants.id });
    fixture = {
      productId: product!.id,
      variantId: variant!.id,
      service: createInventoryService(db),
      pool,
    };
    // Keep imported Drizzle operators initialized before tests execute.
    void drizzle;
  });

  it("covers stock invariants, idempotency, reservation lifecycle, expiry and ten concurrent reservations", async () => {
    const { service, variantId, pool } = fixture;
    const variant = variantId.toString();
    try {
      await service.adjustStock(variant, 5);
      const inbound = await service.increaseStock(variant, 2, {
        idempotencyKey: "inventory-test-inbound",
      });
      const replay = await service.increaseStock(variant, 2, {
        idempotencyKey: "inventory-test-inbound",
      });
      expect(inbound.onHand).toBe(7);
      expect(replay.onHand).toBe(7);
      expect(replay.replayed).toBe(true);
      await expect(service.decreaseStock(variant, 8)).rejects.toMatchObject({
        code: "INSUFFICIENT_STOCK",
      });
      await service.adjustStock(variant, 3);

      const reservation = await service.reserveStock(variant, 2, { type: "test", id: "release" });
      expect(reservation.stock.reserved).toBe(2);
      expect((await service.releaseReservation(reservation.reservation.id)).status).toBe(
        "RELEASED",
      );
      await service.releaseReservation(reservation.reservation.id);

      const confirmed = await service.reserveStock(variant, 1, { type: "test", id: "confirm" });
      expect((await service.confirmReservation(confirmed.reservation.id)).status).toBe("CONFIRMED");
      await service.confirmReservation(confirmed.reservation.id);
      expect(await service.getStock(variant)).toMatchObject({ onHand: 2, reserved: 0 });

      const expiring = await service.reserveStock(
        variant,
        1,
        { type: "test", id: "expire" },
        { ttlMs: 1000 },
      );
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(await service.expireReservations()).toBeGreaterThanOrEqual(1);
      expect((await service.releaseReservation(expiring.reservation.id)).status).toBe("EXPIRED");

      await service.adjustStock(variant, 1);
      const attempts = await Promise.allSettled(
        Array.from({ length: 10 }, (_, index) =>
          service.reserveStock(variant, 1, { type: "test", id: `parallel-${index}` }),
        ),
      );
      expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(9);
      expect(await service.getStock(variant)).toMatchObject({
        onHand: 1,
        reserved: 1,
        availableQuantity: 0,
      });
      const movementRows = await pool.query(
        "SELECT id FROM inventory_movements WHERE variant_id = $1 AND idempotency_key = $2",
        [variant, "inventory-test-inbound"],
      );
      expect(movementRows.rowCount).toBe(1);
    } finally {
      await pool.query("DELETE FROM inventory_reservations WHERE variant_id = $1", [variant]);
      await pool.query("DELETE FROM inventory_movements WHERE variant_id = $1", [variant]);
      await pool.query("DELETE FROM inventories WHERE variant_id = $1", [variant]);
      await pool.query("DELETE FROM product_variants WHERE id = $1", [variant]);
      await pool.query("DELETE FROM products WHERE id = $1", [fixture.productId.toString()]);
      await pool.end();
    }
  });
});
