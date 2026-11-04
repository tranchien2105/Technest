import { and, asc, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import { flashSaleCampaigns, flashSaleItems, inventories, productImages, productVariants, products, orders, orderItems } from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";
import type { SafeUser } from "../auth/auth.service.js";
import type { RedisClientType } from "redis";

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type InputItem = { variantId: string; flashPrice: number; quota: number; perCustomerLimit: number; sortOrder: number };
const nowStatus = (campaign: typeof flashSaleCampaigns.$inferSelect, now: Date) => {
  if (["DRAFT", "PAUSED", "CANCELLED", "ENDED"].includes(campaign.status)) return campaign.status;
  if (now < campaign.startsAt) return "SCHEDULED";
  if (now >= campaign.endsAt) return "ENDED";
  return "ACTIVE";
};

const PUBLIC_CACHE_KEY = "technest:flash-sales:public:v1";
export function createFlashSalesService(db: Database, emit: (event: string, payload: unknown) => void = () => {}, cache?: RedisClientType) {
  const listeners = new Set<(event: string, payload: unknown) => void>();
  const announcedStarts = new Set<string>();
  const announcedEnds = new Set<string>();
  const publish = (event: string, payload: unknown) => {
    emit(event, payload);
    if (cache?.isOpen) void cache.del(PUBLIC_CACHE_KEY).catch(() => {});
    for (const listener of listeners) listener(event, payload);
  };
  async function campaignDetail(campaign: typeof flashSaleCampaigns.$inferSelect) {
    const serverNow = new Date();
    const rows = await db.select({ item: flashSaleItems, product: products, variant: productVariants, image: productImages.url, inventory: inventories })
      .from(flashSaleItems).innerJoin(products, eq(products.id, flashSaleItems.productId)).innerJoin(productVariants, eq(productVariants.id, flashSaleItems.variantId))
      .leftJoin(productImages, and(eq(productImages.productId, products.id), or(eq(productImages.variantId, productVariants.id), sql`${productImages.variantId} IS NULL`)))
      .leftJoin(inventories, eq(inventories.variantId, productVariants.id)).where(and(eq(flashSaleItems.campaignId, campaign.id), eq(products.status, "ACTIVE"), eq(productVariants.status, "ACTIVE")))
      .orderBy(asc(flashSaleItems.sortOrder), asc(flashSaleItems.id), sql`CASE WHEN ${productImages.variantId} = ${productVariants.id} THEN 0 ELSE 1 END`, asc(productImages.sortOrder), asc(productImages.id));
    const seen = new Set<string>();
    const items = rows.filter(({ item }) => !seen.has(item.id.toString()) && seen.add(item.id.toString())).map(({ item, product, variant, image, inventory }) => ({
      id: item.id.toString(), productId: product.id.toString(), variantId: variant.id.toString(), sku: variant.sku,
      name: product.name, variantName: variant.name, slug: product.slug, image,
      originalPrice: item.originalPriceSnapshot.toString(), flashPrice: item.flashPrice.toString(),
      discountPercent: Number(((item.originalPriceSnapshot - item.flashPrice) * 100n) / item.originalPriceSnapshot),
      quota: item.quota, soldQuantity: item.soldQuantity, reservedQuantity: item.reservedQuantity,
      availableQuantity: Math.max(0, item.quota - item.soldQuantity - item.reservedQuantity),
      stockAvailable: inventory ? Math.max(0, inventory.onHand - inventory.reserved) : 0,
      perCustomerLimit: item.perCustomerLimit, sortOrder: item.sortOrder,
    }));
    const [revenueRow] = await db.select({ revenue: sql<string>`coalesce(sum(${orderItems.lineTotal}) FILTER (WHERE ${orders.paymentStatus} = 'PAID'), 0)::text`, orderCount: sql<number>`count(distinct ${orders.id})::int` }).from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(orderItems.flashSaleCampaignId, campaign.id));
    const campaignOrders = await db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, paymentStatus: orders.paymentStatus, amount: sql<string>`sum(${orderItems.lineTotal})::text`, createdAt: orders.createdAt })
      .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(orderItems.flashSaleCampaignId, campaign.id))
      .groupBy(orders.id, orders.orderNumber, orders.status, orders.paymentStatus, orders.createdAt).orderBy(desc(orders.createdAt)).limit(20);
    const { status, createdBy, ...campaignData } = campaign;
    void status;
    void createdBy;
    return { ...campaignData, id: campaign.id.toString(), startsAt: campaign.startsAt.toISOString(), endsAt: campaign.endsAt.toISOString(), serverNow: serverNow.toISOString(), status: nowStatus(campaign, serverNow), revenue: revenueRow?.revenue ?? "0", orderCount: revenueRow?.orderCount ?? 0, orders: campaignOrders.map((order) => ({ ...order, id: order.id.toString(), amount: order.amount, createdAt: order.createdAt.toISOString() })), items };
  }

  async function listPublic() {
    if (cache?.isOpen) {
      try {
        const cached = await cache.get(PUBLIC_CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached) as { serverNow: string; campaigns: unknown[] };
          // Cache the campaign payload, never the clock used by customer countdowns.
          return { ...data, serverNow: new Date().toISOString() };
        }
      } catch { /* PostgreSQL remains authoritative. */ }
    }
    const serverNow = new Date();
    const rows = await db.select().from(flashSaleCampaigns).where(and(ne(flashSaleCampaigns.status, "DRAFT"), ne(flashSaleCampaigns.status, "CANCELLED"))).orderBy(asc(flashSaleCampaigns.startsAt));
    const campaigns = [];
    for (const row of rows) {
      if (row.endsAt <= serverNow && !["ENDED", "CANCELLED"].includes(row.status)) continue;
      const data = await campaignDetail(row);
      if (data.items.length) {
        const { revenue: _revenue, orderCount: _orderCount, orders: _orders, ...publicData } = data;
        void _revenue;
        void _orderCount;
        void _orders;
        campaigns.push(publicData);
      }
    }
    const result = { serverNow: serverNow.toISOString(), campaigns };
    if (cache?.isOpen) void cache.set(PUBLIC_CACHE_KEY, JSON.stringify(result), { EX: 2 }).catch(() => {});
    return result;
  }

  async function listAdmin(status?: string) {
    const rows = await db.select().from(flashSaleCampaigns).orderBy(asc(flashSaleCampaigns.startsAt));
    const result = [];
    for (const row of rows) result.push(await campaignDetail(row));
    return status ? result.filter((campaign) => campaign.status === status) : result;
  }

  async function assertNoConflicts(tx: Transaction, campaignId: bigint, variantIds: bigint[]) {
    const [current] = await tx.select().from(flashSaleCampaigns).where(eq(flashSaleCampaigns.id, campaignId)).limit(1);
    if (!current || !["ACTIVE", "SCHEDULED"].includes(current.status)) return;
    for (const variantId of [...variantIds].sort((a,b)=>a<b?-1:a>b?1:0)) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`flash-sale-variant:${variantId}`}, 0))`);
      const [conflict] = await tx.select({ id: flashSaleCampaigns.id }).from(flashSaleItems)
        .innerJoin(flashSaleCampaigns, eq(flashSaleCampaigns.id, flashSaleItems.campaignId))
        .where(and(eq(flashSaleItems.variantId, variantId), ne(flashSaleItems.campaignId, campaignId), ne(flashSaleCampaigns.status, "CANCELLED"), ne(flashSaleCampaigns.status, "DRAFT"), ne(flashSaleCampaigns.status, "PAUSED"), lt(flashSaleCampaigns.startsAt, current.endsAt), gt(flashSaleCampaigns.endsAt, current.startsAt))).limit(1);
      if (conflict) throw new AppError(409, "FLASH_SALE_CAMPAIGN_CONFLICT", "Sản phẩm đã thuộc một campaign Flash Sale trùng thời gian.");
    }
  }

  async function saveItems(tx: Transaction, campaignId: bigint, items: InputItem[], oldCampaignId?: bigint) {
    const variantIds = items.map((item) => BigInt(item.variantId));
    await assertNoConflicts(tx, campaignId, variantIds);
    const variants = await tx.select({ variant: productVariants, product: products }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(inArray(productVariants.id, variantIds));
    if (variants.length !== items.length || variants.some(({ variant, product }) => variant.status !== "ACTIVE" || product.status !== "ACTIVE")) throw new AppError(400, "FLASH_SALE_PRODUCT_INVALID", "Flash Sale chỉ nhận sản phẩm và biến thể đang hoạt động.");
    const existing = oldCampaignId ? await tx.select().from(flashSaleItems).where(eq(flashSaleItems.campaignId, oldCampaignId)).for("update") : [];
    const existingByVariant = new Map(existing.map((row) => [row.variantId.toString(), row]));
    if (oldCampaignId) for (const old of existing) if (!variantIds.includes(old.variantId) && old.reservedQuantity + old.soldQuantity > 0) throw new AppError(409, "FLASH_SALE_ITEM_HAS_ORDERS", "Không thể gỡ sản phẩm đã có reservation hoặc đơn hàng.");
    for (const input of items) {
      const record = variants.find(({ variant }) => variant.id === BigInt(input.variantId));
      if (!record) throw new AppError(400, "FLASH_SALE_PRODUCT_INVALID", "Không tìm thấy biến thể sản phẩm.");
      const price = BigInt(record.variant.price ?? record.product.price);
      if (BigInt(input.flashPrice) >= price) throw new AppError(400, "FLASH_SALE_PRICE_INVALID", `Giá Flash Sale phải thấp hơn giá hiện tại (${record.variant.sku}).`);
      const old = existingByVariant.get(input.variantId);
      const minimumQuota = old ? old.reservedQuantity + old.soldQuantity : 0;
      if (input.quota < minimumQuota) throw new AppError(409, "FLASH_SALE_QUOTA_TOO_LOW", "Quota không thể thấp hơn số lượng đang giữ và đã bán.");
      if (old && old.reservedQuantity > 0 && (old.flashPrice !== BigInt(input.flashPrice) || input.quota < old.quota)) throw new AppError(409, "FLASH_SALE_ITEM_RESERVED", "Không thể đổi giá hoặc giảm quota khi còn reservation.");
    }
    if (oldCampaignId) {
      for (const old of existing) if (!variantIds.includes(old.variantId)) await tx.delete(flashSaleItems).where(eq(flashSaleItems.id, old.id));
    }
    for (const input of items) {
      const record = variants.find(({ variant }) => variant.id === BigInt(input.variantId))!;
      const old = existingByVariant.get(input.variantId);
      const values = { campaignId, productId: record.product.id, variantId: record.variant.id, originalPriceSnapshot: BigInt(record.variant.price ?? record.product.price), flashPrice: BigInt(input.flashPrice), quota: input.quota, perCustomerLimit: input.perCustomerLimit, sortOrder: input.sortOrder, updatedAt: new Date() };
      if (old) await tx.update(flashSaleItems).set(values).where(eq(flashSaleItems.id, old.id));
      else await tx.insert(flashSaleItems).values(values);
    }
  }

  async function create(input: { name: string; slug?: string; description: string; startsAt: string; endsAt: string; status: string; items: InputItem[] }, user: SafeUser) {
    const startsAt = new Date(input.startsAt), endsAt = new Date(input.endsAt);
    const slug = input.slug || input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const campaign = await db.transaction(async (tx) => {
      const [row] = await tx.insert(flashSaleCampaigns).values({ name: input.name, slug, description: input.description, startsAt, endsAt, status: input.status as typeof flashSaleCampaigns.$inferInsert.status, createdBy: BigInt(user.id) }).returning();
      if (!row) throw new AppError(500, "FLASH_SALE_CREATE_FAILED", "Không thể tạo campaign.");
      await saveItems(tx, row.id, input.items);
      return row;
    });
    publish("flash-sale:campaign-updated", { campaignId: campaign.id.toString() });
    return campaignDetail(campaign);
  }

  async function update(id: string, input: Partial<{ name: string; slug: string; description: string; startsAt: string; endsAt: string; status: string; items: InputItem[] }>) {
    const campaignId = BigInt(id);
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(flashSaleCampaigns).where(eq(flashSaleCampaigns.id, campaignId)).for("update").limit(1);
      if (!row) throw new AppError(404, "FLASH_SALE_NOT_FOUND", "Không tìm thấy Flash Sale campaign.");
      const patch: Partial<typeof flashSaleCampaigns.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.slug !== undefined) patch.slug = input.slug;
      if (input.description !== undefined) patch.description = input.description;
      if (input.startsAt !== undefined) patch.startsAt = new Date(input.startsAt);
      if (input.endsAt !== undefined) patch.endsAt = new Date(input.endsAt);
      if (input.status !== undefined) patch.status = input.status as typeof row.status;
      const [updated] = await tx.update(flashSaleCampaigns).set(patch).where(eq(flashSaleCampaigns.id, campaignId)).returning();
      if (input.items) await saveItems(tx, campaignId, input.items, campaignId);
      else {
        const rows = await tx.select({ variantId: flashSaleItems.variantId }).from(flashSaleItems).where(eq(flashSaleItems.campaignId, campaignId));
        await assertNoConflicts(tx, campaignId, rows.map((item) => item.variantId));
      }
      return updated!;
    });
    publish("flash-sale:campaign-updated", { campaignId: id });
    return campaignDetail(result);
  }

  async function remove(id: string) {
    await update(id, { status: "CANCELLED" });
    publish("flash-sale:campaign-ended", { campaignId: id, status: "CANCELLED" });
  }

  async function detail(id: string) {
    const [row] = await db.select().from(flashSaleCampaigns).where(eq(flashSaleCampaigns.id, BigInt(id))).limit(1);
    if (!row) throw new AppError(404, "FLASH_SALE_NOT_FOUND", "Không tìm thấy Flash Sale campaign.");
    return campaignDetail(row);
  }

  async function publicDetail(id: string) {
    const [campaign] = await db.select().from(flashSaleCampaigns).where(eq(flashSaleCampaigns.id, BigInt(id))).limit(1);
    if (!campaign || ["DRAFT", "CANCELLED"].includes(campaign.status)) {
      throw new AppError(404, "FLASH_SALE_NOT_FOUND", "Không tìm thấy Flash Sale campaign.");
    }
    const data = await campaignDetail(campaign);
    const { revenue: _revenue, orderCount: _orderCount, orders: _orders, ...publicData } = data;
    void _revenue;
    void _orderCount;
    void _orders;
    return publicData;
  }

  async function announceTimeTransitions() {
    const now = new Date();
    const rows = await db.select().from(flashSaleCampaigns).where(and(ne(flashSaleCampaigns.status, "DRAFT"), ne(flashSaleCampaigns.status, "PAUSED"), ne(flashSaleCampaigns.status, "CANCELLED")));
    for (const row of rows) {
      const id = row.id.toString();
      if (now >= row.endsAt && !announcedEnds.has(id)) { announcedEnds.add(id); publish("flash-sale:campaign-ended", { campaignId: id }); }
      else if (now >= row.startsAt && now < row.endsAt && !announcedStarts.has(id)) { announcedStarts.add(id); publish("flash-sale:campaign-started", { campaignId: id }); }
    }
  }

  return { listPublic, listAdmin, create, update, remove, detail, publicDetail, announceTimeTransitions, subscribe: (listener: (event: string, payload: unknown) => void) => { listeners.add(listener); return () => listeners.delete(listener); }, notifyItemUpdated: (itemId: string) => publish("flash-sale:item-updated", { itemId }) };
}
export type FlashSalesService = ReturnType<typeof createFlashSalesService>;
