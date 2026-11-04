import { bigint, check, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, index, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { products, productVariants } from "./catalog.js";
import { orders } from "./orders.js";

export const flashSaleCampaignStatus = pgEnum("flash_sale_campaign_status", ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ENDED", "CANCELLED"]);
export const flashSaleReservationStatus = pgEnum("flash_sale_reservation_status", ["RESERVED", "CONSUMED", "RELEASED", "EXPIRED"]);

export const flashSaleCampaigns = pgTable("flash_sale_campaigns", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  description: text("description").notNull().default(""),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: flashSaleCampaignStatus("status").notNull().default("DRAFT"),
  createdBy: bigint("created_by", { mode: "bigint" }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("flash_sale_campaign_dates_check", sql`${table.startsAt} < ${table.endsAt}`), index("flash_sale_campaign_status_dates_idx").on(table.status, table.startsAt, table.endsAt)]);

export const flashSaleItems = pgTable("flash_sale_items", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  campaignId: bigint("campaign_id", { mode: "bigint" }).notNull().references(() => flashSaleCampaigns.id, { onDelete: "restrict" }),
  productId: bigint("product_id", { mode: "bigint" }).notNull().references(() => products.id, { onDelete: "restrict" }),
  variantId: bigint("variant_id", { mode: "bigint" }).notNull().references(() => productVariants.id, { onDelete: "restrict" }),
  originalPriceSnapshot: bigint("original_price_snapshot", { mode: "bigint" }).notNull(),
  flashPrice: bigint("flash_price", { mode: "bigint" }).notNull(),
  quota: integer("quota").notNull(),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  soldQuantity: integer("sold_quantity").notNull().default(0),
  perCustomerLimit: integer("per_customer_limit").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("flash_sale_items_campaign_variant_idx").on(table.campaignId, table.variantId),
  index("flash_sale_items_variant_idx").on(table.variantId),
  check("flash_sale_items_price_check", sql`${table.flashPrice} > 0 AND ${table.flashPrice} < ${table.originalPriceSnapshot}`),
  check("flash_sale_items_quota_check", sql`${table.quota} >= 0 AND ${table.reservedQuantity} >= 0 AND ${table.soldQuantity} >= 0 AND ${table.reservedQuantity} + ${table.soldQuantity} <= ${table.quota}`),
  check("flash_sale_items_limit_check", sql`${table.perCustomerLimit} > 0`),
]);

export const flashSaleReservations = pgTable("flash_sale_reservations", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  flashSaleItemId: bigint("flash_sale_item_id", { mode: "bigint" }).notNull().references(() => flashSaleItems.id, { onDelete: "restrict" }),
  userId: bigint("user_id", { mode: "bigint" }).notNull().references(() => users.id, { onDelete: "restrict" }),
  orderId: bigint("order_id", { mode: "bigint" }).references(() => orders.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  status: flashSaleReservationStatus("status").notNull().default("RESERVED"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("flash_sale_reservation_user_key_idx").on(table.userId, table.idempotencyKey),
  index("flash_sale_reservation_item_user_idx").on(table.flashSaleItemId, table.userId, table.status),
  index("flash_sale_reservation_expiry_idx").on(table.status, table.expiresAt),
  check("flash_sale_reservation_quantity_check", sql`${table.quantity} > 0`),
]);
