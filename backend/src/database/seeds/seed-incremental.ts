import { createHash } from "node:crypto";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { loadEnv } from "../../config/env.js";
import { createDatabase } from "../../config/database.js";
import { createInventoryService } from "../../modules/inventory/inventory.service.js";
import {
  afterSalesRequests,
  banners,
  categories,
  inventories,
  orderInventoryReservations,
  orderItems,
  orders,
  orderStatusHistory,
  productImages,
  products,
  productVariants,
  userAddresses,
  users,
  voucherRedemptions,
  vouchers,
} from "../schema/index.js";

const env = loadEnv();
const databaseUrl = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "development" || databaseUrl.pathname !== "/technest_dev") {
  throw new Error("Incremental demo seed only runs on NODE_ENV=development database technest_dev");
}

const batchArg = process.argv.find((argument) => argument.startsWith("--batch="))?.slice(8);
const batchId = (batchArg || process.env.SEED_BATCH_ID || "dev26a").toUpperCase();
const bannersOnly = process.argv.includes("--banners-only");
const addTenPerPlacement = process.argv.includes("--add-ten-per-placement");
if (!/^[A-Z0-9]{2,10}$/.test(batchId))
  throw new Error("Batch ID must contain 2–10 letters or digits");

const { db, pool } = createDatabase(env.DATABASE_URL, {
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 32000,
});
const seededAt = new Date();
const day = 86400000;
const slugToPosition = ["HOME_HERO", "HOME_PROMO", "HOME_BOTTOM"] as const;
const campaignTitles = [
  "Không gian làm việc gọn gàng hơn",
  "Nâng cấp góc chơi game",
  "Thiết bị mới cho bàn làm việc",
  "Lựa chọn cho trải nghiệm giải trí",
  "Hoàn thiện bộ setup cá nhân",
  "Thiết bị được yêu thích tại Technest",
  "Tối ưu góc làm việc mỗi ngày",
  "Khám phá thiết bị công nghệ chính hãng",
];
const allBannerPlacements = [
  ["HOME_HERO", "Hero Slider chính"],
  ["HOME_HERO_RIGHT_TOP", "Hero bên phải · Trên"],
  ["HOME_HERO_RIGHT_BOTTOM", "Hero bên phải · Dưới"],
  ["HOME_PROMO", "Ưu đãi giữa trang"],
  ["HOME_BOTTOM", "Banner cuối trang"],
  ["HOME_SETUP_STUDIO", "Setup Studio"],
] as const;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function seedBanners() {
  const catalog = await db
    .select({
      productId: products.id,
      name: products.name,
      categorySlug: categories.slug,
      imageUrl: productImages.url,
    })
    .from(products)
    .innerJoin(productImages, eq(productImages.productId, products.id))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.status, "ACTIVE"), eq(productImages.sortOrder, 0)))
    .orderBy(asc(products.id))
    .limit(5000);
  if (catalog.length < 10)
    throw new Error(
      "At least 10 active products with primary images are required for banner fixtures",
    );

  const currentTitles = new Set(
    (await db.select({ title: banners.title }).from(banners)).map((row) => row.title),
  );
  let added = 0;
  for (let offset = 0; offset < 100; offset += 50) {
    const batch = catalog
      .slice(offset, offset + 50)
      .map((product, index) => {
        const number = offset + index;
        const title = `${campaignTitles[number % campaignTitles.length]} · ${product.name}`.slice(
          0,
          160,
        );
        const activeWindow = number < 12;
        const upcoming = number >= 12 && number < 18;
        const expired = number >= 18 && number < 24;
        const startsAt = upcoming
          ? new Date(seededAt.getTime() + 7 * day)
          : expired
            ? new Date(seededAt.getTime() - 60 * day)
            : new Date(seededAt.getTime() - day);
        const endsAt = upcoming
          ? new Date(seededAt.getTime() + 14 * day)
          : expired
            ? new Date(seededAt.getTime() - 30 * day)
            : new Date(seededAt.getTime() + 30 * day);
        return {
          title,
          subtitle: `Khám phá ${product.name} và các sản phẩm cùng danh mục tại Technest.`,
          imageUrl: product.imageUrl,
          link: `/products?category=${encodeURIComponent(product.categorySlug)}`,
          buttonText: "Khám phá ngay",
          position: slugToPosition[number % slugToPosition.length],
          sortOrder: number,
          active: activeWindow || upcoming || expired,
          startsAt,
          endsAt,
          createdAt: new Date(seededAt.getTime() - (100 - number) * day),
          updatedAt: seededAt,
        };
      })
      .filter((banner) => !currentTitles.has(banner.title));
    if (batch.length) {
      await db.insert(banners).values(batch);
      for (const row of batch) currentTitles.add(row.title);
      added += batch.length;
    }
    console.info(
      `[incremental-seed:${batchId}] banners ${Math.min(offset + 50, 100)}/100; added=${added}`,
    );
  }
  const placementRows = await db
    .select({ position: banners.position, count: sql<number>`count(*)::int` })
    .from(banners)
    .groupBy(banners.position);
  const counts = new Map(placementRows.map((row) => [row.position, row.count]));
  const allTitles = new Set(
    (await db.select({ title: banners.title }).from(banners)).map((row) => row.title),
  );
  let placementAdded = 0;
  for (const [positionIndex, [position, displayName]] of allBannerPlacements.entries()) {
    const existingCount = counts.get(position) || 0;
    const missing = Math.max(0, 10 - existingCount);
    if (!missing) continue;
    const start = (positionIndex * 10) % catalog.length;
    const candidates = [...catalog.slice(start), ...catalog.slice(0, start)];
    const values = [];
    for (const product of candidates) {
      if (values.length >= missing) break;
      const title = `${displayName} · ${product.name} · ${product.productId}`.slice(0, 160);
      if (allTitles.has(title)) continue;
      allTitles.add(title);
      values.push({
        title,
        subtitle: `Khám phá ${product.name} và các thiết bị phù hợp tại Technest.`,
        imageUrl: product.imageUrl,
        link: `/products?category=${encodeURIComponent(product.categorySlug)}`,
        buttonText: "Khám phá ngay",
        position,
        sortOrder: existingCount + values.length,
        // Keep a compact storefront selection while making ten editorial choices available per slot.
        active: values.length < 3,
        startsAt: new Date(seededAt.getTime() - day),
        endsAt: new Date(seededAt.getTime() + 90 * day),
        createdAt: new Date(seededAt.getTime() - (values.length + 1) * day),
        updatedAt: seededAt,
      });
    }
    if (values.length !== missing)
      throw new Error(`Only ${values.length}/${missing} distinct banners available for ${position}`);
    if (values.length) {
      await db.insert(banners).values(values);
      placementAdded += values.length;
      console.info(`[incremental-seed:${batchId}] ${position}: ${existingCount + values.length}/10`);
    }
  }
  const finalCounts = await db
    .select({ position: banners.position, count: sql<number>`count(*)::int` })
    .from(banners)
    .groupBy(banners.position);
  const finalCountByPosition = new Map(finalCounts.map((row) => [row.position, row.count]));
  for (const [position] of allBannerPlacements) {
    if ((finalCountByPosition.get(position) || 0) < 10)
      throw new Error(`Banner placement ${position} has fewer than 10 records after seeding`);
  }
  if (addTenPerPlacement) {
    const existing = new Set((await db.select({ title: banners.title }).from(banners)).map((row) => row.title));
    const categoryFor = (position: string) => {
      if (position === "HOME_HERO_RIGHT_TOP") return "keyboards";
      if (position === "HOME_HERO_RIGHT_BOTTOM") return "audio";
      if (position === "HOME_SETUP_STUDIO") return "accessories";
      return null;
    };
    let batchAdded = 0;
    for (const [position, displayName] of allBannerPlacements) {
      const category = categoryFor(position);
      const candidates = category ? catalog.filter((product) => product.categorySlug === category) : catalog;
      if (candidates.length < 10) throw new Error(`Not enough matching product images for ${position}`);
      const rows = candidates.slice(0, 10).map((product, index) => ({
        title: `${displayName} · Gợi ý ${batchId}-${String(index + 1).padStart(2, "0")}`.slice(0, 160),
        subtitle: `Khám phá ${product.name} tại Technest.`,
        imageUrl: product.imageUrl,
        link: `/products?category=${encodeURIComponent(product.categorySlug)}`,
        buttonText: "Khám phá ngay",
        position,
        sortOrder: 1000 + index,
        active: false,
        startsAt: seededAt,
        endsAt: new Date(seededAt.getTime() + 90 * day),
        createdAt: seededAt,
        updatedAt: seededAt,
      })).filter((row) => !existing.has(row.title));
      if (rows.length) {
        await db.insert(banners).values(rows);
        rows.forEach((row) => existing.add(row.title));
        batchAdded += rows.length;
      }
      console.info(`[incremental-seed:${batchId}] ${position}: added ${rows.length}/10 curated options (inactive)`);
    }
    added += batchAdded;
  }
  return added + placementAdded;
}

async function seedVouchers() {
  const customers = await db
    .select()
    .from(users)
    .where(eq(users.role, "CUSTOMER"))
    .orderBy(asc(users.id))
    .limit(10);
  const variants = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      sku: productVariants.sku,
      variantName: productVariants.name,
      productName: products.name,
      price: sql<string>`coalesce(${productVariants.price}, ${products.price})`,
      imageUrl: productImages.url,
      available: sql<number>`${inventories.onHand} - ${inventories.reserved}`,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(inventories, eq(inventories.variantId, productVariants.id))
    .leftJoin(
      productImages,
      and(eq(productImages.productId, products.id), eq(productImages.sortOrder, 0)),
    )
    .where(
      and(
        eq(products.status, "ACTIVE"),
        eq(productVariants.status, "ACTIVE"),
        gt(sql`${productVariants.price}::numeric`, 300000),
        gt(sql`${inventories.onHand} - ${inventories.reserved}`, 1),
      ),
    )
    .orderBy(asc(productVariants.id))
    .limit(10);
  if (customers.length < 5 || variants.length < 5)
    throw new Error(
      "Need five active development customers and five stocked active SKUs for exhausted-voucher fixtures",
    );

  const current = seededAt;
  const values = Array.from({ length: 100 }, (_, index) => {
    const code = `TN-${batchId}-${String(index + 1).padStart(3, "0")}`;
    const type = index % 2 === 0 ? ("PERCENT" as const) : ("FIXED" as const);
    const percentage = [5, 10, 15, 20][Math.floor(index / 2) % 4]!;
    const fixed = [30000, 50000, 80000, 100000][Math.floor(index / 2) % 4]!;
    const exhausted = index >= 70 && index < 75;
    const upcoming = index >= 25 && index < 40;
    const expired = index >= 40 && index < 55;
    const disabled = index >= 55 && index < 70;
    const startsAt = upcoming
      ? new Date(current.getTime() + 7 * day)
      : expired
        ? new Date(current.getTime() - 60 * day)
        : new Date(current.getTime() - day);
    const endsAt = upcoming
      ? new Date(current.getTime() + 14 * day)
      : expired
        ? new Date(current.getTime() - 30 * day)
        : new Date(current.getTime() + 30 * day);
    return {
      code,
      name:
        type === "PERCENT"
          ? `Ưu đãi ${percentage}% cho đơn hàng`
          : `Ưu đãi ${fixed.toLocaleString("vi-VN")} đồng cho đơn hàng`,
      type,
      value: BigInt(type === "PERCENT" ? percentage : fixed),
      minSubtotal: 300000n,
      maxDiscount: type === "PERCENT" ? 150000n : null,
      usageLimit: exhausted ? 1 : 100,
      perUserLimit: 1,
      usedCount: exhausted ? 1 : 0,
      startsAt,
      endsAt,
      active: !disabled,
      createdAt: new Date(current.getTime() - (100 - index) * day),
      updatedAt: current,
    };
  });

  await db.transaction(async (tx) => {
    await tx.insert(vouchers).values(values).onConflictDoNothing({ target: vouchers.code });
    const savedVouchers = await tx
      .select()
      .from(vouchers)
      .where(sql`${vouchers.code} LIKE ${`TN-${batchId}-%`}`)
      .orderBy(asc(vouchers.code));
    if (savedVouchers.length !== 100)
      throw new Error(`Expected 100 vouchers for batch ${batchId}, found ${savedVouchers.length}`);

    const inventory = createInventoryService(db);
    let ordersAdded = 0;
    for (let fixture = 0; fixture < 5; fixture += 1) {
      const voucher = savedVouchers[70 + fixture]!;
      const customer = customers[fixture]!;
      const variant = variants[fixture]!;
      const orderNumber = `TN-${batchId}-CP${fixture + 1}`;
      const [existing] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber))
        .limit(1);
      if (existing) continue;

      const orderIdempotencyKey = `seed-${batchId}-coupon-${fixture + 1}`;
      const unitPrice = BigInt(variant.price);
      const discount =
        voucher.type === "PERCENT"
          ? (unitPrice * voucher.value) / 100n > (voucher.maxDiscount ?? unitPrice)
            ? (voucher.maxDiscount ?? unitPrice)
            : (unitPrice * voucher.value) / 100n
          : voucher.value > unitPrice
            ? unitPrice
            : voucher.value;
      const shippingFee = unitPrice >= 1000000n ? 0n : 30000n;
      const createdAt = new Date(current.getTime() - (fixture + 1) * day);
      const address = await tx
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.userId, customer.id))
        .limit(1);
      const fullName = customer.fullName || "Khách hàng Technest";
      const phone = customer.phone || "0900000000";
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: BigInt(customer.id),
          idempotencyKey: orderIdempotencyKey,
          requestHash: hash(
            JSON.stringify({
              batchId,
              fixture,
              variantId: variant.variantId.toString(),
              voucher: voucher.code,
            }),
          ),
          status: "PENDING",
          paymentMethod: "COD",
          paymentStatus: "UNPAID",
          subtotal: unitPrice,
          shippingFee,
          discountAmount: discount,
          totalAmount: unitPrice + shippingFee - discount,
          shippingFullName: fullName,
          shippingPhone: phone,
          customerEmail: customer.email,
          shippingAddress: address[0]?.addressLine || "Địa chỉ giao hàng mẫu, 12 Nguyễn Trãi",
          shippingCity: address[0]?.city || "Thành phố Hồ Chí Minh",
          shippingDistrict: address[0]?.district || "Quận 1",
          shippingWard: address[0]?.ward || "Phường Bến Thành",
          customerNote: "Đơn phát sinh từ dữ liệu development để kiểm tra giới hạn mã giảm giá.",
          voucherCode: voucher.code,
          createdAt,
          updatedAt: createdAt,
        })
        .returning();
      if (!order) throw new Error(`Unable to create voucher sample order ${orderNumber}`);

      const reserved = await inventory.reserveStock(
        variant.variantId,
        1,
        { type: "order", id: order.id.toString() },
        {
          transaction: tx,
          idempotencyKey: `seed:${batchId}:order:${orderNumber}:reserve:${variant.variantId}`,
          ttlMs: 24 * 60 * 60 * 1000,
        },
      );
      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: variant.productId,
        variantId: variant.variantId,
        productName: variant.productName,
        variantName: variant.variantName,
        sku: variant.sku,
        imageUrl: variant.imageUrl,
        quantity: 1,
        unitPrice,
        lineTotal: unitPrice,
        createdAt,
      });
      await tx
        .insert(orderInventoryReservations)
        .values({ orderId: order.id, reservationId: BigInt(reserved.reservation.id) });
      await tx
        .insert(orderStatusHistory)
        .values({
          orderId: order.id,
          fromStatus: null,
          toStatus: "PENDING",
          changedBy: BigInt(customer.id),
          note: "Đơn development để kiểm tra mã giảm giá đã hết lượt.",
          createdAt,
        });
      await tx
        .insert(voucherRedemptions)
        .values({
          voucherId: voucher.id,
          userId: customer.id,
          orderId: order.id,
          discount,
          createdAt,
        });
      ordersAdded += 1;
    }
    console.info(
      `[incremental-seed:${batchId}] vouchers 100/100; exhausted-code orders added=${ordersAdded}`,
    );
  });
}

const supportReasons = [
  "Thiết bị thỉnh thoảng mất kết nối sau khi sử dụng liên tục.",
  "Sản phẩm phát ra tiếng lạ khi hoạt động trong thời gian dài.",
  "Một phím phản hồi không ổn định trong quá trình sử dụng.",
  "Cổng kết nối bị lỏng dù sản phẩm được dùng đúng hướng dẫn.",
  "Màn hình xuất hiện điểm sáng sau vài tuần sử dụng.",
  "Đệm tai bị bong tại đường may trong thời gian bảo hành.",
  "Nút cuộn hoạt động không đều khi thao tác.",
  "Phụ kiện đi kèm không hoạt động ổn định.",
];

async function seedAfterSales() {
  const candidates = await db
    .select({
      orderId: orders.id,
      itemId: orderItems.id,
      userId: orders.userId,
      quantity: orderItems.quantity,
      orderDate: orders.createdAt,
      productName: orderItems.productName,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(sql`${orders.status} IN ('SHIPPED', 'DELIVERED')`)
    .orderBy(asc(orders.id), asc(orderItems.id))
    .limit(1000);
  if (candidates.length < 100)
    throw new Error(
      "At least 100 shipped/delivered order items are required for after-sales fixtures",
    );

  const offset = Number.parseInt(hash(batchId).slice(0, 8), 16) % candidates.length;
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  const rows = rotated.slice(0, 100).map((candidate, index) => {
    const status = ["REQUESTED", "APPROVED", "RECEIVED", "RESOLVED", "REJECTED"][index % 5]!;
    const resolution = status === "RESOLVED" ? "REPAIRED" : null;
    const ageDays = 2 + ((index * 7) % 55);
    const createdAt = new Date(seededAt.getTime() - ageDays * day);
    return {
      candidate,
      values: {
        orderId: candidate.orderId,
        itemId: candidate.itemId,
        userId: Number(candidate.userId),
        type: index % 3 === 0 ? ("WARRANTY" as const) : ("RETURN" as const),
        quantity: 1,
        reason: supportReasons[index % supportReasons.length]!,
        status,
        adminNote:
          status === "REQUESTED"
            ? ""
            : status === "REJECTED"
              ? "Yêu cầu đã được kiểm tra theo chính sách hậu mãi."
              : "Đã tiếp nhận và đang xử lý theo quy trình hậu mãi.",
        resolution,
        refundAmount: 0n,
        restockedAt: null,
        resolvedAt:
          status === "RESOLVED" || status === "REJECTED"
            ? new Date(createdAt.getTime() + day)
            : null,
        createdAt,
        updatedAt: status === "REQUESTED" ? createdAt : new Date(createdAt.getTime() + day),
      },
    };
  });

  let added = 0;
  for (let start = 0; start < rows.length; start += 50) {
    const batch = rows.slice(start, start + 50);
    await db.transaction(async (tx) => {
      for (const row of batch) {
        const [existing] = await tx
          .select({ id: afterSalesRequests.id })
          .from(afterSalesRequests)
          .where(
            and(
              eq(afterSalesRequests.orderId, row.candidate.orderId),
              eq(afterSalesRequests.itemId, row.candidate.itemId),
            ),
          )
          .limit(1);
        if (existing) continue;
        await tx.insert(afterSalesRequests).values(row.values);
        added += 1;
      }
    });
    console.info(
      `[incremental-seed:${batchId}] after-sales ${Math.min(start + 50, 100)}/100; added=${added}`,
    );
  }
  return added;
}

try {
  console.info(
    `[incremental-seed:${batchId}] database=${databaseUrl.pathname.slice(1)}; starting without deleting or updating existing rows`,
  );
  const bannersAdded = await seedBanners();
  let vouchersRequested = 0;
  let afterSalesAdded = 0;
  if (!bannersOnly) {
    await seedVouchers();
    vouchersRequested = 100;
    afterSalesAdded = await seedAfterSales();
  }
  console.info(
    JSON.stringify({
      batchId,
      bannersAdded,
      vouchersRequested,
      afterSalesAdded,
      completedAt: new Date().toISOString(),
    }),
  );
} catch (error) {
  console.error(
    `[incremental-seed:${batchId}] stopped; safe to resume with same batch ID: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
