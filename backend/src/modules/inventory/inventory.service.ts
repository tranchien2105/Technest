import { and, asc, count, desc, eq, inArray, lte, ne } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import {
  inventories,
  inventoryMovements,
  inventoryReservations,
  productVariants,
  products,
} from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type MovementType = "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "RESERVE" | "RELEASE";
type ReservationStatus = "ACTIVE" | "CONFIRMED" | "RELEASED" | "EXPIRED";

const INT_MAX = 2_147_483_647;
export const INVENTORY_RESERVATION_TTL_MS = 15 * 60 * 1000;

function parseId(value: string | bigint) {
  try {
    const id = BigInt(value);
    if (id <= 0n || id > 9_223_372_036_854_775_807n) throw new Error("out of range");
    return id;
  } catch {
    throw new AppError(400, "INVALID_ID", "A valid positive BIGINT ID is required");
  }
}

function assertQuantity(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > INT_MAX)
    throw new AppError(400, "INVALID_QUANTITY", "Quantity must be a positive 32-bit integer");
}

function stockView(variantId: bigint, row: typeof inventories.$inferSelect | undefined) {
  if (!row) {
    return {
      variantId: variantId.toString(),
      onHand: 0,
      reserved: 0,
      availableQuantity: 0,
      inStock: false,
      stockStatus: "OUT_OF_STOCK" as const,
      updatedAt: null,
    };
  }
  const availableQuantity = row.onHand - row.reserved;
  return {
    variantId: variantId.toString(),
    onHand: row.onHand,
    reserved: row.reserved,
    availableQuantity,
    inStock: availableQuantity > 0,
    stockStatus: availableQuantity > 0 ? ("IN_STOCK" as const) : ("OUT_OF_STOCK" as const),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicStock(variantId: bigint, row: typeof inventories.$inferSelect | undefined) {
  if (!row) {
    return {
      variantId: variantId.toString(),
      availableQuantity: null,
      inStock: null,
      stockStatus: "UNKNOWN" as const,
    };
  }
  const availableQuantity = row.onHand - row.reserved;
  return {
    variantId: variantId.toString(),
    availableQuantity,
    inStock: availableQuantity > 0,
    stockStatus: availableQuantity > 0 ? ("IN_STOCK" as const) : ("OUT_OF_STOCK" as const),
  };
}

async function ensureLockedInventory(tx: Transaction, variantId: bigint) {
  const [variant] = await tx
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);
  if (!variant) throw new AppError(404, "VARIANT_NOT_FOUND", "Product variant not found");
  await tx
    .insert(inventories)
    .values({ variantId, onHand: 0, reserved: 0 })
    .onConflictDoNothing({ target: inventories.variantId });
  const [row] = await tx
    .select()
    .from(inventories)
    .where(eq(inventories.variantId, variantId))
    .for("update");
  if (!row) throw new AppError(500, "INVENTORY_UNAVAILABLE", "Inventory row could not be locked");
  return row;
}

async function existingIdempotentMovement(
  tx: Transaction,
  variantId: bigint,
  key: string | undefined,
  expectedType: MovementType,
) {
  if (!key) return null;
  const [movement] = await tx
    .select()
    .from(inventoryMovements)
    .where(
      and(eq(inventoryMovements.variantId, variantId), eq(inventoryMovements.idempotencyKey, key)),
    )
    .limit(1);
  if (!movement) return null;
  if (movement.type !== expectedType)
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "Idempotency key was used for a different operation",
    );
  return movement;
}

async function insertMovement(
  tx: Transaction,
  input: {
    variantId: bigint;
    type: MovementType;
    quantity: number;
    referenceType?: string | null;
    referenceId?: string | null;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const [movement] = await tx.insert(inventoryMovements).values(input).returning();
  return movement!;
}

function serializeReservation(row: typeof inventoryReservations.$inferSelect) {
  return {
    id: row.id.toString(),
    variantId: row.variantId.toString(),
    quantity: row.quantity,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    reference: { type: row.referenceType, id: row.referenceId },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createInventoryService(db: Database) {
  async function getStock(variantIdValue: string | bigint) {
    const variantId = parseId(variantIdValue);
    const [variant] = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);
    if (!variant) throw new AppError(404, "VARIANT_NOT_FOUND", "Product variant not found");
    const [row] = await db
      .select()
      .from(inventories)
      .where(eq(inventories.variantId, variantId))
      .limit(1);
    return stockView(variantId, row);
  }

  async function publicStockBySku(sku: string) {
    const [row] = await db
      .select({ variantId: productVariants.id, inventory: inventories })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(inventories, eq(inventories.variantId, productVariants.id))
      .where(
        and(
          eq(productVariants.sku, sku),
          eq(productVariants.status, "ACTIVE"),
          eq(products.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!row) throw new AppError(404, "SKU_NOT_FOUND", "Active product SKU not found");
    return { sku, ...toPublicStock(row.variantId, row.inventory || undefined) };
  }

  async function publicStockForVariants(variantIds: bigint[]) {
    if (!variantIds.length) return new Map<string, ReturnType<typeof toPublicStock>>();
    const rows = await db
      .select({ variantId: productVariants.id, inventory: inventories })
      .from(productVariants)
      .leftJoin(inventories, eq(inventories.variantId, productVariants.id))
      .where(and(eq(productVariants.status, "ACTIVE"), inArray(productVariants.id, variantIds)));
    return new Map(
      rows.map((row) => [
        row.variantId.toString(),
        toPublicStock(row.variantId, row.inventory || undefined),
      ]),
    );
  }

  async function mutateStock(
    variantIdValue: string | bigint,
    type: "INBOUND" | "OUTBOUND" | "ADJUSTMENT",
    value: number,
    idempotencyKey?: string,
    reference?: { type: string; id: string },
    transaction?: Transaction,
  ) {
    if (type === "ADJUSTMENT") {
      if (!Number.isSafeInteger(value) || value < 0 || value > INT_MAX)
        throw new AppError(
          400,
          "INVALID_QUANTITY",
          "New stock must be a non-negative 32-bit integer",
        );
    } else assertQuantity(value);
    const variantId = parseId(variantIdValue);
    const apply = async (tx: Transaction) => {
      const row = await ensureLockedInventory(tx, variantId);
      const previous = await existingIdempotentMovement(tx, variantId, idempotencyKey, type);
      if (previous)
        return { ...stockView(variantId, row), movementId: previous.id.toString(), replayed: true };
      let onHand = row.onHand;
      let movementQuantity = value;
      if (type === "INBOUND") onHand += value;
      else if (type === "OUTBOUND") {
        if (row.onHand - value < row.reserved)
          throw new AppError(409, "INSUFFICIENT_STOCK", "Available stock is insufficient");
        onHand -= value;
      } else {
        if (value < row.reserved)
          throw new AppError(
            409,
            "BELOW_RESERVED_STOCK",
            "New stock cannot be lower than reserved stock",
          );
        movementQuantity = value - row.onHand;
        onHand = value;
        if (movementQuantity === 0)
          return { ...stockView(variantId, row), movementId: null, replayed: false };
      }
      if (!Number.isSafeInteger(onHand) || onHand > INT_MAX)
        throw new AppError(
          409,
          "STOCK_LIMIT_EXCEEDED",
          "Stock exceeds the supported integer range",
        );
      const [updated] = await tx
        .update(inventories)
        .set({ onHand, updatedAt: new Date() })
        .where(eq(inventories.variantId, variantId))
        .returning();
      const movement = await insertMovement(tx, {
        variantId,
        type,
        quantity: movementQuantity,
        ...(reference ? { referenceType: reference.type, referenceId: reference.id } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
      return {
        ...stockView(variantId, updated),
        movementId: movement.id.toString(),
        replayed: false,
      };
    };
    return transaction ? apply(transaction) : db.transaction(apply);
  }

  async function increaseStock(
    variantId: string | bigint,
    quantity: number,
    options: { transaction?: Transaction; idempotencyKey?: string; reference?: { type: string; id: string } } = {},
  ) {
    return mutateStock(variantId, "INBOUND", quantity, options.idempotencyKey, options.reference, options.transaction);
  }

  async function decreaseStock(
    variantId: string | bigint,
    quantity: number,
    options: { transaction?: Transaction; idempotencyKey?: string; reference?: { type: string; id: string } } = {},
  ) {
    return mutateStock(variantId, "OUTBOUND", quantity, options.idempotencyKey, options.reference, options.transaction);
  }

  async function adjustStock(
    variantId: string | bigint,
    newQuantity: number,
    options: { transaction?: Transaction; idempotencyKey?: string; reference?: { type: string; id: string } } = {},
  ) {
    return mutateStock(
      variantId,
      "ADJUSTMENT",
      newQuantity,
      options.idempotencyKey,
      options.reference,
      options.transaction,
    );
  }

  async function reserveStock(
    variantIdValue: string | bigint,
    quantity: number,
    reference: { type: string; id: string },
    options: { idempotencyKey?: string; ttlMs?: number; transaction?: Transaction } = {},
  ) {
    assertQuantity(quantity);
    if (!reference?.type?.trim() || !reference?.id?.trim())
      throw new AppError(400, "INVALID_RESERVATION_REFERENCE", "Reservation reference is required");
    const variantId = parseId(variantIdValue);
    const run = async (tx: Transaction) => {
      const row = await ensureLockedInventory(tx, variantId);
      const previous = await existingIdempotentMovement(
        tx,
        variantId,
        options.idempotencyKey,
        "RESERVE",
      );
      if (previous) {
        const [reservation] = previous.referenceId
          ? await tx
              .select()
              .from(inventoryReservations)
              .where(eq(inventoryReservations.id, BigInt(previous.referenceId)))
              .limit(1)
          : [];
        if (!reservation)
          throw new AppError(500, "RESERVATION_MISSING", "Reservation record is missing");
        return {
          reservation: serializeReservation(reservation),
          stock: stockView(variantId, row),
          replayed: true,
        };
      }
      if (row.onHand - row.reserved < quantity)
        throw new AppError(409, "INSUFFICIENT_STOCK", "Available stock is insufficient");
      const ttlMs = options.ttlMs ?? INVENTORY_RESERVATION_TTL_MS;
      if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 24 * 60 * 60 * 1000)
        throw new AppError(
          400,
          "INVALID_RESERVATION_TTL",
          "Reservation TTL must be between 1 second and 24 hours",
        );
      const now = new Date();
      const [reservation] = await tx
        .insert(inventoryReservations)
        .values({
          variantId,
          quantity,
          status: "ACTIVE",
          expiresAt: new Date(now.getTime() + ttlMs),
          referenceType: reference.type,
          referenceId: reference.id,
        })
        .returning();
      const [updated] = await tx
        .update(inventories)
        .set({ reserved: row.reserved + quantity, updatedAt: now })
        .where(eq(inventories.variantId, variantId))
        .returning();
      await insertMovement(tx, {
        variantId,
        type: "RESERVE",
        quantity,
        referenceType: "reservation",
        referenceId: reservation!.id.toString(),
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
        metadata: { checkoutReference: reference },
      });
      return {
        reservation: serializeReservation(reservation!),
        stock: stockView(variantId, updated),
        replayed: false,
      };
    };
    return options.transaction ? run(options.transaction) : db.transaction(run);
  }

  async function finishReservation(idValue: string | bigint, action: "RELEASED" | "CONFIRMED", transaction?: Transaction) {
    const id = parseId(idValue);
    const run = async (tx: Transaction) => {
      const [reservation] = await tx
        .select()
        .from(inventoryReservations)
        .where(eq(inventoryReservations.id, id))
        .for("update")
        .limit(1);
      if (!reservation) throw new AppError(404, "RESERVATION_NOT_FOUND", "Reservation not found");
      if (reservation.status !== "ACTIVE") return serializeReservation(reservation);
      const row = await ensureLockedInventory(tx, reservation.variantId);
      const expired = reservation.referenceType !== "order" && reservation.expiresAt.getTime() <= Date.now();
      const status: ReservationStatus = expired ? "EXPIRED" : action;
      const now = new Date();
      if (status === "CONFIRMED") {
        if (row.onHand < reservation.quantity || row.reserved < reservation.quantity)
          throw new AppError(
            500,
            "INVENTORY_INVARIANT_VIOLATION",
            "Reservation exceeds current stock",
          );
        await tx
          .update(inventories)
          .set({
            onHand: row.onHand - reservation.quantity,
            reserved: row.reserved - reservation.quantity,
            updatedAt: now,
          })
          .where(eq(inventories.variantId, reservation.variantId));
        await insertMovement(tx, {
          variantId: reservation.variantId,
          type: "OUTBOUND",
          quantity: reservation.quantity,
          referenceType: "reservation",
          referenceId: reservation.id.toString(),
          idempotencyKey: `reservation-confirm:${reservation.id}`,
        });
      } else {
        if (row.reserved < reservation.quantity)
          throw new AppError(
            500,
            "INVENTORY_INVARIANT_VIOLATION",
            "Reserved stock is lower than reservation quantity",
          );
        await tx
          .update(inventories)
          .set({ reserved: row.reserved - reservation.quantity, updatedAt: now })
          .where(eq(inventories.variantId, reservation.variantId));
        await insertMovement(tx, {
          variantId: reservation.variantId,
          type: "RELEASE",
          quantity: reservation.quantity,
          referenceType: "reservation",
          referenceId: reservation.id.toString(),
          idempotencyKey: `reservation-release:${reservation.id}`,
          metadata: expired ? { reason: "expired" } : {},
        });
      }
      const [updated] = await tx
        .update(inventoryReservations)
        .set({ status, updatedAt: now })
        .where(eq(inventoryReservations.id, id))
        .returning();
      return serializeReservation(updated!);
    };
    return transaction ? run(transaction) : db.transaction(run);
  }

  async function releaseReservation(id: string | bigint, transaction?: Transaction) {
    return finishReservation(id, "RELEASED", transaction);
  }

  async function confirmReservation(id: string | bigint, transaction?: Transaction) {
    return finishReservation(id, "CONFIRMED", transaction);
  }

  async function expireReservations() {
    const now = new Date();
    return db.transaction(async (tx) => {
      const expired = await tx
        .select()
        .from(inventoryReservations)
        .where(
          and(
            eq(inventoryReservations.status, "ACTIVE"),
            lte(inventoryReservations.expiresAt, now),
            ne(inventoryReservations.referenceType, "order"),
          ),
        )
        .orderBy(asc(inventoryReservations.id))
        .limit(100)
        .for("update", { skipLocked: true });
      for (const reservation of expired) {
        const row = await ensureLockedInventory(tx, reservation.variantId);
        if (row.reserved < reservation.quantity)
          throw new AppError(
            500,
            "INVENTORY_INVARIANT_VIOLATION",
            "Reserved stock is lower than reservation quantity",
          );
        await tx
          .update(inventories)
          .set({ reserved: row.reserved - reservation.quantity, updatedAt: now })
          .where(eq(inventories.variantId, reservation.variantId));
        await tx
          .update(inventoryReservations)
          .set({ status: "EXPIRED", updatedAt: now })
          .where(eq(inventoryReservations.id, reservation.id));
        await insertMovement(tx, {
          variantId: reservation.variantId,
          type: "RELEASE",
          quantity: reservation.quantity,
          referenceType: "reservation",
          referenceId: reservation.id.toString(),
          idempotencyKey: `reservation-expire:${reservation.id}`,
          metadata: { reason: "expired" },
        });
      }
      return expired.length;
    });
  }

  async function movements(variantIdValue: string | bigint, page: number, limit: number) {
    const variantId = parseId(variantIdValue);
    const [variant] = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);
    if (!variant) throw new AppError(404, "VARIANT_NOT_FOUND", "Product variant not found");
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.variantId, variantId))
        .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ total: count() })
        .from(inventoryMovements)
        .where(eq(inventoryMovements.variantId, variantId)),
    ]);
    const total = Number(totalRows[0]?.total ?? 0);
    return {
      items: rows.map((row) => ({
        ...row,
        id: row.id.toString(),
        variantId: row.variantId.toString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async function adminStock(variantIdValue: string | bigint) {
    const variantId = parseId(variantIdValue);
    const [row] = await db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        inventory: inventories,
      })
      .from(productVariants)
      .leftJoin(inventories, eq(inventories.variantId, productVariants.id))
      .where(eq(productVariants.id, variantId))
      .limit(1);
    if (!row) throw new AppError(404, "VARIANT_NOT_FOUND", "Product variant not found");
    return { sku: row.sku, ...stockView(variantId, row.inventory || undefined) };
  }

  return {
    getStock,
    publicStockBySku,
    publicStockForVariants,
    adminStock,
    increaseStock,
    decreaseStock,
    adjustStock,
    reserveStock,
    releaseReservation,
    confirmReservation,
    expireReservations,
    movements,
  };
}

export type InventoryService = ReturnType<typeof createInventoryService>;
