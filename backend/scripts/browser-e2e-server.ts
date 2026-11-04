/** Local browser fixtures are held in one PostgreSQL transaction and always rolled back.
 * Never point this runner at production. No email, expiry, queue or other workers run.
 */
import process from "node:process";
import console from "node:console";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import express from "express";
import { Server } from "socket.io";
import { eq, sql } from "drizzle-orm";
import type { RedisClientType } from "redis";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createDatabase } from "../src/config/database.js";
import { createLogger } from "../src/config/logger.js";
import * as schema from "../src/database/schema/index.js";
import { createAuthRepository } from "../src/modules/auth/auth.repository.js";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import { createCatalogService } from "../src/modules/catalog/catalog.service.js";
import { createAccountService } from "../src/modules/account/account.service.js";
import { createNotificationsService } from "../src/modules/notifications/notifications.service.js";
import { createInventoryService } from "../src/modules/inventory/inventory.service.js";
import { createOrdersService } from "../src/modules/orders/orders.service.js";
import { createOrderEventHub } from "../src/modules/orders/order-events.js";
import { createFlashSalesService } from "../src/modules/flash-sales/flash-sales.service.js";

const env = loadEnv();
const connection = new URL(env.DATABASE_URL);
if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname)) {
  throw new Error("Browser E2E requires a loopback development database");
}
const { db, pool } = createDatabase(env.DATABASE_URL, { statement_timeout: 10000, query_timeout: 12000 });
if ((await pool.query("SELECT current_database() name")).rows[0].name !== "technest_dev") {
  await pool.end();
  throw new Error("Expected technest_dev; refusing writes elsewhere");
}
const runId = `browser-e2e-${randomUUID()}`;
const port = 4175;
const origin = `http://127.0.0.1:${port}`;
const dist = resolve(process.env.E2E_DIST || "/tmp/technest-e2e-dist");
const rollback = new Error("E2E_ROLLBACK");
let finish!: () => void;
const finished = new Promise<void>((done) => { finish = done; });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, finish);
const rateCounts = new Map<string, number>();
const redis = {
  incr: async (key: string) => { const value = (rateCounts.get(key) || 0) + 1; rateCounts.set(key, value); return value; },
  expire: async () => 1,
} as unknown as RedisClientType;
const requests: Array<{ key: string | undefined; responseDropped: boolean }> = [];
let droppedResponses = 0;
let userId = 0;
let adminId = 0;
let productId = 0n;
try {
  await db.transaction(async (transaction) => {
    const tx = transaction as unknown as NodePgDatabase<typeof schema>;
    const [category] = await tx.select().from(schema.categories).where(eq(schema.categories.slug, "keyboards")).limit(1);
    const [brand] = await tx.select().from(schema.brands).limit(1);
    if (!category || !brand) throw new Error("Existing catalog category and brand required");
    const auth = createAuthService(createAuthRepository(tx), "browser-fixture-only-not-a-production-secret");
    const credentials = { email: `${runId}@example.test`, password: "Local-browser-test-2026!", fullName: "Browser E2E Customer" };
    userId = (await auth.register(credentials)).user.id;
    const adminCredentials = { email: `admin-${runId}@example.test`, password: "Local-admin-browser-test-2026!", fullName: "Browser E2E Admin" };
    adminId = (await auth.register(adminCredentials)).user.id;
    await tx.update(schema.users).set({ role: "ADMIN" }).where(eq(schema.users.id, adminId));
    const [product] = await tx.insert(schema.products).values({
      name: "Technest Browser Keyboard", slug: runId, categoryId: category.id, brandId: brand.id,
      price: "120000", description: "Temporary browser fixture. Rolled back after automated tests.",
      attributes: { testRunId: runId }, status: "ACTIVE",
    }).returning();
    productId = product!.id;
    const variants = await tx.insert(schema.productVariants).values([
      { productId, sku: `${runId}-black`, name: "Black", price: "120000" },
      { productId, sku: `${runId}-silver`, name: "Silver", price: "150000" },
      { productId, sku: `${runId}-sold-out`, name: "Sold out", price: "130000" },
    ]).returning();
    await tx.insert(schema.productImages).values({ productId, url: "/images/technest-product-placeholder.svg", altText: "Temporary keyboard browser fixture" });
    const inventory = createInventoryService(tx);
    await inventory.adjustStock(variants[0]!.id, 2);
    await inventory.adjustStock(variants[1]!.id, 3);
    await inventory.adjustStock(variants[2]!.id, 0);
    const wrapper = express();
    wrapper.use(express.json());
    wrapper.use((_request, response, next) => { response.set("X-Robots-Tag", "noindex, nofollow"); next(); });
    // Only the test runner can reach this loopback instance. Metadata is deliberately
    // noindex test scaffolding; production SEO is verified by the separate SEO suite.
    wrapper.get("/api/v1/seo/page", (_request, response) => response.json({ data: {
      title: "Technest browser fixtures", description: "Local transactional browser test", robots: "noindex, nofollow", type: "website", schemas: [],
    } }));
    wrapper.get("/__e2e/fixture", (_request, response) => response.json({ runId, credentials, adminCredentials, slug: runId, productId: String(productId), variants: variants.map((variant) => ({ id: String(variant.id), name: variant.name, price: variant.price })) }));
    wrapper.get("/__e2e/state", async (_request, response) => {
      const orders = await tx.select().from(schema.orders).where(eq(schema.orders.userId, BigInt(userId)));
      const addresses = await tx.select({ id: schema.userAddresses.id }).from(schema.userAddresses).where(eq(schema.userAddresses.userId, userId));
      response.json({ requests, droppedResponses, addresses: addresses.length, orders: orders.map((order) => ({ id: String(order.id), total: String(order.totalAmount), paymentMethod: order.paymentMethod, status: order.status })), stock: await Promise.all(variants.map(async (variant) => ({ id: String(variant.id), ...(await inventory.getStock(variant.id)) }))) });
    });
    wrapper.post("/__e2e/stock", async (request, response) => {
      const variant = variants.find((entry) => String(entry.id) === String(request.body.variantId));
      const onHand = Number(request.body.onHand);
      if (!variant || !Number.isSafeInteger(onHand) || onHand < 0) { response.status(400).json({ error: "Fixture variant and nonnegative stock required" }); return; }
      await inventory.adjustStock(variant.id, onHand);
      response.json({ ok: true });
    });
    wrapper.post("/__e2e/price", async (request, response) => {
      const variant = variants.find((entry) => String(entry.id) === String(request.body.variantId));
      const price = Number(request.body.price);
      if (!variant || !Number.isSafeInteger(price) || price <= 0) { response.status(400).json({ error: "Fixture variant and positive price required" }); return; }
      await tx.update(schema.productVariants).set({ price: String(price) }).where(eq(schema.productVariants.id, variant.id));
      response.json({ ok: true });
    });
    wrapper.post("/__e2e/finish", (_request, response) => { response.json({ rollingBack: true }); finish(); });
    wrapper.use("/api/v1/orders", (request, response, next) => {
      if (request.method !== "POST" || request.path !== "/") return next();
      const record = { key: request.get("Idempotency-Key"), responseDropped: false };
      requests.push(record);
      const originalJson = response.json.bind(response);
      response.json = ((body: unknown) => {
        // Simulate a lost acknowledgement after the REAL transaction created an
        // order. The retry must keep its idempotency key and reuse that order.
        if (!droppedResponses && response.statusCode < 300) {
          record.responseDropped = true; droppedResponses += 1;
          // A closed socket can be retried invisibly by Chromium. An explicit
          // gateway error produces a deterministic ambiguous acknowledgement.
          response.status(503);
          return originalJson({ success: false, error: { code: "TEST_GATEWAY_ACK_LOST", message: "Chưa nhận được xác nhận đơn hàng. Vui lòng thử lại." } });
        }
        return originalJson(body);
      }) as typeof response.json;
      next();
    });
    const app = createApp({ logger: createLogger("warn"), corsOrigin: origin,
      health: { postgres: () => tx.execute(sql`SELECT 1`), redis: async () => "TEST_LIMITER" },
      auth: { service: auth, env: { ...env, AUTH_COOKIE_SAME_SITE: "lax" }, redis },
      catalog: createCatalogService(tx), admin: { db: tx, auth }, inventory: { service: inventory, auth },
      account: { service: createAccountService(tx), auth, redis },
      notifications: { service: createNotificationsService(tx), auth }, flashSales: createFlashSalesService(tx),
      orders: { service: createOrdersService(tx), auth, hub: createOrderEventHub(), notify: () => {} },
    });
    wrapper.use("/api/v1", (request, response, next) => { request.url = `/api/v1${request.url}`; app(request, response, next); });
    wrapper.use(express.static(dist));
    const html = await readFile(resolve(dist, "index.html"), "utf8");
    wrapper.use((_request, response) => response.type("html").send(html));
    const server = createServer(wrapper);
    const sockets = new Server(server, { cors: { origin, credentials: true } });
    sockets.use(async (socket, next) => { try { socket.data.user = await auth.authenticate(socket.handshake.auth.token); next(); } catch { next(new Error("UNAUTHENTICATED")); } });
    await new Promise<void>((ready) => server.listen(port, "127.0.0.1", ready));
    console.log(`BROWSER_E2E_READY ${origin}; PostgreSQL transaction; fixture ${runId}`);
    try { await finished; }
    finally { await new Promise<void>((done) => sockets.close(() => done())); }
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally {
  const check = await pool.query("SELECT (SELECT count(*)::int FROM users WHERE id IN ($1,$3)) users, (SELECT count(*)::int FROM products WHERE id=$2) products, (SELECT count(*)::int FROM orders WHERE user_id=$1) orders", [userId, String(productId), adminId]);
  await writeFile(resolve("../docs/technest-browser-fixture-cleanup.json"), JSON.stringify({ checkedAt: new Date().toISOString(), runId, fixtureIds: { userId, productId: String(productId) }, remaining: check.rows[0], rolledBack: Object.values(check.rows[0]).every((value) => value === 0), requests, droppedResponses }, null, 2));
  await pool.end();
  console.log("BROWSER_E2E_ROLLED_BACK", JSON.stringify(check.rows[0]));
}
