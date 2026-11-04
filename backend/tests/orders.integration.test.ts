import { createTransactionalEmailRuntime } from "../src/modules/email/email.runtime.js";
import { describe, it, expect } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/config/database.js";
import { loadEnv } from "../src/config/env.js";
import { createOrdersService } from "../src/modules/orders/orders.service.js";
import { createInventoryService } from "../src/modules/inventory/inventory.service.js";
import { createOrderEventHub } from "../src/modules/orders/order-events.js";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/config/logger.js";
import { AppError } from "../src/shared/errors.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import * as schema from "../src/database/schema/index.js";
import { createNotificationsService } from "../src/modules/notifications/notifications.service.js";
import { createFlashSalesService } from "../src/modules/flash-sales/flash-sales.service.js";

describe.skipIf(process.env.RUN_ORDER_DB_TESTS !== "1")("Orders PostgreSQL + HTTP", () => {
  it("enforces ownership, retries, concurrent stock, history and outbox", async () => {
    const env = loadEnv();
    if (env.NODE_ENV === "production") throw new Error("Development database required");
    const { db, pool } = createDatabase(env.DATABASE_URL, { statement_timeout: 10000, query_timeout: 12000 });
    const suffix = crypto.randomUUID();
    let runtime: ReturnType<typeof createTransactionalEmailRuntime> | undefined;
    let userId: number | undefined;
    let productId: bigint | undefined;
    let variantId: bigint | undefined;
    try {
      const [category] = await db.select().from(schema.categories).limit(1);
      const [brand] = await db.select().from(schema.brands).limit(1);
      if (!category || !brand) throw new Error("Seed catalog first");
      const [user] = await db.insert(schema.users).values({ email: `orders-${suffix}@example.test`, passwordHash: "test-only", fullName: "Orders test" }).returning();
      userId = user!.id;
      const [product] = await db.insert(schema.products).values({ name: "Orders fixture", slug: `orders-${suffix}`, categoryId: category.id, brandId: brand.id, price: "120000" }).returning();
      productId = product!.id;
      const [variant] = await db.insert(schema.productVariants).values({ productId, sku: `ORD-${suffix}`, name: "Test" }).returning();
      variantId = variant!.id;
      const productImage = "https://example.test/order-product.jpg";
      const variantImage = "https://example.test/order-variant.jpg";
      await db.insert(schema.productImages).values({ productId, url: productImage, sortOrder: 0 });
      const inventory = createInventoryService(db);
      await inventory.adjustStock(variantId, 2);
      const service = createOrdersService(db);
      const auth = { authenticate: async (token?: string) => {
        if (!token) throw new AppError(401, "UNAUTHENTICATED", "Required");
        return { ...user!, id: token === "other" ? user!.id + 1000000 : user!.id, role: token === "admin" ? "ADMIN" : "CUSTOMER" };
      } } as unknown as AuthService;
      const events: unknown[] = [];
      const notifications = createNotificationsService(db);
      const app = createApp({ logger: createLogger("silent"), corsOrigin: "http://localhost:5173", health: { postgres: async () => 1, redis: async () => "PONG" }, notifications: { service: notifications, auth }, orders: { service, auth, hub: createOrderEventHub(), notify: (event) => events.push(event) } });
      const body = { items: [{ variantId: String(variantId), quantity: 1 }], shippingAddress: { fullName: "Customer", phone: "0901234567", address: "1 Test", city: "Hà Nội" }, paymentMethod: "COD" as const };
      await request(app).post("/api/v1/orders").send(body).expect(401);
      await request(app).get("/api/v1/admin/orders").set("Authorization", "Bearer customer").expect(403);
      await request(app).post("/api/v1/orders").set("Authorization", "Bearer customer").send(body).expect(400);
      const preview = await service.preview(body);
      expect(preview.totalAmount).toBe("150000");
      expect(preview.items[0]!.image).toBe(productImage);
      await db.insert(schema.productImages).values({ productId, variantId, url: variantImage, sortOrder: 10 });
      expect((await service.preview(body)).items[0]!.image).toBe(variantImage);
      const parallel = await Promise.all(Array.from({ length: 5 }, () => service.create({ ...body, idempotencyKey: `same-${suffix}` }, user!)));
      expect(parallel.filter((result) => !result.replayed)).toHaveLength(1);
      const order = parallel[0]!.order!;
      expect(order.items[0]!.image).toBe(variantImage);
      const emailSnapshot = await pool.query("SELECT payload FROM order_email_outbox WHERE order_id = $1 AND event_type = 'ORDER_PLACED'", [order.id]);
      expect(emailSnapshot.rows[0].payload.items[0].imageUrl).toBe(variantImage);
      await request(app).post("/api/v1/orders").set("Authorization", "Bearer customer").set("Idempotency-Key", `same-${suffix}`).send(body).expect(200);
      await request(app).get("/api/v1/orders/9999999999999999999").set("Authorization", "Bearer customer").expect(400);
      expect((await service.listForCustomer(userId, 1, 20, { status: "PENDING", q: order.orderNumber })).pagination.total).toBe(1);
      expect((await service.listForCustomer(userId, 1, 20, { status: "SHIPPED" })).pagination.total).toBe(0);
      expect(new Set(parallel.map((result) => result.order!.id)).size).toBe(1);
      for (const method of ["get", "post"] as const) {
        const path = `/api/v1/orders/${order.id}${method === "post" ? "/cancel" : ""}`;
        await request(app)[method](path).set("Authorization", "Bearer other").expect(404);
      }
      await expect(service.create({ ...body, items: [{ variantId: String(variantId), quantity: 2 }], idempotencyKey: `same-${suffix}` }, user!)).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
      await pool.query("UPDATE inventory_reservations SET expires_at = now() - interval '1 day' WHERE variant_id = $1", [String(variantId)]);
      await inventory.expireReservations();
      expect(await inventory.getStock(variantId)).toMatchObject({ onHand: 2, reserved: 1 });
      await expect(service.transition(order.id, "SHIPPED", userId)).rejects.toMatchObject({ code: "INVALID_ORDER_TRANSITION" });
      expect((await notifications.getNotifications(userId, { page: 1, limit: 50 })).pagination.total).toBe(0);
      for (const status of ["CONFIRMED", "PROCESSING"] as const) await service.transition(order.id, status, userId);
      expect(await inventory.getStock(variantId)).toMatchObject({ onHand: 2, reserved: 1 });
      await Promise.all([service.transition(order.id, "SHIPPED", userId), service.transition(order.id, "SHIPPED", userId)]);
      expect(await inventory.getStock(variantId)).toMatchObject({ onHand: 1, reserved: 0 });
      await expect(service.transition(order.id, "CANCELLED", userId)).rejects.toMatchObject({ code: "INVALID_ORDER_TRANSITION" });
      await service.transition(order.id, "DELIVERED", userId);
      expect((await notifications.getNotifications(userId, { page: 1, limit: 50 })).items.map((item) => item.type)).toEqual(["ORDER_DELIVERED", "ORDER_STATUS_UPDATED", "ORDER_STATUS_UPDATED", "ORDER_STATUS_UPDATED"]);
      await service.transition(order.id, "DELIVERED", userId);
      expect((await notifications.getNotifications(userId, { page: 1, limit: 50 })).pagination.total).toBe(4);
      const otherNotices = await request(app).get("/api/v1/notifications").set("Authorization", "Bearer other").expect(200);
      expect(otherNotices.body.data.pagination.total).toBe(0);
      const competing = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => service.create({ ...body, idempotencyKey: `compete-${suffix}-${index}` }, user!)));
      const winners = competing.filter((result) => result.status === "fulfilled");
      expect(winners).toHaveLength(1);
      const winner = (winners[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof service.create>>>).value.order!;
      await service.transition(winner.id, "CONFIRMED", userId);
      await service.transition(winner.id, "PROCESSING", userId);
      await Promise.all([request(app).post(`/api/v1/orders/${winner.id}/cancel`).set("Authorization", "Bearer customer").expect(200), request(app).post(`/api/v1/orders/${winner.id}/cancel`).set("Authorization", "Bearer customer").expect(200)]);
      expect((await notifications.getNotifications(userId, { page: 1, limit: 50 })).items.filter((item) => item.type === "ORDER_CANCELLED")).toHaveLength(1);
      expect(await inventory.getStock(variantId)).toMatchObject({ onHand: 1, reserved: 0 });
      expect(events).toHaveLength(1);
      const detail = await service.detailForCustomer(userId, order.id);
      expect(detail!.statusHistory.map((entry) => entry.toStatus)).toEqual(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]);
      expect((await service.listForAdmin({ page: 1, limit: 20, q: order.orderNumber })).pagination.total).toBe(1);
      const outbox = await pool.query("SELECT event_type FROM order_email_outbox WHERE order_id = $1", [order.id]);
      expect(outbox.rows.map((row) => row.event_type).sort()).toEqual(["ORDER_PLACED", "ORDER_CONFIRMED", "ORDER_PROCESSING", "ORDER_SHIPPED", "ORDER_DELIVERED"].sort());
      if (process.env.RUN_ORDER_EMAIL_TESTS === "1") {
        if (env.SMTP_HOST !== "127.0.0.1" || env.SMTP_PORT !== 1025) throw new Error("Local Mailpit required");
        runtime = createTransactionalEmailRuntime(db, env, createLogger("silent"));
        await runtime.start();
        await expect.poll(async () => {
          const result = await pool.query("SELECT count(*)::int AS total FROM order_email_outbox WHERE order_id = $1 AND status = 'SENT'", [order.id]);
          return result.rows[0].total;
        }, { timeout: 20000, interval: 250 }).toBe(5);
        const response = await fetch(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${user!.email}`)}`);
        const messages = await response.json() as { messages: unknown[] };
        expect(messages.messages.length).toBeGreaterThanOrEqual(5);
      }
    } finally {
      await runtime?.close();
      if (userId) {
        await pool.query("DELETE FROM order_email_outbox WHERE order_id IN (SELECT id::text FROM orders WHERE user_id = $1)", [userId]);
        for (const table of ["order_status_history", "order_inventory_reservations", "order_items"]) await pool.query(`DELETE FROM ${table} WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)`, [userId]);
        await pool.query("DELETE FROM orders WHERE user_id = $1", [userId]);
      }
      if (variantId) {
        for (const table of ["inventory_movements", "inventory_reservations", "inventories"]) await pool.query(`DELETE FROM ${table} WHERE variant_id = $1`, [String(variantId)]);
        await pool.query("DELETE FROM product_variants WHERE id = $1", [String(variantId)]);
      }
      if (productId) await pool.query("DELETE FROM products WHERE id = $1", [String(productId)]);
      if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      await pool.end();
    }
  }, 60000);

  it("atomically reserves a Flash Sale place against concurrent PostgreSQL checkouts", async () => {
    const env = loadEnv();
    if (env.NODE_ENV === "production") throw new Error("Development database required");
    const { db, pool } = createDatabase(env.DATABASE_URL, { statement_timeout: 10000, query_timeout: 12000 });
    const suffix = crypto.randomUUID();
    const userIds: number[] = [];
    let productId: bigint | undefined;
    let variantId: bigint | undefined;
    let campaignId: bigint | undefined;
    let draftCampaignId: bigint | undefined;
    let itemId: bigint | undefined;
    try {
      const [category] = await db.select().from(schema.categories).limit(1);
      const [brand] = await db.select().from(schema.brands).limit(1);
      if (!category || !brand) throw new Error("Seed catalog first");
      const [admin] = await db.insert(schema.users).values({ email: "flash-admin-" + suffix + "@example.test", passwordHash: "test-only", role: "ADMIN", fullName: "Flash Sale test admin" }).returning();
      const [firstBuyer] = await db.insert(schema.users).values({ email: "flash-a-" + suffix + "@example.test", passwordHash: "test-only", fullName: "Flash Sale buyer A" }).returning();
      const [secondBuyer] = await db.insert(schema.users).values({ email: "flash-b-" + suffix + "@example.test", passwordHash: "test-only", fullName: "Flash Sale buyer B" }).returning();
      userIds.push(admin!.id, firstBuyer!.id, secondBuyer!.id);
      const [product] = await db.insert(schema.products).values({ name: "Flash Sale fixture", slug: "flash-" + suffix, categoryId: category.id, brandId: brand.id, price: "100000", status: "ACTIVE" }).returning();
      productId = product!.id;
      const [variant] = await db.insert(schema.productVariants).values({ productId, sku: "FS-" + suffix, name: "Test variant", price: "100000", status: "ACTIVE" }).returning();
      variantId = variant!.id;
      await createInventoryService(db).adjustStock(variantId, 1);
      const campaign = await createFlashSalesService(db).create({
        name: "Flash Sale " + suffix,
        slug: "flash-" + suffix,
        description: "Temporary integration test campaign",
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        status: "ACTIVE",
        items: [{ variantId: String(variantId), flashPrice: 50_000, quota: 1, perCustomerLimit: 1, sortOrder: 0 }],
      }, { ...admin!, id: admin!.id, permissions: [] });
      campaignId = BigInt(campaign.id);
      itemId = BigInt(campaign.items[0]!.id);
      const flashSales = createFlashSalesService(db);
      const draft = await flashSales.create({
        name: "Private Flash Sale " + suffix,
        slug: "private-flash-" + suffix,
        description: "Unpublished test campaign",
        startsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        endsAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        status: "DRAFT",
        items: [{ variantId: String(variantId), flashPrice: 40_000, quota: 1, perCustomerLimit: 1, sortOrder: 0 }],
      }, { ...admin!, id: admin!.id, permissions: [] });
      draftCampaignId = BigInt(draft.id);
      const staff = (await db.insert(schema.users).values({ email: "flash-staff-" + suffix + "@example.test", passwordHash: "test-only", role: "STAFF", permissions: ["flash-sales:read"], fullName: "Flash Sale read-only staff" }).returning())[0]!;
      userIds.push(staff.id);
      const auth = { authenticate: async (token?: string) => {
        if (token === "admin") return { ...admin!, id: admin!.id, role: "ADMIN" as const, permissions: [] };
        if (token === "staff") return { ...staff, id: staff.id, role: "STAFF" as const, permissions: ["flash-sales:read"] };
        if (token === "customer") return { ...firstBuyer!, id: firstBuyer!.id, role: "CUSTOMER" as const, permissions: [] };
        throw new AppError(401, "UNAUTHENTICATED", "Required");
      } } as unknown as AuthService;
      const app = createApp({ logger: createLogger("silent"), corsOrigin: env.CORS_ORIGIN, health: { postgres: async () => 1, redis: async () => "PONG" }, admin: { db, auth }, flashSales });
      await request(app).get("/api/v1/admin/flash-sales").set("Authorization", "Bearer customer").expect(403);
      await request(app).get("/api/v1/admin/flash-sales").set("Authorization", "Bearer staff").expect(200);
      await request(app).post("/api/v1/admin/flash-sales").set("Authorization", "Bearer staff").send({}).expect(403);
      await request(app).get("/api/v1/flash-sales/" + draftCampaignId).expect(404);
      const service = createOrdersService(db);
      const body = (flashSaleItemId: string) => ({
        items: [{ variantId: String(variantId), quantity: 1, flashSaleItemId }],
        shippingAddress: { fullName: "Flash Sale test", phone: "0901234567", address: "1 Test", city: "Hà Nội" },
        paymentMethod: "COD" as const,
      });
      const attempts = await Promise.allSettled([
        service.create({ ...body(String(itemId)), idempotencyKey: "flash-a-" + suffix }, firstBuyer!),
        service.create({ ...body(String(itemId)), idempotencyKey: "flash-b-" + suffix }, secondBuyer!),
      ]);
      const winners = attempts.filter((attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof service.create>>> => attempt.status === "fulfilled");
      expect(winners).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
      const winner = winners[0]!.value;
      expect(winner.order!.items[0]).toMatchObject({ unitPrice: "50000", flashSaleOriginalPrice: "100000", flashSaleDiscountAmount: "50000" });
      const [heldItem] = await db.select().from(schema.flashSaleItems).where(eq(schema.flashSaleItems.id, itemId));
      expect(heldItem).toMatchObject({ quota: 1, reservedQuantity: 1, soldQuantity: 0 });
      expect(await createInventoryService(db).getStock(variantId)).toMatchObject({ onHand: 1, reserved: 1, availableQuantity: 0 });

      const buyer = winner.order!.userId === String(firstBuyer!.id) ? firstBuyer! : secondBuyer!;
      const buyerKey = buyer.id === firstBuyer!.id ? "flash-a-" : "flash-b-";
      const replay = await service.create({ ...body(String(itemId)), idempotencyKey: buyerKey + suffix }, buyer);
      expect(replay.replayed).toBe(true);
      await service.transition(winner.order!.id, "CONFIRMED", buyer.id);
      await service.transition(winner.order!.id, "PROCESSING", buyer.id);
      await service.transition(winner.order!.id, "SHIPPED", buyer.id);
      const [soldItem] = await db.select().from(schema.flashSaleItems).where(eq(schema.flashSaleItems.id, itemId));
      expect(soldItem).toMatchObject({ reservedQuantity: 0, soldQuantity: 1 });
      expect(await createInventoryService(db).getStock(variantId)).toMatchObject({ onHand: 0, reserved: 0, availableQuantity: 0 });
    } finally {
      if (userIds.length) {
        await pool.query("DELETE FROM order_email_outbox WHERE order_id IN (SELECT id::text FROM orders WHERE user_id = ANY($1::bigint[]))", [userIds]);
        await pool.query("DELETE FROM flash_sale_reservations WHERE user_id = ANY($1::bigint[])", [userIds]);
        for (const table of ["order_status_history", "order_inventory_reservations", "order_items"]) await pool.query("DELETE FROM " + table + " WHERE order_id IN (SELECT id FROM orders WHERE user_id = ANY($1::bigint[]))", [userIds]);
        await pool.query("DELETE FROM orders WHERE user_id = ANY($1::bigint[])", [userIds]);
      }
      if (itemId) await pool.query("DELETE FROM flash_sale_reservations WHERE flash_sale_item_id = $1", [String(itemId)]);
      if (campaignId) await pool.query("DELETE FROM flash_sale_items WHERE campaign_id = $1", [String(campaignId)]);
      if (campaignId) await pool.query("DELETE FROM flash_sale_campaigns WHERE id = $1", [String(campaignId)]);
      if (draftCampaignId) await pool.query("DELETE FROM flash_sale_items WHERE campaign_id = $1", [String(draftCampaignId)]);
      if (draftCampaignId) await pool.query("DELETE FROM flash_sale_campaigns WHERE id = $1", [String(draftCampaignId)]);
      if (variantId) {
        for (const table of ["inventory_movements", "inventory_reservations", "inventories"]) await pool.query("DELETE FROM " + table + " WHERE variant_id = $1", [String(variantId)]);
        await pool.query("DELETE FROM product_variants WHERE id = $1", [String(variantId)]);
      }
      if (productId) await pool.query("DELETE FROM products WHERE id = $1", [String(productId)]);
      if (userIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [userIds]);
      await pool.end();
    }
  }, 60000);
});
