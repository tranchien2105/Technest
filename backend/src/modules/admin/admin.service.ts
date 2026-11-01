import { and, asc, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import { brands, categories, inventories, orderItems, productVariants, products, users, orders } from "../../database/schema/index.js";

type Database = NodePgDatabase<typeof schema>;

export function createAdminService(db: Database) {
  async function overview() {
    const [activeProducts, totalProducts, totalCustomers, lowStock, categoryCount, brandCount, orderMetrics] = await Promise.all([
      db.select({ value: count() }).from(products).where(eq(products.status, "ACTIVE")),
      db.select({ value: count() }).from(products),
      db.select({ value: count() }).from(users).where(and(eq(users.role, "CUSTOMER"), eq(users.status, "ACTIVE"))),
      db.select({ value: sql<number>`count(distinct ${products.id})` }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).leftJoin(inventories, eq(inventories.variantId, productVariants.id)).where(and(eq(products.status, "ACTIVE"), eq(productVariants.status, "ACTIVE"), sql`coalesce(${inventories.onHand}, 0) - coalesce(${inventories.reserved}, 0) <= 5`)),
      db.select({ value: count() }).from(categories),
      db.select({ value: count() }).from(brands),
      db.select({ total: count(), pending: sql<number>`count(*) filter (where ${orders.status} = 'PENDING')`, revenue: sql<string>`coalesce(sum(${orders.totalAmount}) filter (where ${orders.status} = 'DELIVERED' and ${orders.paymentStatus} = 'PAID'), 0)::text` }).from(orders),
    ]);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 6);
    const revenueRows = await db.select({ day: sql<string>`to_char(date_trunc('day', ${orders.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`, amount: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text`, orderCount: count() })
      .from(orders).where(and(gte(orders.createdAt, since), eq(orders.status, "DELIVERED"), eq(orders.paymentStatus, "PAID")))
      .groupBy(sql`date_trunc('day', ${orders.createdAt} at time zone 'UTC')`).orderBy(asc(sql`date_trunc('day', ${orders.createdAt} at time zone 'UTC')`));
    const recentOrders = await db.select({ id: orders.id, orderNumber: orders.orderNumber, customer: orders.shippingFullName, email: orders.customerEmail,
      status: orders.status, totalAmount: orders.totalAmount, createdAt: orders.createdAt })
      .from(orders).orderBy(desc(orders.createdAt), desc(orders.id)).limit(8);
    const topProducts = await db.select({ id: products.id, name: products.name, quantity: sql<number>`sum(${orderItems.quantity})`,
      revenue: sql<string>`sum(${orderItems.lineTotal})::text`, image: sql<string | null>`(select pi.url from product_images pi where pi.product_id = ${products.id} order by pi.sort_order limit 1)` })
      .from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).innerJoin(products, eq(orderItems.productId, products.id))
      .where(and(gte(orders.createdAt, since), sql`${orders.status} <> 'CANCELLED'`)).groupBy(products.id).orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(5);
    const revenueByDay = new Map(revenueRows.map((row) => [row.day, { amount: row.amount, orders: Number(row.orderCount) }]));
    const revenueSeries = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(since); day.setUTCDate(since.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);
      return { date: key, amount: revenueByDay.get(key)?.amount ?? "0", orders: revenueByDay.get(key)?.orders ?? 0 };
    });
    return {
      metrics: {
        revenue: orderMetrics[0]?.revenue ?? "0",
        orders: Number(orderMetrics[0]?.total ?? 0),
        pendingOrders: Number(orderMetrics[0]?.pending ?? 0),
        activeCustomers: Number(totalCustomers[0]?.value ?? 0),
        activeProducts: Number(activeProducts[0]?.value ?? 0),
        totalProducts: Number(totalProducts[0]?.value ?? 0),
        lowStockProducts: Number(lowStock[0]?.value ?? 0),
        categories: Number(categoryCount[0]?.value ?? 0),
        brands: Number(brandCount[0]?.value ?? 0),
      },
      revenueSeries,
      recentOrders: recentOrders.map((order) => ({ ...order, id: order.id.toString(), totalAmount: order.totalAmount.toString(), createdAt: order.createdAt.toISOString() })),
      topSellingProducts: topProducts.map((product) => ({ ...product, id: product.id.toString(), quantity: Number(product.quantity) })),
      unavailable: [],
      revenuePolicy: "Doanh thu COD được ghi nhận khi đơn giao thành công và đánh dấu PAID.",
    };
  }

  async function inventoryList(input: { page: number; limit: number; q?: string; lowStock?: boolean; stock?: "in" | "low" | "out"; status?: "ACTIVE" | "INACTIVE" | "ARCHIVED" }) {
    const offset = (input.page - 1) * input.limit;
    const availableStock = sql<number>`coalesce(${inventories.onHand}, 0) - coalesce(${inventories.reserved}, 0)`;
    const where = and(
      input.lowStock ? sql`${availableStock} <= 5` : undefined,
      input.stock === "out" ? sql`${availableStock} <= 0` : input.stock === "low" ? sql`${availableStock} > 0 and ${availableStock} <= 5` : input.stock === "in" ? sql`${availableStock} > 0` : undefined,
      input.status ? eq(productVariants.status, input.status) : undefined,
      input.q ? or(ilike(productVariants.sku, `%${input.q}%`), ilike(productVariants.name, `%${input.q}%`), ilike(products.name, `%${input.q}%`)) : undefined,
    );
    const [rows, totalRows] = await Promise.all([
      db.select({ variantId: productVariants.id, productId: products.id, sku: productVariants.sku, variantName: productVariants.name, productName: products.name, status: productVariants.status, onHand: sql<number>`coalesce(${inventories.onHand}, 0)`, reserved: sql<number>`coalesce(${inventories.reserved}, 0)`, updatedAt: inventories.updatedAt })
        .from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).leftJoin(inventories, eq(inventories.variantId, productVariants.id)).where(where)
        .orderBy(asc(availableStock), desc(inventories.updatedAt)).limit(input.limit).offset(offset),
      db.select({ value: count() }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).leftJoin(inventories, eq(inventories.variantId, productVariants.id)).where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);
    return { items: rows.map((row) => ({ ...row, variantId: row.variantId.toString(), productId: row.productId.toString(), available: row.onHand - row.reserved, lowStock: row.onHand - row.reserved <= 5, updatedAt: row.updatedAt?.toISOString() ?? null })), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async function customerList(input: { page: number; limit: number; q?: string; status?: "ACTIVE" | "BLOCKED" }) {
    const where = and(eq(users.role, "CUSTOMER"), input.status ? eq(users.status, input.status) : undefined,
      input.q ? or(ilike(users.email, `%${input.q}%`), ilike(users.fullName, `%${input.q}%`)) : undefined);
    const [rows, countRows] = await Promise.all([
      db.select({ id: users.id, email: users.email, fullName: users.fullName, status: users.status, createdAt: users.createdAt }).from(users).where(where).orderBy(desc(users.createdAt), desc(users.id)).limit(input.limit).offset((input.page - 1) * input.limit),
      db.select({ value: count() }).from(users).where(where),
    ]);
    const total = Number(countRows[0]?.value ?? 0);
    return { items: rows.map((row) => ({ ...row, id: String(row.id), createdAt: row.createdAt.toISOString() })), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  return { overview, inventoryList, customerList };
}

export type AdminService = ReturnType<typeof createAdminService>;
