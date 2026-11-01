import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const notificationType = pgEnum("notification_type", [
  "ORDER_STATUS_UPDATED",
  "ORDER_CANCELLED",
  "ORDER_DELIVERED",
  "PROMOTION_AVAILABLE",
  "PROMOTION_EXPIRING",
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "ACCOUNT_UPDATED",
  "ACCOUNT_LOCKED",
  "SECURITY_ALERT",
  "SYSTEM_ANNOUNCEMENT",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    recipientUserId: bigint("recipient_user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 40 }),
    entityId: varchar("entity_id", { length: 100 }),
    targetUrl: varchar("target_url", { length: 500 }),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    eventKey: varchar("event_key", { length: 200 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_recipient_created_idx").on(table.recipientUserId, table.createdAt),
    index("notifications_recipient_read_idx").on(table.recipientUserId, table.readAt),
    uniqueIndex("notifications_event_key_unique_idx").on(table.eventKey).where(sql`${table.eventKey} IS NOT NULL`),
  ],
);
