import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { productVariants, products } from "./catalog.js";
import { inventoryReservations } from "./inventory.js";

export const orderPaymentStatus = pgEnum("order_payment_status", ["UNPAID", "PAID"]);

export const orderStatus = pgEnum("order_status", [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export const orders = pgTable(
  "orders",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
    userId: bigint("user_id", { mode: "bigint" }).notNull().references(() => users.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    status: orderStatus("status").notNull().default("PENDING"),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull().default("COD"),
    paymentStatus: orderPaymentStatus("payment_status").notNull().default("UNPAID"),
    subtotal: bigint("subtotal", { mode: "bigint" }).notNull(),
    shippingFee: bigint("shipping_fee", { mode: "bigint" }).notNull(),
    discountAmount: bigint("discount_amount", { mode: "bigint" }).notNull().default(sql`0`),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull(),
    shippingFullName: varchar("shipping_full_name", { length: 200 }).notNull(),
    shippingPhone: varchar("shipping_phone", { length: 30 }).notNull(),
    customerEmail: varchar("customer_email", { length: 320 }).notNull(),
    shippingAddress: text("shipping_address").notNull(),
    shippingCity: varchar("shipping_city", { length: 120 }).notNull(),
    shippingDistrict: varchar("shipping_district", { length: 120 }),
    shippingWard: varchar("shipping_ward", { length: 120 }),
    customerNote: text("customer_note"),
    voucherCode: varchar("voucher_code", { length: 40 }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("orders_user_created_idx").on(table.userId, table.createdAt),
    index("orders_status_created_idx").on(table.status, table.createdAt),
    unique().on(table.userId, table.idempotencyKey),
    index("orders_order_number_idx").on(table.orderNumber),
    check("orders_payment_method_check", sql`${table.paymentMethod} = 'COD'`),
    check("orders_subtotal_check", sql`${table.subtotal} >= 0`),
    check("orders_shipping_fee_check", sql`${table.shippingFee} >= 0`),
    check("orders_discount_amount_check", sql`${table.discountAmount} >= 0`),
    check("orders_total_amount_check", sql`${table.totalAmount} >= 0`),
  ],
);
export const orderItems = pgTable(
  "order_items",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    orderId: bigint("order_id", { mode: "bigint" }).notNull().references(() => orders.id, { onDelete: "restrict" }),
    variantId: bigint("variant_id", { mode: "bigint" }).notNull().references(() => productVariants.id, { onDelete: "restrict" }),
    productId: bigint("product_id", { mode: "bigint" }).notNull().references(() => products.id, { onDelete: "restrict" }),
    productName: varchar("product_name", { length: 220 }).notNull(),
    variantName: varchar("variant_name", { length: 180 }),
    sku: varchar("sku", { length: 100 }).notNull(),
    imageUrl: text("image_url"),
    quantity: integer("quantity").notNull(),
    unitPrice: bigint("unit_price", { mode: "bigint" }).notNull(),
    lineTotal: bigint("line_total", { mode: "bigint" }).notNull(),
    flashSaleCampaignId: bigint("flash_sale_campaign_id", { mode: "bigint" }),
    flashSaleItemId: bigint("flash_sale_item_id", { mode: "bigint" }),
    flashSaleOriginalPrice: bigint("flash_sale_original_price", { mode: "bigint" }),
    flashSaleDiscountAmount: bigint("flash_sale_discount_amount", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    index("order_items_variant_idx").on(table.variantId),
    check("order_items_unit_price_check", sql`${table.unitPrice} >= 0`),
    check("order_items_line_total_check", sql`${table.lineTotal} >= 0`),
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
    check("order_items_flash_sale_snapshot_check", sql`(${table.flashSaleItemId} IS NULL AND ${table.flashSaleCampaignId} IS NULL AND ${table.flashSaleOriginalPrice} IS NULL AND ${table.flashSaleDiscountAmount} IS NULL) OR (${table.flashSaleItemId} IS NOT NULL AND ${table.flashSaleCampaignId} IS NOT NULL AND ${table.flashSaleOriginalPrice} > ${table.unitPrice} AND ${table.flashSaleDiscountAmount} > 0)`),
  ],
);

export const orderInventoryReservations = pgTable(
  "order_inventory_reservations",
  {
    orderId: bigint("order_id", { mode: "bigint" }).notNull().references(() => orders.id, { onDelete: "restrict" }),
    reservationId: bigint("reservation_id", { mode: "bigint" }).notNull().unique().references(() => inventoryReservations.id, { onDelete: "restrict" }),
  },
  (table) => [unique().on(table.orderId, table.reservationId)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    orderId: bigint("order_id", { mode: "bigint" }).notNull().references(() => orders.id, { onDelete: "restrict" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    changedBy: bigint("changed_by", { mode: "bigint" }).references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("order_status_history_order_created_idx").on(table.orderId, table.createdAt)],
);
