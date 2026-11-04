import { evaluateVoucher, redeemVoucher, releaseVoucher } from "../admin-operations/voucher.service.js";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gte, lt, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import { flashSaleCampaigns, flashSaleItems, flashSaleReservations, inventories, orderInventoryReservations, orderItems, orderStatusHistory, orders, productImages, productVariants, products, storeSettings, users } from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";
import { createInventoryService } from "../inventory/inventory.service.js";
import { recordOrderEmail } from "../email/order-email.outbox.js";
import { insertNotification } from "../notifications/notifications.service.js";

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type CreateOrderInput = {
  idempotencyKey: string;
  items: Array<{ variantId: string; quantity: number; flashSaleItemId?: string }>;
  shippingAddress: { fullName: string; phone: string; address: string; city: string; district?: string; ward?: string };
  paymentMethod: "COD";
  customerNote?: string;
  voucherCode?: string;
};
type SafeUser = { id: number; email: string; fullName: string | null };
type CheckoutLine = { variantId: bigint; productId: bigint; productName: string; variantName: string | null; sku: string; imageUrl: string | null; quantity: number; unitPrice: bigint; availableQuantity: number | null; flashSaleCampaignId?: bigint; flashSaleItemId?: bigint; flashSaleOriginalPrice?: bigint };
const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
const emailEvent: Partial<Record<OrderStatus, "ORDER_CONFIRMED" | "ORDER_PROCESSING" | "ORDER_SHIPPED" | "ORDER_DELIVERED" | "ORDER_CANCELLED">> = {
  CONFIRMED: "ORDER_CONFIRMED", PROCESSING: "ORDER_PROCESSING", SHIPPED: "ORDER_SHIPPED", DELIVERED: "ORDER_DELIVERED", CANCELLED: "ORDER_CANCELLED",
};
const asId = (value: string | number | bigint) => BigInt(value);
const hashInput = (input: CreateOrderInput) => createHash("sha256").update(JSON.stringify({ items: [...input.items].sort((a, b) => a.variantId.localeCompare(b.variantId)), shippingAddress: input.shippingAddress, paymentMethod: input.paymentMethod, customerNote: input.customerNote ?? null, voucherCode: input.voucherCode ?? null })).digest("hex");
async function transactionWithRetry<T>(db: Database, work: (tx: Transaction) => Promise<T>) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await db.transaction(work); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (!(["40P01", "40001"].includes(String(code))) || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (2 ** attempt)));
    }
  }
}

function serialize(row: typeof orders.$inferSelect) {
  return {
    id: row.id.toString(), orderNumber: row.orderNumber, userId: row.userId.toString(), status: row.status,
    paymentMethod: row.paymentMethod, paymentStatus: row.paymentStatus, subtotal: row.subtotal.toString(),
    shippingFee: row.shippingFee.toString(), discountAmount: row.discountAmount.toString(), totalAmount: row.totalAmount.toString(),
    shippingAddress: { fullName: row.shippingFullName, phone: row.shippingPhone, address: row.shippingAddress, city: row.shippingCity, district: row.shippingDistrict, ward: row.shippingWard }, customerEmail: row.customerEmail,
    customerNote: row.customerNote, voucherCode: row.voucherCode, cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

async function orderDetail(db: Database, id: bigint) {
  const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!row) return null;
  const [items, history] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id)).orderBy(asc(orderStatusHistory.createdAt), asc(orderStatusHistory.id)),
  ]);
  const [customer] = await db.select({ fullName: users.fullName, email: users.email }).from(users).where(eq(users.id, Number(row.userId))).limit(1);
  return {
    ...serialize(row), orderNumber: row.orderNumber,
    customer: { name: customer?.fullName ?? row.shippingFullName, email: customer?.email ?? "" },
    items: items.map((item) => ({ id: item.id.toString(), productId: item.productId.toString(), variantId: item.variantId.toString(), sku: item.sku, name: item.productName, variantName: item.variantName, image: item.imageUrl, quantity: item.quantity, unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString(), flashSaleCampaignId: item.flashSaleCampaignId?.toString() ?? null, flashSaleItemId: item.flashSaleItemId?.toString() ?? null, flashSaleOriginalPrice: item.flashSaleOriginalPrice?.toString() ?? null, flashSaleDiscountAmount: item.flashSaleDiscountAmount?.toString() ?? null })),
    statusHistory: history.map((event) => ({ id: event.id.toString(), fromStatus: event.fromStatus, toStatus: event.toStatus, changedBy: event.changedBy?.toString() ?? null, note: event.note, createdAt: event.createdAt.toISOString() })),
  };
}

async function getCatalogLines(tx: Transaction, items: CreateOrderInput["items"]): Promise<CheckoutLine[]> {
  const requestByVariant = new Map<string, { variantId: string; quantity: number; flashSaleItemId?: string }>();
  for (const item of items) {
    const key = `${item.variantId}:${item.flashSaleItemId ?? "standard"}`;
    const prior = requestByVariant.get(key);
    requestByVariant.set(key, { variantId: item.variantId, quantity: (prior?.quantity ?? 0) + item.quantity, ...(item.flashSaleItemId ? { flashSaleItemId: item.flashSaleItemId } : {}) });
  }
  const requests = [...requestByVariant.values()].map((value) => ({ ...value, variantId: BigInt(value.variantId) })).sort((a, b) => a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : a.flashSaleItemId?.localeCompare(b.flashSaleItemId ?? "") ?? 0);
  const lines: CheckoutLine[] = [];
  for (const request of requests) {
    const [record] = await tx.select({ variantId: productVariants.id, variantName: productVariants.name, sku: productVariants.sku, variantPrice: productVariants.price, variantStatus: productVariants.status, productId: products.id, productName: products.name, productPrice: products.price, productStatus: products.status }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(productVariants.id, request.variantId)).limit(1);
    if (!record || record.variantStatus !== "ACTIVE" || record.productStatus !== "ACTIVE") throw new AppError(409, "PRODUCT_UNAVAILABLE", "Một sản phẩm đã chọn không còn được bán.");
    const [image] = await tx.select({ url: productImages.url }).from(productImages)
      .where(and(eq(productImages.productId, record.productId), or(eq(productImages.variantId, record.variantId), isNull(productImages.variantId))))
      .orderBy(sql`CASE WHEN ${productImages.variantId} = ${record.variantId} THEN 0 ELSE 1 END`, asc(productImages.sortOrder), asc(productImages.id)).limit(1);
    lines.push({ variantId: record.variantId, productId: record.productId, productName: record.productName, variantName: record.variantName, sku: record.sku, imageUrl: image?.url ?? null, quantity: request.quantity, unitPrice: BigInt(record.variantPrice ?? record.productPrice), availableQuantity: null, ...(request.flashSaleItemId ? { flashSaleItemId: BigInt(request.flashSaleItemId) } : {}) });
  }
  const variantIds = [...new Set(lines.map((line) => line.variantId.toString()))].map(BigInt);
  if (variantIds.length) {
    await tx.insert(inventories).values(variantIds.map((variantId) => ({ variantId, onHand: 0, reserved: 0 }))).onConflictDoNothing();
    const stocks = await tx.select().from(inventories).where(inArray(inventories.variantId, variantIds)).orderBy(asc(inventories.variantId)).for("update");
    const byVariant = new Map(stocks.map((stock) => [stock.variantId.toString(), stock]));
    for (const line of lines) {
      const stock = byVariant.get(line.variantId.toString());
      line.availableQuantity = stock ? stock.onHand - stock.reserved : 0;
    }
  }
  return lines;
}

async function priceAndReserveFlashSale(tx: Transaction, lines: CheckoutLine[], userId: number, reserve: boolean) {
  const now = new Date();
  for (const line of lines) {
    if (!line.flashSaleItemId) continue;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`flash-sale:${line.flashSaleItemId}:${userId}`}, 0))`);
    const [record] = await tx.select({ item: flashSaleItems, campaign: flashSaleCampaigns })
      .from(flashSaleItems).innerJoin(flashSaleCampaigns, eq(flashSaleCampaigns.id, flashSaleItems.campaignId))
      .where(and(eq(flashSaleItems.id, line.flashSaleItemId), eq(flashSaleItems.variantId, line.variantId))).for("update").limit(1);
    if (!record || !["SCHEDULED", "ACTIVE"].includes(record.campaign.status) || now < record.campaign.startsAt || now >= record.campaign.endsAt) throw new AppError(409, "FLASH_SALE_UNAVAILABLE", "Flash Sale đã bắt đầu/kết thúc hoặc không còn khả dụng. Vui lòng xác nhận lại giỏ hàng.");
    if (record.item.flashPrice >= line.unitPrice) throw new AppError(409, "FLASH_SALE_PRICE_INVALID", "Giá sản phẩm đã thay đổi; Flash Sale không còn thấp hơn giá hiện tại. Vui lòng xác nhận lại.");
    const consumed = await tx.select({ quantity: sql<number>`coalesce(sum(${flashSaleReservations.quantity}), 0)::int` }).from(flashSaleReservations)
      .where(and(eq(flashSaleReservations.flashSaleItemId, record.item.id), eq(flashSaleReservations.userId, BigInt(userId)), or(eq(flashSaleReservations.status, "CONSUMED"), eq(flashSaleReservations.status, "RESERVED"))));
    if (Number(consumed[0]?.quantity ?? 0) + line.quantity > record.item.perCustomerLimit) throw new AppError(409, "FLASH_SALE_CUSTOMER_LIMIT", "Bạn đã đạt giới hạn mua Flash Sale cho sản phẩm này.");
    if (line.quantity > record.item.quota - record.item.reservedQuantity - record.item.soldQuantity) throw new AppError(409, "FLASH_SALE_SOLD_OUT", "Flash Sale đã hết số lượng khả dụng.");
    line.flashSaleCampaignId = record.campaign.id;
    line.flashSaleOriginalPrice = record.item.originalPriceSnapshot;
    line.unitPrice = record.item.flashPrice;
    if (reserve) {
      const [updated] = await tx.update(flashSaleItems).set({ reservedQuantity: sql`${flashSaleItems.reservedQuantity} + ${line.quantity}`, updatedAt: now })
        .where(and(eq(flashSaleItems.id, record.item.id), sql`${flashSaleItems.reservedQuantity} + ${flashSaleItems.soldQuantity} + ${line.quantity} <= ${flashSaleItems.quota}`)).returning({ id: flashSaleItems.id });
      if (!updated) throw new AppError(409, "FLASH_SALE_SOLD_OUT", "Flash Sale vừa hết số lượng khả dụng.");
    }
  }
}

function totals(lines: CheckoutLine[], standardShippingFee: bigint, freeShippingThreshold: bigint) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * BigInt(line.quantity), 0n);
  const fee = subtotal >= freeShippingThreshold ? 0n : standardShippingFee;
  const discount = 0n;
  return { subtotal, shippingFee: fee, discountAmount: discount, totalAmount: subtotal + fee - discount };
}

async function applyReservationTransition(tx: Transaction, orderId: bigint, confirm: boolean) {
  const links = await tx.select({ reservationId: orderInventoryReservations.reservationId }).from(orderInventoryReservations).where(eq(orderInventoryReservations.orderId, orderId));
  const inventory = createInventoryService(tx as unknown as Database);
  if (!links.length) throw new AppError(409, "ORDER_RESERVATION_MISSING", "Đơn hàng thiếu giữ chỗ tồn kho.");
  for (const link of links) {
    const reservation = confirm ? await inventory.confirmReservation(link.reservationId, tx) : await inventory.releaseReservation(link.reservationId, tx);
    if (confirm && reservation.status !== "CONFIRMED") throw new AppError(409, "ORDER_RESERVATION_UNAVAILABLE", "Giữ chỗ tồn kho không còn hiệu lực.");
    if (!confirm && reservation.status === "CONFIRMED") throw new AppError(409, "ORDER_ALREADY_DISPATCHED", "Đơn hàng đã xuất kho.");
  }
}

async function applyFlashSaleTransition(tx: Transaction, orderId: bigint, consume: boolean, releaseStatus: "RELEASED" | "EXPIRED" = "RELEASED") {
  const reservations = await tx.select().from(flashSaleReservations).where(and(eq(flashSaleReservations.orderId, orderId), eq(flashSaleReservations.status, "RESERVED"))).for("update");
  for (const reservation of reservations) {
    const [item] = await tx.select().from(flashSaleItems).where(eq(flashSaleItems.id, reservation.flashSaleItemId)).for("update").limit(1);
    if (!item || item.reservedQuantity < reservation.quantity) throw new AppError(409, "FLASH_SALE_RESERVATION_UNAVAILABLE", "Giữ chỗ Flash Sale không còn hiệu lực.");
    await tx.update(flashSaleItems).set({ reservedQuantity: item.reservedQuantity - reservation.quantity, soldQuantity: consume ? item.soldQuantity + reservation.quantity : item.soldQuantity, updatedAt: new Date() }).where(eq(flashSaleItems.id, item.id));
    await tx.update(flashSaleReservations).set({ status: consume ? "CONSUMED" : releaseStatus, updatedAt: new Date() }).where(eq(flashSaleReservations.id, reservation.id));
  }
}

async function emailPayload(tx: Transaction, order: typeof orders.$inferSelect) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return {
    orderNumber: order.orderNumber, createdAt: order.createdAt.toISOString(),
    items: items.map((item) => ({ name: item.productName, sku: item.sku, ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}), quantity: item.quantity, unitPrice: item.unitPrice.toString() })),
    subtotal: order.subtotal.toString(), shipping: order.shippingFee.toString(), discount: order.discountAmount.toString(), total: order.totalAmount.toString(),
    shippingAddress: { recipient: order.shippingFullName, phone: order.shippingPhone, line1: order.shippingAddress, city: order.shippingCity, ...(order.shippingDistrict ? { district: order.shippingDistrict } : {}), ...(order.shippingWard ? { ward: order.shippingWard } : {}) },
  };
}

export function createOrdersService(db: Database, onFlashSaleUpdate: (itemId: string) => void = () => {}) {
  async function preview(input: Omit<CreateOrderInput, "idempotencyKey" | "customerNote">, userId = 0) {
    const { lines, settings } = await db.transaction(async (tx) => {
      const [settings] = await tx.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
      if (!settings) throw new AppError(500, "STORE_SETTINGS_MISSING", "Store shipping settings are unavailable.");
      const lines = await getCatalogLines(tx, input.items);
      await priceAndReserveFlashSale(tx, lines, userId, false);
      return { lines, settings };
    });
    if (input.voucherCode && lines.some((line) => line.flashSaleItemId)) throw new AppError(409, "FLASH_SALE_VOUCHER_NOT_STACKABLE", "Mã giảm giá không áp dụng đồng thời với Flash Sale.");
    if (!settings.codEnabled) throw new AppError(409, "COD_DISABLED", "Thanh toán khi nhận hàng hiện chưa khả dụng.");
    const amounts = totals(lines, settings.standardShippingFee, settings.freeShippingThreshold);
    const { discount } = await db.transaction((tx) => evaluateVoucher(tx, input.voucherCode, amounts.subtotal, userId));
    const { subtotal, shippingFee: fee } = amounts;
    const discountAmount = discount, totalAmount = subtotal + fee - discount;
    const warnings = lines.filter((line) => line.availableQuantity === null || line.availableQuantity < line.quantity).map((line) => ({ variantId: line.variantId.toString(), sku: line.sku, code: "INSUFFICIENT_STOCK" }));
    return { items: lines.map((line) => ({ variantId: line.variantId.toString(), productId: line.productId.toString(), sku: line.sku, name: line.productName, variantName: line.variantName, image: line.imageUrl, quantity: line.quantity, unitPrice: line.unitPrice.toString(), lineTotal: (line.unitPrice * BigInt(line.quantity)).toString(), availableQuantity: line.availableQuantity, flashSaleCampaignId: line.flashSaleCampaignId?.toString() ?? null, flashSaleItemId: line.flashSaleItemId?.toString() ?? null, flashSaleOriginalPrice: line.flashSaleOriginalPrice?.toString() ?? null, flashSaleDiscountAmount: line.flashSaleOriginalPrice ? ((line.flashSaleOriginalPrice - line.unitPrice) * BigInt(line.quantity)).toString() : null })), subtotal: subtotal.toString(), shippingFee: fee.toString(), discountAmount: discountAmount.toString(), totalAmount: totalAmount.toString(), warnings };
  }

  async function create(input: CreateOrderInput, user: SafeUser) {
    const requestHash = hashInput(input);
    const existingOrder = async () => {
      const [existing] = await db.select().from(orders).where(and(eq(orders.userId, BigInt(user.id)), eq(orders.idempotencyKey, input.idempotencyKey))).limit(1);
      if (!existing) return null;
      if (existing.requestHash !== requestHash) throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key đã được dùng cho nội dung đơn hàng khác.");
      return { order: await orderDetail(db, existing.id), replayed: true };
    };
    const replay = await existingOrder();
    if (replay) return replay;
    try {
      const orderId = await transactionWithRetry(db, async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${user.id}:${input.idempotencyKey}`}, 0))`);
        const [retry] = await tx.select().from(orders).where(and(eq(orders.userId, BigInt(user.id)), eq(orders.idempotencyKey, input.idempotencyKey))).limit(1);
        if (retry) {
          if (retry.requestHash !== requestHash) throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key đã được dùng cho nội dung khác.");
          return { id: retry.id, replayed: true };
        }
        const [settings] = await tx.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
        if (!settings) throw new AppError(500, "STORE_SETTINGS_MISSING", "Store shipping settings are unavailable.");
        if (!settings.codEnabled) throw new AppError(409, "COD_DISABLED", "Thanh toán khi nhận hàng hiện chưa khả dụng.");
        const lines = await getCatalogLines(tx, input.items);
        for (const line of lines) if ((line.availableQuantity ?? 0) < line.quantity) throw new AppError(409, "INSUFFICIENT_STOCK", `Sản phẩm ${line.sku} không đủ tồn kho.`);
        await priceAndReserveFlashSale(tx, lines, user.id, true);
        if (input.voucherCode && lines.some((line) => line.flashSaleItemId)) throw new AppError(409, "FLASH_SALE_VOUCHER_NOT_STACKABLE", "Mã giảm giá không áp dụng đồng thời với Flash Sale.");
        const amounts = totals(lines, settings.standardShippingFee, settings.freeShippingThreshold);
        const applied = await evaluateVoucher(tx, input.voucherCode, amounts.subtotal, user.id, true);
        amounts.discountAmount = applied.discount; amounts.totalAmount -= applied.discount;
        const now = new Date();
        const orderNumber = `TN-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
        const [order] = await tx.insert(orders).values({ orderNumber, userId: BigInt(user.id), idempotencyKey: input.idempotencyKey, requestHash, status: "PENDING", paymentMethod: "COD", paymentStatus: "UNPAID", subtotal: amounts.subtotal, shippingFee: amounts.shippingFee, discountAmount: amounts.discountAmount, totalAmount: amounts.totalAmount, shippingFullName: input.shippingAddress.fullName, shippingPhone: input.shippingAddress.phone, customerEmail: user.email, shippingAddress: input.shippingAddress.address, shippingCity: input.shippingAddress.city, shippingDistrict: input.shippingAddress.district ?? null, shippingWard: input.shippingAddress.ward ?? null, customerNote: input.customerNote ?? null, voucherCode: applied.voucher?.code ?? null, createdAt: now, updatedAt: now }).returning();
        if (!order) throw new AppError(500, "ORDER_CREATE_FAILED", "Không thể tạo đơn hàng.");
        for (const line of lines) if (line.flashSaleItemId && line.flashSaleCampaignId) {
          await tx.insert(flashSaleReservations).values({ flashSaleItemId: line.flashSaleItemId, userId: BigInt(user.id), orderId: order.id, quantity: line.quantity, status: "RESERVED", expiresAt: new Date(now.getTime() + 15 * 60_000), idempotencyKey: `${user.id}:${createHash("sha256").update(`${input.idempotencyKey}:${line.flashSaleItemId}`).digest("hex")}` });
        }
        if (applied.voucher) await redeemVoucher(tx, applied.voucher.id, user.id, order.id, applied.discount);
        const reservationIds: bigint[] = [];
        const inventoryQuantityByVariant = new Map<string, { variantId: bigint; quantity: number }>();
        for (const line of lines) {
          const prior = inventoryQuantityByVariant.get(line.variantId.toString());
          inventoryQuantityByVariant.set(line.variantId.toString(), { variantId: line.variantId, quantity: (prior?.quantity ?? 0) + line.quantity });
          await tx.insert(orderItems).values({ orderId: order.id, productId: line.productId, variantId: line.variantId, sku: line.sku, productName: line.productName, variantName: line.variantName, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.unitPrice * BigInt(line.quantity), imageUrl: line.imageUrl, flashSaleCampaignId: line.flashSaleCampaignId ?? null, flashSaleItemId: line.flashSaleItemId ?? null, flashSaleOriginalPrice: line.flashSaleOriginalPrice ?? null, flashSaleDiscountAmount: line.flashSaleOriginalPrice ? (line.flashSaleOriginalPrice - line.unitPrice) * BigInt(line.quantity) : null });
        }
        for (const { variantId, quantity } of [...inventoryQuantityByVariant.values()].sort((a,b)=>a.variantId<b.variantId?-1:1)) {
          const result = await createInventoryService(db).reserveStock(variantId, quantity, { type: "order", id: order.id.toString() }, { transaction: tx, idempotencyKey: `order:${order.id}:reserve:${variantId}` });
          reservationIds.push(BigInt(result.reservation.id));
        }
        if (reservationIds.length) await tx.insert(orderInventoryReservations).values(reservationIds.map((reservationId) => ({ orderId: order.id, reservationId })));
        await tx.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: null, toStatus: "PENDING", changedBy: BigInt(user.id), note: "Đơn hàng được tạo" });
        await recordOrderEmail(tx, { event: "ORDER_PLACED", orderId: order.id.toString(), orderNumber, recipientEmail: user.email, recipientName: input.shippingAddress.fullName, payload: await emailPayload(tx, order) });
        return { id: order.id, replayed: false };
      });
      if (!orderId.replayed) for (const item of input.items) if (item.flashSaleItemId) onFlashSaleUpdate(item.flashSaleItemId);
      return { order: await orderDetail(db, orderId.id), replayed: orderId.replayed };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        const raced = await existingOrder();
        if (raced) return raced;
      }
      throw error;
    }
  }

  async function transition(idValue: string, nextStatus: OrderStatus, changedBy: number, note?: string, customerId?: number) {
    const id = asId(idValue);
    const changed = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update").limit(1);
      if (!order || (customerId !== undefined && order.userId !== BigInt(customerId))) throw new AppError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
      if (order.status === nextStatus) return { order, changed: false, notification: null };
      if (!statusTransitions[order.status].includes(nextStatus)) throw new AppError(409, "INVALID_ORDER_TRANSITION", `Không thể chuyển đơn từ ${order.status} sang ${nextStatus}.`);
      if (nextStatus === "SHIPPED") { await applyReservationTransition(tx, id, true); await applyFlashSaleTransition(tx, id, true); }
      if (nextStatus === "CANCELLED") { await applyReservationTransition(tx, id, false); await applyFlashSaleTransition(tx, id, false); await releaseVoucher(tx, id); }
      const now = new Date();
      const [updated] = await tx.update(orders).set({ status: nextStatus, paymentStatus: nextStatus === "DELIVERED" ? "PAID" : order.paymentStatus, cancelledAt: nextStatus === "CANCELLED" ? now : order.cancelledAt, updatedAt: now }).where(and(eq(orders.id, id), eq(orders.status, order.status))).returning();
      if (!updated) throw new AppError(409, "ORDER_CHANGED_CONCURRENTLY", "Đơn hàng vừa được cập nhật bởi yêu cầu khác.");
      await tx.insert(orderStatusHistory).values({ orderId: id, fromStatus: order.status, toStatus: nextStatus, changedBy: BigInt(changedBy), note: note ?? null });
      const event = emailEvent[nextStatus];
      if (event) await recordOrderEmail(tx, { event, orderId: id.toString(), orderNumber: order.orderNumber, recipientEmail: order.customerEmail, recipientName: order.shippingFullName, payload: await emailPayload(tx, order) });
      const notificationType = nextStatus === "CANCELLED" ? "ORDER_CANCELLED" : nextStatus === "DELIVERED" ? "ORDER_DELIVERED" : "ORDER_STATUS_UPDATED";
      const statusLabel: Record<OrderStatus, string> = { PENDING: "đang chờ xác nhận", CONFIRMED: "đã được xác nhận", PROCESSING: "đang được chuẩn bị", SHIPPED: "đã được bàn giao cho đơn vị vận chuyển", DELIVERED: "đã giao thành công", CANCELLED: "đã bị hủy" };
      const notification = await insertNotification(tx, {
        recipientUserId: order.userId,
        type: notificationType,
        title: nextStatus === "CANCELLED" ? "Đơn hàng đã bị hủy" : nextStatus === "DELIVERED" ? "Đơn hàng đã giao thành công" : "Cập nhật đơn hàng",
        message: `Đơn hàng ${order.orderNumber} ${statusLabel[nextStatus]}.`,
        entityType: "ORDER", entityId: id.toString(), targetUrl: `/account/orders/${id}`,
        eventKey: `order:${id}:status:${nextStatus}`,
      });
      return { order: updated, changed: true, notification };
    });
    if (changed.changed && ["SHIPPED", "CANCELLED"].includes(nextStatus)) {
      const saleLines = await db.select({ itemId: orderItems.flashSaleItemId }).from(orderItems).where(and(eq(orderItems.orderId, id), sql`${orderItems.flashSaleItemId} IS NOT NULL`));
      for (const line of saleLines) if (line.itemId) onFlashSaleUpdate(line.itemId.toString());
    }
    return { order: await orderDetail(db, changed.order.id), changed: changed.changed, notification: changed.notification };
  }

  async function expireFlashSaleOrders() {
    const now = new Date();
    const expired = await db.select({ orderId: flashSaleReservations.orderId }).from(flashSaleReservations)
      .where(and(eq(flashSaleReservations.status, "RESERVED"), lt(flashSaleReservations.expiresAt, now)))
      .groupBy(flashSaleReservations.orderId).limit(100);
    const events: Array<{ userId: string; orderId: string; orderNumber: string; status: string; updatedAt: string; notification: Awaited<ReturnType<typeof insertNotification>> | null }> = [];
    for (const candidate of expired) {
      if (!candidate.orderId) continue;
      const result = await db.transaction(async (tx) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, candidate.orderId!)).for("update").limit(1);
        const stale = await tx.select({ id: flashSaleReservations.id }).from(flashSaleReservations).where(and(eq(flashSaleReservations.orderId, candidate.orderId!), eq(flashSaleReservations.status, "RESERVED"), lt(flashSaleReservations.expiresAt, now))).for("update");
        if (!order || !stale.length || ["CANCELLED", "SHIPPED", "DELIVERED"].includes(order.status)) return null;
        if (order.status !== "PENDING") {
          await tx.update(flashSaleReservations).set({ expiresAt: new Date(now.getTime() + 15 * 60_000), updatedAt: now }).where(inArray(flashSaleReservations.id, stale.map((row) => row.id)));
          return null;
        }
        await applyReservationTransition(tx, order.id, false);
        await applyFlashSaleTransition(tx, order.id, false, "EXPIRED");
        await releaseVoucher(tx, order.id);
        const [updated] = await tx.update(orders).set({ status: "CANCELLED", cancelledAt: now, updatedAt: now }).where(and(eq(orders.id, order.id), eq(orders.status, "PENDING"))).returning();
        if (!updated) return null;
        await tx.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: "PENDING", toStatus: "CANCELLED", changedBy: null, note: "Đơn Flash Sale hết thời gian giữ chỗ" });
        await recordOrderEmail(tx, { event: "ORDER_CANCELLED", orderId: order.id.toString(), orderNumber: order.orderNumber, recipientEmail: order.customerEmail, recipientName: order.shippingFullName, payload: await emailPayload(tx, updated) });
        const notification = await insertNotification(tx, { recipientUserId: order.userId, type: "ORDER_CANCELLED", title: "Đơn Flash Sale đã hết hạn", message: `Đơn hàng ${order.orderNumber} đã được hủy vì hết thời gian giữ chỗ.`, entityType: "ORDER", entityId: order.id.toString(), targetUrl: `/account/orders/${order.id}`, eventKey: `order:${order.id}:flash-sale-expired` });
        return { userId: order.userId.toString(), orderId: order.id.toString(), orderNumber: order.orderNumber, status: "CANCELLED", updatedAt: updated.updatedAt.toISOString(), notification };
      });
      if (result) {
        events.push(result);
        const saleItems = await db.select({ itemId: orderItems.flashSaleItemId }).from(orderItems).where(and(eq(orderItems.orderId, BigInt(result.orderId)), sql`${orderItems.flashSaleItemId} IS NOT NULL`));
        for (const saleItem of saleItems) if (saleItem.itemId) onFlashSaleUpdate(saleItem.itemId.toString());
      }
    }
    return events;
  }

  async function listForCustomer(userId: number, page: number, limit: number, filter: { q?: string; status?: OrderStatus } = {}) {
    const where = and(eq(orders.userId, BigInt(userId)), filter.status ? eq(orders.status, filter.status) : undefined, filter.q ? ilike(orders.orderNumber, `%${filter.q}%`) : undefined);
    const [rows, totals] = await Promise.all([db.select().from(orders).where(where).orderBy(desc(orders.createdAt), desc(orders.id)).limit(limit).offset((page - 1) * limit), db.select({ total: count() }).from(orders).where(where)]);
    const total = Number(totals[0]?.total ?? 0);
    return { items: rows.map(serialize), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async function listForAdmin(input: { page: number; limit: number; q?: string; status?: OrderStatus; paymentStatus?: "UNPAID" | "PAID"; dateFrom?: string; dateTo?: string; sort?: "newest" | "oldest" }) {
    const end = input.dateTo ? new Date(new Date(`${input.dateTo}T00:00:00+07:00`).getTime() + 86_400_000) : undefined;
    const where = and(input.status ? eq(orders.status, input.status) : undefined,
      input.paymentStatus ? eq(orders.paymentStatus, input.paymentStatus) : undefined,
      input.dateFrom ? gte(orders.createdAt, new Date(`${input.dateFrom}T00:00:00+07:00`)) : undefined,
      end ? lt(orders.createdAt, end) : undefined,
      input.q ? or(ilike(orders.orderNumber, `%${input.q}%`), ilike(orders.shippingFullName, `%${input.q}%`), ilike(orders.customerEmail, `%${input.q}%`), ilike(orders.shippingPhone, `%${input.q}%`), ilike(sql`${orders.userId}::text`, `%${input.q}%`)) : undefined);
    const [rows, totals] = await Promise.all([db.select().from(orders).where(where)
      .orderBy(input.sort === "oldest" ? asc(orders.createdAt) : desc(orders.createdAt), desc(orders.id)).limit(input.limit).offset((input.page - 1) * input.limit),
      db.select({ total: count() }).from(orders).where(where)]);
    const total = Number(totals[0]?.total ?? 0);
    return { items: rows.map(serialize), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async function detailForCustomer(userId: number, idValue: string) {
    const [row] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, asId(idValue)), eq(orders.userId, BigInt(userId)))).limit(1);
    if (!row) throw new AppError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
    return orderDetail(db, row.id);
  }

  async function detailForAdmin(idValue: string) {
    const detail = await orderDetail(db, asId(idValue));
    if (!detail) throw new AppError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
    return detail;
  }


  return { preview, create, transition, expireFlashSaleOrders, listForCustomer, listForAdmin, detailForCustomer, detailForAdmin };
}

export type OrdersService = ReturnType<typeof createOrdersService>;
