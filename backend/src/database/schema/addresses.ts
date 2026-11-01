import { bigint, boolean, index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";

export const userAddresses = pgTable(
  "user_addresses",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    recipientName: varchar("recipient_name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    addressLine: text("address_line").notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    district: varchar("district", { length: 120 }),
    ward: varchar("ward", { length: 120 }),
    label: varchar("label", { length: 60 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_addresses_user_id_idx").on(table.userId),
    index("user_addresses_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("user_addresses_one_default_per_user_idx")
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
  ],
);
