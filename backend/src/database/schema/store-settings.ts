import { bigint, boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const storeSettings = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: varchar("store_name", { length: 120 }).notNull().default("Technest"),
  supportEmail: varchar("support_email", { length: 320 }).notNull().default("support@technest.local"),
  supportPhone: varchar("support_phone", { length: 30 }).notNull().default(""),
  standardShippingFee: bigint("standard_shipping_fee", { mode: "bigint" }).notNull().default(30000n),
  freeShippingThreshold: bigint("free_shipping_threshold", { mode: "bigint" }).notNull().default(1000000n),
  codEnabled: boolean("cod_enabled").notNull().default(true),
  updatedBy: bigint("updated_by", { mode: "bigint" }).references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
