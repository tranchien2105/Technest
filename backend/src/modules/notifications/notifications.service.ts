import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import { notifications, users } from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";
import type { notificationTypes } from "./notification.schemas.js";

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type NotificationType = (typeof notificationTypes)[number];
export type CreateNotificationInput = {
  recipientUserId: string | bigint | number;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  targetUrl?: string | null;
  eventKey?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, string | number | boolean | null>;
};

const safeLocalTarget = (targetUrl?: string | null) => {
  if (!targetUrl) return null;
  if (!targetUrl.startsWith("/") || targetUrl.startsWith("//") || targetUrl.includes("\\")) {
    throw new Error("Notification target must be a local path");
  }
  return targetUrl;
};

function dto(row: typeof notifications.$inferSelect) {
  return {
    id: row.id.toString(), type: row.type, title: row.title, message: row.message,
    entityType: row.entityType, entityId: row.entityId, targetUrl: row.targetUrl,
    metadata: row.metadata, readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

export async function insertNotification(tx: Transaction, input: CreateNotificationInput) {
  const [created] = await tx.insert(notifications).values({
    recipientUserId: BigInt(input.recipientUserId), type: input.type,
    title: input.title.trim(), message: input.message.trim(),
    entityType: input.entityType ?? null, entityId: input.entityId ?? null,
    targetUrl: safeLocalTarget(input.targetUrl), eventKey: input.eventKey ?? null,
    expiresAt: input.expiresAt ?? null, metadata: input.metadata ?? {},
  }).onConflictDoNothing().returning();
  if (created) return dto(created);
  return null;
}

export function createNotificationsService(db: Database) {
  async function createNotification(input: CreateNotificationInput) {
    return db.transaction(async (tx) => {
      const inserted = await insertNotification(tx, input);
      if (inserted || !input.eventKey) return inserted;
      const [existing] = await tx.select().from(notifications).where(eq(notifications.eventKey, input.eventKey)).limit(1);
      return existing ? dto(existing) : null;
    });
  }

  async function createForUser(userId: string | bigint | number, input: Omit<CreateNotificationInput, "recipientUserId">) {
    return createNotification({ ...input, recipientUserId: userId });
  }

  async function createForUsers(userIds: Array<string | bigint | number>, input: Omit<CreateNotificationInput, "recipientUserId" | "eventKey"> & { eventKey: string }) {
    return db.transaction(async (tx) => {
      const recipientIds = [...new Set(userIds.map((id) => BigInt(id).toString()))];
      const eligible = recipientIds.length ? await tx.select({ id: users.id }).from(users).where(and(inArray(users.id, recipientIds.map(Number)), eq(users.status, "ACTIVE"))) : [];
      if (eligible.length !== recipientIds.length) throw new AppError(400, "INVALID_RECIPIENTS", "Một hoặc nhiều tài khoản nhận không tồn tại hoặc đã bị khóa.");
      const created = [];
      for (const userId of recipientIds) {
        const row = await insertNotification(tx, { ...input, recipientUserId: userId, eventKey: `${input.eventKey}:${userId}` });
        if (row) created.push({ recipientUserId: userId, notification: row });
      }
      return created;
    });
  }

  async function getNotifications(userId: number, options: { page: number; limit: number; type?: NotificationType; category?: "ORDERS" | "PROMOTIONS" | "ACCOUNT" | "SYSTEM"; unread?: boolean }) {
    const categories: Record<NonNullable<typeof options.category>, NotificationType[]> = {
      ORDERS: ["ORDER_STATUS_UPDATED", "ORDER_CANCELLED", "ORDER_DELIVERED"],
      PROMOTIONS: ["PROMOTION_AVAILABLE", "PROMOTION_EXPIRING"],
      ACCOUNT: ["ACCOUNT_UPDATED", "ACCOUNT_LOCKED", "SECURITY_ALERT"],
      SYSTEM: ["SYSTEM_ANNOUNCEMENT"],
    };
    const where = and(
      eq(notifications.recipientUserId, BigInt(userId)),
      options.type ? eq(notifications.type, options.type) : undefined,
      options.category ? inArray(notifications.type, categories[options.category]) : undefined,
      options.unread ? isNull(notifications.readAt) : undefined,
      sql`(${notifications.expiresAt} IS NULL OR ${notifications.expiresAt} > now())`,
    );
    const [rows, totals] = await Promise.all([
      db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(options.limit).offset((options.page - 1) * options.limit),
      db.select({ total: count() }).from(notifications).where(where),
    ]);
    const total = Number(totals[0]?.total ?? 0);
    return { items: rows.map(dto), pagination: { page: options.page, limit: options.limit, total, totalPages: Math.ceil(total / options.limit) } };
  }

  async function getUnreadCount(userId: number) {
    const [result] = await db.select({ total: count() }).from(notifications).where(and(
      eq(notifications.recipientUserId, BigInt(userId)), isNull(notifications.readAt),
      sql`(${notifications.expiresAt} IS NULL OR ${notifications.expiresAt} > now())`,
    ));
    return Number(result?.total ?? 0);
  }

  async function markAsRead(userId: number, idValue: string) {
    const id = BigInt(idValue);
    const [row] = await db.update(notifications).set({ readAt: new Date() }).where(and(
      eq(notifications.id, id), eq(notifications.recipientUserId, BigInt(userId)), isNull(notifications.readAt),
    )).returning();
    if (!row) {
      const [existing] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.id, id), eq(notifications.recipientUserId, BigInt(userId)))).limit(1);
      if (!existing) return null;
    }
    return { unreadCount: await getUnreadCount(userId) };
  }

  async function markAllAsRead(userId: number) {
    const marked = await db.update(notifications).set({ readAt: new Date() }).where(and(
      eq(notifications.recipientUserId, BigInt(userId)), isNull(notifications.readAt),
    )).returning({ id: notifications.id });
    return { markedCount: marked.length, unreadCount: await getUnreadCount(userId) };
  }

  return { createNotification, createForUser, createForUsers, getNotifications, getUnreadCount, markAsRead, markAllAsRead };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
