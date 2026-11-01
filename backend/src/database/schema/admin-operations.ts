import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { orders, orderItems } from "./orders.js";

export const auditLogs = pgTable("admin_audit_logs", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  actorId: bigint("actor_id", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  actorEmail: varchar("actor_email", { length: 320 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(), resource: varchar("resource", { length: 240 }).notNull(),
  requestId: varchar("request_id", { length: 100 }), details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  statusCode: integer("status_code"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("admin_audit_created_idx").on(t.createdAt)]);

export const banners = pgTable("store_banners", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(), subtitle: text("subtitle").notNull().default(""),
  imageUrl: text("image_url").notNull(), link: varchar("link", { length: 500 }).notNull(),
  buttonText: varchar("button_text", { length: 60 }).notNull().default("Khám phá ngay"),
  position: varchar("position", { length: 40 }).default("HOME_PROMO"),
  sortOrder: integer("sort_order").notNull().default(0), active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }), endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const vouchers = pgTable("vouchers", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(), code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(), type: varchar("type", { length: 12 }).$type<"FIXED" | "PERCENT">().notNull(),
  value: bigint("value", { mode: "bigint" }).notNull(), minSubtotal: bigint("min_subtotal", { mode: "bigint" }).notNull().default(0n),
  maxDiscount: bigint("max_discount", { mode: "bigint" }), usageLimit: integer("usage_limit").notNull(),
  perUserLimit: integer("per_user_limit").notNull().default(1), usedCount: integer("used_count").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(), endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const voucherRedemptions = pgTable("voucher_redemptions", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  voucherId: bigint("voucher_id", { mode: "bigint" }).notNull().references(() => vouchers.id),
  userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id),
  orderId: bigint("order_id", { mode: "bigint" }).notNull().unique().references(() => orders.id),
  discount: bigint("discount", { mode: "bigint" }).notNull(), releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("voucher_redemptions_user_idx").on(t.voucherId, t.userId)]);

export const afterSalesRequests = pgTable("after_sales_requests", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  orderId: bigint("order_id", { mode: "bigint" }).notNull().references(() => orders.id),
  itemId: bigint("item_id", { mode: "bigint" }).notNull().references(() => orderItems.id),
  userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id),
  type: varchar("type", { length: 12 }).$type<"RETURN" | "WARRANTY">().notNull(), quantity: integer("quantity").notNull(), reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("REQUESTED"), adminNote: text("admin_note").notNull().default(""),
  resolution: varchar("resolution", { length: 20 }), refundAmount: bigint("refund_amount", { mode: "bigint" }).notNull().default(0n),
  restockedAt: timestamp("restocked_at", { withTimezone: true }), resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("after_sales_created_idx").on(t.createdAt)]);

export const catalogImports = pgTable("catalog_imports", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  actorId: bigint("actor_id", { mode: "number" }).notNull().references(() => users.id),
  filename: varchar("filename", { length: 240 }).notNull(), status: varchar("status", { length: 20 }).notNull().default("PREVIEW"),
  rows: jsonb("rows").$type<Record<string, unknown>[]>().notNull(), cursor: integer("cursor").notNull().default(0),
  total: integer("total").notNull(), leaseUntil: timestamp("lease_until", { withTimezone: true }), error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const adminOperations = pgTable("admin_operations", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  actorId: bigint("actor_id", { mode: "number" }).notNull().references(() => users.id),
  key: varchar("key", { length: 160 }).notNull(), hash: varchar("hash", { length: 64 }).notNull(),
  result: jsonb("result").$type<Record<string, unknown>>().notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique("admin_operations_actor_key_unique").on(t.actorId, t.key)]);
