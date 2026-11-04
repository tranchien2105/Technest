import { describe, expect, it } from "vitest";
import { and, eq, lt, ne } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { writeFile } from "node:fs/promises";
import { loadEnv } from "../src/config/env.js";
import { createDatabase } from "../src/config/database.js";
import { createOrdersService } from "../src/modules/orders/orders.service.js";
import { createFlashSalesService } from "../src/modules/flash-sales/flash-sales.service.js";
import { createCatalogService } from "../src/modules/catalog/catalog.service.js";
import * as schema from "../src/database/schema/index.js";

describe.runIf(process.env.RUN_PRICING_DB_TESTS === "1")("pricing and Flash Sale lifecycle: PostgreSQL rollback fixture", () => {
  it("keeps catalog/variant/quote/order prices consistent and rejects invalid offers", async () => {
    const env = loadEnv();
    if (!["development", "test"].includes(env.NODE_ENV) || new URL(env.DATABASE_URL).pathname !== "/technest_dev" || !["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) throw new Error("Confirmed local development DB required");
    const database = createDatabase(env.DATABASE_URL, { statement_timeout: 10_000, query_timeout: 12_000 });
    const suffix = crypto.randomUUID();
    const slug = `pricing-verification-${suffix}`;
    const rollback = new Error("ROLLBACK_PRICING_FIXTURE");
    const checks: string[] = [];
    try {
      try {
        await database.db.transaction(async (tx) => {
          const db = tx as unknown as NodePgDatabase<typeof schema>;
          const [category] = await tx.select().from(schema.categories).limit(1);
          const [brand] = await tx.select().from(schema.brands).limit(1);
          if (!category || !brand) throw new Error("Seed catalog first");
          const [buyer] = await tx.insert(schema.users).values({ email: `${slug}@example.test`, passwordHash: "rollback-only", fullName: "Pricing verifier" }).returning();
          const [product] = await tx.insert(schema.products).values({ name: "Pricing rollback fixture", slug, categoryId: category.id, brandId: brand.id, price: "700000" }).returning();
          const variants = await tx.insert(schema.productVariants).values([
            { productId: product!.id, sku: `${slug}-A`, name: "Black", price: "500000" },
            { productId: product!.id, sku: `${slug}-B`, name: "White", price: "600000" },
          ]).returning();
          const standard = variants[0]!, selected = variants[1]!;
          await tx.insert(schema.inventories).values(variants.map((variant) => ({ variantId: variant.id, onHand: 10, reserved: 0 })));
          await tx.insert(schema.productImages).values([
            { productId: product!.id, url: "/seo-social.png", sortOrder: 0 },
            { productId: product!.id, variantId: selected.id, url: "/images/storefront-curated/mouse.svg", sortOrder: 10 },
          ]);
          const [campaign] = await tx.insert(schema.flashSaleCampaigns).values({ name: "Rollback pricing verification", slug, status: "ACTIVE", startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000) }).returning();
          const [item] = await tx.insert(schema.flashSaleItems).values({ campaignId: campaign!.id, productId: product!.id, variantId: selected.id, originalPriceSnapshot: 600000n, flashPrice: 400000n, quota: 2, perCustomerLimit: 1 }).returning();
          const orders = createOrdersService(db);
          const sales = createFlashSalesService(db);
          const body = (variantId = selected.id, withSale = true) => ({
            items: [{ variantId: String(variantId), quantity: 1, ...(withSale ? { flashSaleItemId: String(item!.id) } : {}) }],
            shippingAddress: { fullName: "Pricing verifier", phone: "0901234567", address: "1 Test", city: "Hà Nội" }, paymentMethod: "COD" as const,
          });
          const catalog = await createCatalogService(db).productById(slug);
          expect(catalog?.variants.find((variant) => variant.id === String(selected.id))?.price).toBe("600000");
          expect((await orders.preview(body(standard.id, false), buyer!.id)).subtotal).toBe("500000");
          expect((await orders.preview(body(selected.id, false), buyer!.id)).subtotal).toBe("600000");
          const quote = await orders.preview(body(), buyer!.id);
          expect(quote.subtotal).toBe("400000");
          expect(quote.items[0]).toMatchObject({ variantId: String(selected.id), unitPrice: "400000", flashSaleOriginalPrice: "600000", flashSaleDiscountAmount: "200000", image: "/images/storefront-curated/mouse.svg" });
          expect((await sales.publicDetail(String(campaign!.id))).items[0]?.image).toBe("/images/storefront-curated/mouse.svg");
          checks.push("catalog/regular variant/Flash Sale quote use correct VND and selected image");

          await expect(orders.preview(body(standard.id), buyer!.id)).rejects.toMatchObject({ code: "FLASH_SALE_UNAVAILABLE" });
          for (const status of ["DRAFT", "PAUSED", "CANCELLED", "ENDED"] as const) {
            await tx.update(schema.flashSaleCampaigns).set({ status }).where(eq(schema.flashSaleCampaigns.id, campaign!.id));
            await expect(orders.preview(body(), buyer!.id)).rejects.toMatchObject({ code: "FLASH_SALE_UNAVAILABLE" });
            if (status !== "DRAFT" && status !== "CANCELLED") expect((await sales.publicDetail(String(campaign!.id))).status).toBe(status);
          }
          await tx.update(schema.flashSaleCampaigns).set({ status: "SCHEDULED", startsAt: new Date(Date.now() + 60_000), endsAt: new Date(Date.now() + 120_000) }).where(eq(schema.flashSaleCampaigns.id, campaign!.id));
          await expect(orders.preview(body(), buyer!.id)).rejects.toMatchObject({ code: "FLASH_SALE_UNAVAILABLE" });
          await tx.update(schema.flashSaleCampaigns).set({ status: "ACTIVE", startsAt: new Date(Date.now() - 120_000), endsAt: new Date(Date.now() - 1) }).where(eq(schema.flashSaleCampaigns.id, campaign!.id));
          await expect(orders.preview(body(), buyer!.id)).rejects.toMatchObject({ code: "FLASH_SALE_UNAVAILABLE" });
          checks.push("wrong variant, draft/paused/cancelled/ended/upcoming/expired offers rejected");

          await tx.update(schema.flashSaleCampaigns).set({ startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000) }).where(eq(schema.flashSaleCampaigns.id, campaign!.id));
          await tx.update(schema.productVariants).set({ price: "300000" }).where(eq(schema.productVariants.id, selected.id));
          await expect(orders.preview(body(), buyer!.id)).rejects.toMatchObject({ code: "FLASH_SALE_PRICE_INVALID" });
          await tx.update(schema.productVariants).set({ price: "600000" }).where(eq(schema.productVariants.id, selected.id));
          await expect(orders.preview({ ...body(), voucherCode: "DEMO10" }, buyer!.id)).rejects.toMatchObject({ code: "FLASH_SALE_VOUCHER_NOT_STACKABLE" });
          await tx.update(schema.flashSaleItems).set({ soldQuantity: 2 }).where(eq(schema.flashSaleItems.id, item!.id));
          await expect(orders.preview(body(), buyer!.id)).rejects.toMatchObject({ code: "FLASH_SALE_SOLD_OUT" });
          await tx.update(schema.flashSaleItems).set({ soldQuantity: 0 }).where(eq(schema.flashSaleItems.id, item!.id));
          checks.push("stale expensive deal, voucher stacking and exhausted quota rejected");

          const created = await orders.create({ ...body(), idempotencyKey: `${slug}-first` }, buyer!);
          expect(created.order!.subtotal).toBe(quote.subtotal);
          expect(created.order!.items[0]).toMatchObject({ variantId: String(selected.id), unitPrice: quote.items[0]!.unitPrice, flashSaleDiscountAmount: "200000" });
          const replay = await orders.create({ ...body(), idempotencyKey: `${slug}-first` }, buyer!);
          expect(replay.replayed).toBe(true);
          expect(replay.order!.id).toBe(created.order!.id);
          await expect(orders.preview(body(), buyer!.id)).rejects.toMatchObject({ code: "FLASH_SALE_CUSTOMER_LIMIT" });
          expect((await sales.publicDetail(String(campaign!.id))).items[0]).toMatchObject({ reservedQuantity: 1, soldQuantity: 0, availableQuantity: 1, stockAvailable: 9 });
          checks.push("quote=create price snapshots; same key replays one order; quota/customer/stock hold enforced");

          await orders.transition(created.order!.id, "CANCELLED", buyer!.id);
          expect((await sales.publicDetail(String(campaign!.id))).items[0]).toMatchObject({ reservedQuantity: 0, soldQuantity: 0, availableQuantity: 2, stockAvailable: 10 });
          const expiring = await orders.create({ ...body(), idempotencyKey: `${slug}-expiring` }, buyer!);
          await tx.update(schema.flashSaleReservations).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(schema.flashSaleReservations.orderId, BigInt(expiring.order!.id)));
          // The production sweep is global: only invoke it if our fixture is the
          // sole expired candidate, even though this entire test rolls back.
          const unrelatedExpired = await tx.select({ id: schema.flashSaleReservations.id }).from(schema.flashSaleReservations).where(and(eq(schema.flashSaleReservations.status, "RESERVED"), lt(schema.flashSaleReservations.expiresAt, new Date()), ne(schema.flashSaleReservations.orderId, BigInt(expiring.order!.id))));
          expect(unrelatedExpired, "Expiry test refuses to sweep unrelated business reservations").toHaveLength(0);
          const expired = await orders.expireFlashSaleOrders();
          expect(expired.some((event) => event.orderId === expiring.order!.id)).toBe(true);
          expect((await orders.detailForCustomer(buyer!.id, expiring.order!.id))?.status).toBe("CANCELLED");
          expect((await sales.publicDetail(String(campaign!.id))).items[0]).toMatchObject({ reservedQuantity: 0, soldQuantity: 0, availableQuantity: 2, stockAvailable: 10 });
          checks.push("expired pending Flash Sale order cancels and releases stock+quota; no unrelated expiry sweep");
          const second = await orders.create({ ...body(), idempotencyKey: `${slug}-second` }, buyer!);
          for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED"] as const) await orders.transition(second.order!.id, status, buyer!.id);
          expect((await sales.publicDetail(String(campaign!.id))).items[0]).toMatchObject({ reservedQuantity: 0, soldQuantity: 1, availableQuantity: 1, stockAvailable: 9 });
          checks.push("cancel releases quota+stock; ship consumes once; fresh reads reflect transitions");
          throw rollback;
        });
      } catch (error) { if (error !== rollback) throw error; }
      const remaining = await database.pool.query("select count(*)::int n from products where slug=$1", [slug]);
      expect(remaining.rows[0].n).toBe(0);
      await writeFile(new URL("../../docs/technest-pricing-flash-sale-results.json", import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), database: "technest_dev", isolation: "Single rollback transaction; service transactions use savepoints; no worker or external email runtime", result: "PASS", checks, persistedFixtureProducts: 0 }, null, 2));
    } finally { await database.pool.end(); }
  }, 60_000);
});
