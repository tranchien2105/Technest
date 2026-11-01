import { randomUUID, createHash } from "node:crypto";
import argon2 from "argon2";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  users,
  authSessions,
  banners,
  vouchers,
  products,
  productVariants,
  categories,
  brands,
  adminOperations,
  auditLogs,
  orderEmailOutbox,
  afterSalesRequests,
  orderItems,
  productImages,
  orders,
} from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";
import { createInventoryService } from "../inventory/inventory.service.js";
import { type Database, type ListInput, jsonValue, pageResult } from "./common.js";
import type {
  bannerInput,
  voucherInput,
  bulkInput,
  staffInput,
  afterSalesInput,
  afterSalesUpdate,
} from "./operations.schemas.js";

const offset = (q: ListInput) => (q.page - 1) * q.limit;
const missing = () => new AppError(404, "NOT_FOUND", "Không tìm thấy bản ghi.");
export function adjustedPrice(original: string, mode: string, value: string) {
  const amount = BigInt(value),
    price = BigInt(original);
  const result =
    mode === "SET"
      ? amount
      : mode === "INCREASE_PERCENT"
        ? price + (price * amount) / 100n
        : price - (price * amount) / 100n;
  if (result < 0n || result > 999999999999999999n)
    throw new AppError(400, "PRICE_OUT_OF_RANGE", "Giá sau cập nhật nằm ngoài giới hạn hỗ trợ.");
  return result.toString();
}
export function createOperationsService(db: Database) {
  async function listBanners(q: ListInput) {
    const where = and(
      q.q ? ilike(banners.title, `%${q.q}%`) : undefined,
      q.status ? eq(banners.active, q.status === "ACTIVE") : undefined,
      q.type === "UNASSIGNED" ? isNull(banners.position) : q.type ? eq(banners.position, q.type) : undefined,
    );
    const [items, total] = await Promise.all([
      db
        .select()
        .from(banners)
        .where(where)
        .orderBy(asc(banners.sortOrder), desc(banners.id))
        .limit(q.limit)
        .offset(offset(q)),
      db.select({ n: count() }).from(banners).where(where),
    ]);
    return pageResult(q, items, total[0]!.n);
  }
  async function publicBanners(position?: "HOME_HERO" | "HOME_HERO_RIGHT_TOP" | "HOME_HERO_RIGHT_BOTTOM" | "HOME_PROMO" | "HOME_BOTTOM" | "HOME_SETUP_STUDIO") {
    const homepageLimit = position ? 10 : 60;
    return jsonValue(
      await db
        .select()
        .from(banners)
        .where(
          and(
            eq(banners.active, true),
            position ? eq(banners.position, position) : undefined,
            sql`(${banners.startsAt} is null or ${banners.startsAt} <= now())`,
            sql`(${banners.endsAt} is null or ${banners.endsAt} > now())`,
          ),
        )
        .orderBy(asc(banners.sortOrder), desc(banners.id))
        .limit(homepageLimit),
    );
  }
  async function saveBannerPlacements(placements: Record<string, string[]>) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE store_banners IN SHARE ROW EXCLUSIVE MODE`);
      const ids = Object.values(placements).flat();
      const rows = ids.length ? await tx.select({ id: banners.id }).from(banners).where(inArray(banners.id, ids.map(BigInt))) : [];
      if (rows.length !== ids.length) throw new AppError(404, "BANNER_NOT_FOUND", "Một hoặc nhiều banner không còn tồn tại.");
      await tx.update(banners).set({ position: null, sortOrder: 0, updatedAt: new Date() }).where(inArray(banners.position, Object.keys(placements)));
      for (const [position, bannerIds] of Object.entries(placements)) {
        for (const [sortOrder, id] of bannerIds.entries()) {
          await tx.update(banners).set({ position, sortOrder, updatedAt: new Date() }).where(eq(banners.id, BigInt(id)));
        }
      }
      return { saved: ids.length };
    });
  }
  async function getBannerPlacements() {
    const rows = await db.select().from(banners).where(inArray(banners.position, ["HOME_HERO", "HOME_HERO_RIGHT_TOP", "HOME_HERO_RIGHT_BOTTOM", "HOME_PROMO", "HOME_BOTTOM", "HOME_SETUP_STUDIO"])).orderBy(asc(banners.sortOrder), desc(banners.id));
    const placements: Record<string, unknown[]> = { HOME_HERO: [], HOME_HERO_RIGHT_TOP: [], HOME_HERO_RIGHT_BOTTOM: [], HOME_PROMO: [], HOME_BOTTOM: [], HOME_SETUP_STUDIO: [] };
    for (const row of rows) placements[row.position!]?.push(row);
    return jsonValue({ placements });
  }
  async function getBanner(id: string) {
    const [row] = await db.select().from(banners).where(eq(banners.id, BigInt(id))).limit(1);
    if (!row) throw missing();
    return jsonValue(row);
  }
  async function saveBanner(input: z.infer<typeof bannerInput>, id?: string) {
    const value = {
      ...input,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      updatedAt: new Date(),
    };
    const [row] = id
      ? await db
          .update(banners)
          .set(value)
          .where(eq(banners.id, BigInt(id)))
          .returning()
      : await db.insert(banners).values(value).returning();
    if (!row) throw missing();
    return jsonValue(row);
  }
  async function deleteBanner(id: string) {
    const [row] = await db
      .delete(banners)
      .where(eq(banners.id, BigInt(id)))
      .returning({ id: banners.id });
    if (!row) throw missing();
    return jsonValue(row);
  }
  async function listVouchers(q: ListInput) {
    const where = and(
      q.q ? or(ilike(vouchers.code, `%${q.q}%`), ilike(vouchers.name, `%${q.q}%`)) : undefined,
      q.status ? eq(vouchers.active, q.status === "ACTIVE") : undefined,
    );
    const [items, total] = await Promise.all([
      db
        .select()
        .from(vouchers)
        .where(where)
        .orderBy(desc(vouchers.createdAt), desc(vouchers.id))
        .limit(q.limit)
        .offset(offset(q)),
      db.select({ n: count() }).from(vouchers).where(where),
    ]);
    return pageResult(q, items, total[0]!.n);
  }
  async function saveVoucher(input: z.infer<typeof voucherInput>, id?: string) {
    return db.transaction(async (tx) => {
      if (id) {
        const [old] = await tx
          .select()
          .from(vouchers)
          .where(eq(vouchers.id, BigInt(id)))
          .for("update")
          .limit(1);
        if (!old) throw missing();
        if (old.usedCount > input.usageLimit)
          throw new AppError(
            409,
            "VOUCHER_LIMIT_USED",
            "Giới hạn không được thấp hơn số lượt đã dùng.",
          );
        if (
          old.usedCount > 0 &&
          (old.code !== input.code || old.type !== input.type || old.value !== BigInt(input.value))
        )
          throw new AppError(
            409,
            "VOUCHER_ALREADY_USED",
            "Mã đã được sử dụng. Hãy tạo mã mới nếu muốn thay đổi loại/mức giảm.",
          );
      }
      const value = {
        ...input,
        value: BigInt(input.value),
        minSubtotal: BigInt(input.minSubtotal),
        maxDiscount: input.maxDiscount ? BigInt(input.maxDiscount) : null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        updatedAt: new Date(),
      };
      const [row] = id
        ? await tx
            .update(vouchers)
            .set(value)
            .where(eq(vouchers.id, BigInt(id)))
            .returning()
        : await tx.insert(vouchers).values(value).returning();
      return jsonValue(row);
    });
  }
  async function bulk(input: z.infer<typeof bulkInput>, actorId: number) {
    const hash = createHash("sha256")
      .update(JSON.stringify({ ...input, ids: [...input.ids].sort() }))
      .digest("hex");
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`bulk:${actorId}:${input.key}`},0))`,
      );
      const [old] = await tx
        .select()
        .from(adminOperations)
        .where(and(eq(adminOperations.actorId, actorId), eq(adminOperations.key, input.key)))
        .limit(1);
      if (old) {
        if (old.hash !== hash)
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Khóa thao tác đã được dùng cho dữ liệu khác.",
          );
        return old.result;
      }
      const rows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, input.ids.map(BigInt)))
        .orderBy(asc(products.id))
        .for("update");
      if (rows.length !== input.ids.length) throw missing();
      if (
        input.categoryId &&
        !(
          await tx
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.id, input.categoryId))
        ).length
      )
        throw new AppError(400, "INVALID_CATEGORY", "Danh mục không tồn tại.");
      if (
        input.brandId &&
        !(
          await tx
            .select({ id: brands.id })
            .from(brands)
            .where(eq(brands.id, BigInt(input.brandId)))
        ).length
      )
        throw new AppError(400, "INVALID_BRAND", "Thương hiệu không tồn tại.");
      for (const row of rows) {
        if (input.action === "STATUS" && input.status === "ACTIVE") {
          const [image] = await tx.select({id:productImages.id}).from(productImages).where(eq(productImages.productId,row.id)).limit(1);
          if (!image) throw new AppError(409,"PRODUCT_IMAGE_REQUIRED",`Sản phẩm ${row.name} cần có ảnh trước khi bật bán.`);
        }
        if (input.action === "PRICE") {
          if (input.includeVariants) {
            const variants = await tx
              .select()
              .from(productVariants)
              .where(eq(productVariants.productId, row.id))
              .orderBy(asc(productVariants.id))
              .for("update");
            for (const variant of variants)
              await tx
                .update(productVariants)
                .set({
                  price: adjustedPrice(variant.price ?? row.price, input.priceMode, input.price!),
                })
                .where(eq(productVariants.id, variant.id));
          }
          await tx
            .update(products)
            .set({
              price: adjustedPrice(row.price, input.priceMode, input.price!),
              updatedAt: new Date(),
            })
            .where(eq(products.id, row.id));
        } else if (input.action === "STATUS") {
          await tx
            .update(products)
            .set({ status: input.status!, updatedAt: new Date() })
            .where(eq(products.id, row.id));
          await tx
            .update(productVariants)
            .set({ status: input.status! })
            .where(eq(productVariants.productId, row.id));
        } else if (input.action === "CATEGORY")
          await tx
            .update(products)
            .set({ categoryId: input.categoryId!, updatedAt: new Date() })
            .where(eq(products.id, row.id));
        else
          await tx
            .update(products)
            .set({ brandId: BigInt(input.brandId!), updatedAt: new Date() })
            .where(eq(products.id, row.id));
      }
      const result = { updated: rows.length, ids: input.ids };
      await tx.insert(adminOperations).values({ actorId, key: input.key, hash, result });
      return result;
    });
  }
  async function listStaff(q: ListInput) {
    const where = and(
      eq(users.role, "STAFF"),
      q.q ? or(ilike(users.email, `%${q.q}%`), ilike(users.fullName, `%${q.q}%`)) : undefined,
      q.status ? eq(users.status, q.status === "BLOCKED" ? "BLOCKED" : "ACTIVE") : undefined,
    );
    const [items, total] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          status: users.status,
          role: users.role,
          permissions: users.permissions,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.id))
        .limit(q.limit)
        .offset(offset(q)),
      db.select({ n: count() }).from(users).where(where),
    ]);
    return pageResult(q, items, total[0]!.n);
  }
  async function saveStaff(input: z.infer<typeof staffInput>, actorId: number, id?: string) {
    if (!id && !input.password)
      throw new AppError(400, "PASSWORD_REQUIRED", "Nhập mật khẩu cho nhân viên mới.");
    const passwordHash = input.password
      ? await argon2.hash(input.password, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        })
      : undefined;
    return db.transaction(async (tx) => {
      if (id) {
        if (Number(id) === actorId)
          throw new AppError(409, "SELF_EDIT_FORBIDDEN", "Không thể tự thay đổi quyền tại đây.");
        const [old] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, Number(id)), eq(users.role, "STAFF")))
          .for("update");
        if (!old) throw missing();
      }
      const values = {
        email: input.email,
        fullName: input.fullName,
        status: input.status,
        permissions: [...new Set(input.permissions)],
        updatedAt: new Date(),
        ...(passwordHash ? { passwordHash } : {}),
      };
      const [row] = id
        ? await tx
            .update(users)
            .set(values)
            .where(and(eq(users.id, Number(id)), eq(users.role, "STAFF")))
            .returning({ id: users.id })
        : await tx
            .insert(users)
            .values({ ...values, passwordHash: passwordHash!, role: "STAFF" })
            .returning({ id: users.id });
      if (!row) throw missing();
      if (input.status === "BLOCKED" || passwordHash)
        await tx
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(authSessions.userId, row.id), isNull(authSessions.revokedAt)));
      return { id: String(row.id) };
    });
  }
  async function listAudit(q: ListInput) {
    const where = and(
      q.q
        ? or(ilike(auditLogs.actorEmail, `%${q.q}%`), ilike(auditLogs.resource, `%${q.q}%`))
        : undefined,
      q.type ? eq(auditLogs.action, q.type) : undefined,
      q.status === "SUCCESS"
        ? sql`${auditLogs.statusCode} between 200 and 399`
        : q.status === "FAILED"
          ? sql`${auditLogs.statusCode} >= 400`
          : undefined,
    );
    const [items, total] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.id))
        .limit(q.limit)
        .offset(offset(q)),
      db.select({ n: count() }).from(auditLogs).where(where),
    ]);
    return pageResult(q, items, total[0]!.n);
  }
  async function listEmails(q: ListInput) {
    const statuses = ["PENDING", "PROCESSING", "SENT", "FAILED"] as const;
    if (q.status && !statuses.includes(q.status as (typeof statuses)[number]))
      throw new AppError(400, "INVALID_STATUS", "Trạng thái email không hợp lệ.");
    const where = and(
      q.q
        ? or(
            ilike(orderEmailOutbox.recipientEmail, `%${q.q}%`),
            ilike(orderEmailOutbox.orderId, `%${q.q}%`),
            sql`${orderEmailOutbox.payload}->>'orderNumber' ilike ${`%${q.q}%`}`,
          )
        : undefined,
      q.status ? eq(orderEmailOutbox.status, q.status as (typeof statuses)[number]) : undefined,
    );
    const [items, total] = await Promise.all([
      db
        .select({
          id: orderEmailOutbox.id,
          orderId: orderEmailOutbox.orderId,
          orderNumber: sql<string>`${orderEmailOutbox.payload}->>'orderNumber'`,
          eventType: orderEmailOutbox.eventType,
          recipientEmail: orderEmailOutbox.recipientEmail,
          status: orderEmailOutbox.status,
          attempts: orderEmailOutbox.attempts,
          lastError: orderEmailOutbox.lastError,
          sentAt: orderEmailOutbox.sentAt,
          createdAt: orderEmailOutbox.createdAt,
          retryOfId: orderEmailOutbox.retryOfId,
        })
        .from(orderEmailOutbox)
        .where(where)
        .orderBy(desc(orderEmailOutbox.id))
        .limit(q.limit)
        .offset(offset(q)),
      db.select({ n: count() }).from(orderEmailOutbox).where(where),
    ]);
    return pageResult(q, items, total[0]!.n);
  }
  async function retryEmail(id: string) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(orderEmailOutbox)
        .where(eq(orderEmailOutbox.id, BigInt(id)))
        .for("update")
        .limit(1);
      if (!row) throw missing();
      if (!["SENT", "FAILED"].includes(row.status))
        throw new AppError(409, "EMAIL_ALREADY_QUEUED", "Email đang chờ hoặc đang gửi.");
      const [recent] = await tx
        .select({ id: orderEmailOutbox.id })
        .from(orderEmailOutbox)
        .where(
          and(
            eq(orderEmailOutbox.retryOfId, row.id),
            or(
              inArray(orderEmailOutbox.status, ["PENDING", "PROCESSING"]),
              gte(orderEmailOutbox.createdAt, new Date(Date.now() - 60000)),
            ),
          ),
        )
        .limit(1);
      if (recent)
        throw new AppError(
          429,
          "EMAIL_RETRY_COOLDOWN",
          "Đã có yêu cầu gửi lại. Vui lòng chờ hoàn tất và ít nhất một phút.",
        );
      const [copy] = await tx
        .insert(orderEmailOutbox)
        .values({
          retryOfId: row.id,
          eventKey: `${row.eventKey}:retry:${randomUUID()}`.slice(0, 255),
          eventType: row.eventType,
          orderId: row.orderId,
          recipientEmail: row.recipientEmail,
          recipientName: row.recipientName,
          payload: row.payload,
        })
        .returning({ id: orderEmailOutbox.id });
      return jsonValue(copy);
    });
  }
  async function listAfterSales(q: ListInput, userId?: number) {
    const where = and(
      userId ? eq(afterSalesRequests.userId, userId) : undefined,
      q.status ? eq(afterSalesRequests.status, q.status) : undefined,
      q.type ? eq(afterSalesRequests.type, q.type as "RETURN" | "WARRANTY") : undefined,
      q.q
        ? or(
            ilike(orders.orderNumber, `%${q.q}%`),
            ilike(orderItems.productName, `%${q.q}%`),
            ilike(orders.customerEmail, `%${q.q}%`),
          )
        : undefined,
    );
    const [items, total] = await Promise.all([
      db
        .select({
          request: afterSalesRequests,
          orderNumber: orders.orderNumber,
          customer: orders.shippingFullName,
          email: orders.customerEmail,
          productName: orderItems.productName,
          sku: orderItems.sku,
          image: orderItems.imageUrl,
          unitPrice: orderItems.unitPrice,
        })
        .from(afterSalesRequests)
        .innerJoin(orders, eq(afterSalesRequests.orderId, orders.id))
        .innerJoin(orderItems, eq(afterSalesRequests.itemId, orderItems.id))
        .where(where)
        .orderBy(desc(afterSalesRequests.id))
        .limit(q.limit)
        .offset(offset(q)),
      db
        .select({ n: count() })
        .from(afterSalesRequests)
        .innerJoin(orders, eq(afterSalesRequests.orderId, orders.id))
        .innerJoin(orderItems, eq(afterSalesRequests.itemId, orderItems.id))
        .where(where),
    ]);
    return pageResult(
      q,
      items.map(({ request, ...details }) => ({ ...request, ...details })),
      total[0]!.n,
    );
  }
  async function createAfterSales(input: z.infer<typeof afterSalesInput>, userId?: number) {
    return db.transaction(async (tx) => {
      const [item] = await tx
        .select({ item: orderItems, order: orders })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orderItems.id, BigInt(input.itemId)),
            eq(orders.id, BigInt(input.orderId)),
            userId ? eq(orders.userId, BigInt(userId)) : undefined,
          ),
        )
        .for("update");
      if (!item) throw missing();
      if (item.order.status !== "DELIVERED")
        throw new AppError(409, "ORDER_NOT_DELIVERED", "Chỉ tiếp nhận yêu cầu cho đơn đã giao.");
      const used = await tx
        .select({ quantity: sql<number>`coalesce(sum(${afterSalesRequests.quantity}),0)` })
        .from(afterSalesRequests)
        .where(
          and(
            eq(afterSalesRequests.itemId, item.item.id),
            eq(afterSalesRequests.type, input.type),
            sql`${afterSalesRequests.status} <> 'REJECTED'`,
            input.type === "WARRANTY" ? sql`${afterSalesRequests.status} <> 'RESOLVED'` : undefined,
          ),
        );
      if (Number(used[0]?.quantity || 0) + input.quantity > item.item.quantity)
        throw new AppError(
          409,
          "RETURN_QUANTITY_EXCEEDED",
          "Số lượng yêu cầu vượt số lượng còn có thể tiếp nhận.",
        );
      const [row] = await tx
        .insert(afterSalesRequests)
        .values({
          ...input,
          itemId: item.item.id,
          orderId: item.order.id,
          userId: Number(item.order.userId),
        })
        .returning();
      return jsonValue(row);
    });
  }
  async function updateAfterSales(id: string, input: z.infer<typeof afterSalesUpdate>) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(afterSalesRequests)
        .where(eq(afterSalesRequests.id, BigInt(id)))
        .for("update")
        .limit(1);
      if (!row) throw missing();
      const next: Record<string, string[]> = {
        REQUESTED: ["APPROVED", "REJECTED"],
        APPROVED: ["RECEIVED", "REJECTED"],
        RECEIVED: ["RESOLVED"],
        RESOLVED: [],
        REJECTED: [],
      };
      if (!next[row.status]?.includes(input.status))
        throw new AppError(409, "INVALID_TRANSITION", "Không thể chuyển sang trạng thái này.");
      const [item] = await tx
        .select({ item: orderItems, order: orders })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orderItems.id, row.itemId))
        .for("update");
      if (!item) throw missing();
      const refund = BigInt(input.refundAmount);
      if (refund > 0n && (input.status !== "RESOLVED" || input.resolution !== "REFUND"))
        throw new AppError(
          400,
          "INVALID_REFUND",
          "Chỉ ghi nhận hoàn tiền khi kết thúc bằng phương án hoàn tiền.",
        );
      const paidItem =
        item.order.subtotal > 0n
          ? (item.item.lineTotal * (item.order.subtotal - item.order.discountAmount)) /
            item.order.subtotal
          : 0n;
      const [prior] = await tx
        .select({ n: sql<string>`coalesce(sum(${afterSalesRequests.refundAmount}),0)::text` })
        .from(afterSalesRequests)
        .where(
          and(eq(afterSalesRequests.itemId, row.itemId), eq(afterSalesRequests.status, "RESOLVED")),
        );
      const requestCap = (paidItem * BigInt(row.quantity)) / BigInt(item.item.quantity);
      if (refund > requestCap || refund + BigInt(prior?.n || "0") > paidItem)
        throw new AppError(
          400,
          "REFUND_EXCEEDS_PAID",
          "Tiền hoàn vượt giá trị thực đã thanh toán cho sản phẩm.",
        );
      let restockedAt = row.restockedAt;
      if (input.restock) {
        if (row.type !== "RETURN" || input.status !== "RESOLVED")
          throw new AppError(
            400,
            "INVALID_RESTOCK",
            "Chỉ nhập lại kho khi hoàn tất nhận hàng đổi trả.",
          );
        if (!restockedAt) {
          await createInventoryService(db).increaseStock(item.item.variantId, row.quantity, {
            transaction: tx,
            idempotencyKey: `after-sales:${row.id}:restock`,
            reference: { type: "after-sales", id: row.id.toString() },
          });
          restockedAt = new Date();
        }
      }
      const [updated] = await tx
        .update(afterSalesRequests)
        .set({
          status: input.status,
          adminNote: input.adminNote,
          resolution: input.status === "RESOLVED" ? input.resolution : null,
          refundAmount: refund,
          restockedAt,
          resolvedAt: input.status === "RESOLVED" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(afterSalesRequests.id, row.id))
        .returning();
      return jsonValue(updated);
    });
  }
  return {
    listBanners,
    publicBanners,
    saveBannerPlacements,
    getBannerPlacements,
    getBanner,
    saveBanner,
    deleteBanner,
    listVouchers,
    saveVoucher,
    bulk,
    listStaff,
    saveStaff,
    listAudit,
    listEmails,
    retryEmail,
    listAfterSales,
    createAfterSales,
    updateAfterSales,
  };
}
