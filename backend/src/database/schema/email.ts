import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const orderEmailEventType = pgEnum("order_email_event_type", [
  "ORDER_PLACED",
  "ORDER_CONFIRMED",
  "ORDER_PROCESSING",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
]);

export const orderEmailOutboxStatus = pgEnum("order_email_outbox_status", [
  "PENDING",
  "PROCESSING",
  "SENT",
  "FAILED",
]);

export const orderEmailOutbox = pgTable(
  "order_email_outbox",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    retryOfId: bigint("retry_of_id", { mode: "bigint" }),
    eventKey: varchar("event_key", { length: 255 }).notNull().unique(),
    eventType: orderEmailEventType("event_type").notNull(),
    orderId: text("order_id").notNull(),
    recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
    recipientName: varchar("recipient_name", { length: 200 }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: orderEmailOutboxStatus("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    enqueuedAt: timestamp("enqueued_at", { withTimezone: true }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_email_outbox_pending_idx").on(table.status, table.enqueuedAt, table.createdAt),
    index("order_email_outbox_order_idx").on(table.orderId, table.createdAt),
    check("order_email_outbox_attempts_nonnegative_check", sql`${table.attempts} >= 0`),
  ],
);
