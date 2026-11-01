import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { productVariants } from "./catalog.js";

export const inventoryMovementType = pgEnum("inventory_movement_type", [
  "INBOUND",
  "OUTBOUND",
  "ADJUSTMENT",
  "RESERVE",
  "RELEASE",
]);

export const inventoryReservationStatus = pgEnum("inventory_reservation_status", [
  "ACTIVE",
  "CONFIRMED",
  "RELEASED",
  "EXPIRED",
]);

export const inventories = pgTable(
  "inventories",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    variantId: bigint("variant_id", { mode: "bigint" })
      .notNull()
      .unique()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("inventories_on_hand_nonnegative_check", sql`${table.onHand} >= 0`),
    check("inventories_reserved_nonnegative_check", sql`${table.reserved} >= 0`),
    check("inventories_reserved_lte_on_hand_check", sql`${table.reserved} <= ${table.onHand}`),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    variantId: bigint("variant_id", { mode: "bigint" })
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    type: inventoryMovementType("type").notNull(),
    // Positive for flows; ADJUSTMENT is the signed delta from the prior on-hand amount.
    quantity: integer("quantity").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    idempotencyKey: text("idempotency_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inventory_movements_variant_created_idx").on(table.variantId, table.createdAt),
    index("inventory_movements_reference_idx").on(table.referenceType, table.referenceId),
    uniqueIndex("inventory_movements_variant_idempotency_idx")
      .on(table.variantId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    check(
      "inventory_movements_quantity_check",
      sql`(${table.type} = 'ADJUSTMENT' AND ${table.quantity} <> 0) OR (${table.type} <> 'ADJUSTMENT' AND ${table.quantity} > 0)`,
    ),
  ],
);

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    variantId: bigint("variant_id", { mode: "bigint" })
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    status: inventoryReservationStatus("status").notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: text("reference_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inventory_reservations_expiry_idx").on(table.status, table.expiresAt),
    index("inventory_reservations_variant_status_idx").on(table.variantId, table.status),
    index("inventory_reservations_reference_idx").on(table.referenceType, table.referenceId),
    check("inventory_reservations_quantity_positive_check", sql`${table.quantity} > 0`),
  ],
);
