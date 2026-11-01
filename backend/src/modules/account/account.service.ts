import argon2 from "argon2";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import { authSessions, userAddresses, users } from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";
import { insertNotification } from "../notifications/notifications.service.js";

type Database = NodePgDatabase<typeof schema>;
type AddressInput = Partial<typeof userAddresses.$inferInsert>;

function addressId(value: string) {
  try {
    const parsed = BigInt(value);
    if (parsed <= 0n) throw new Error();
    return parsed;
  } catch {
    throw new AppError(400, "INVALID_ID", "A valid address ID is required");
  }
}

export function createAccountService(db: Database) {
  async function profile(userId: number) {
    const [user] = await db.select({ id: users.id, email: users.email, fullName: users.fullName, phone: users.phone, createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "Account not found");
    return { ...user, id: String(user.id), createdAt: user.createdAt.toISOString() };
  }

  async function updateProfile(userId: number, input: { fullName?: string | null; phone?: string | null }) {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select({ id: users.id, email: users.email, fullName: users.fullName, phone: users.phone, createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).for("update").limit(1);
      if (!current) throw new AppError(404, "USER_NOT_FOUND", "Account not found");
      const values: { fullName?: string | null; phone?: string | null; updatedAt: Date } = { updatedAt: new Date() };
      if (input.fullName !== undefined) values.fullName = input.fullName;
      if (input.phone !== undefined) values.phone = input.phone;
      const changed = (input.fullName !== undefined && input.fullName !== current.fullName) || (input.phone !== undefined && input.phone !== current.phone);
      const [user] = changed ? await tx.update(users).set(values).where(eq(users.id, userId)).returning({ id: users.id, email: users.email, fullName: users.fullName, phone: users.phone, createdAt: users.createdAt }) : [current];
      const notification = changed ? await insertNotification(tx, { recipientUserId: userId, type: "ACCOUNT_UPDATED", title: "Thông tin tài khoản đã được cập nhật", message: "Thông tin hồ sơ Technest của bạn vừa được thay đổi.", entityType: "ACCOUNT", entityId: String(userId), targetUrl: "/account/profile", eventKey: `account:${userId}:profile:${user!.createdAt.getTime()}:${Date.now()}` }) : null;
      return { user, notification };
    });
    return { ...result.user!, id: String(result.user!.id), createdAt: result.user!.createdAt.toISOString(), notification: result.notification };
  }

  async function listAddresses(userId: number) {
    const rows = await db.select().from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(desc(userAddresses.isDefault), asc(userAddresses.createdAt), asc(userAddresses.id));
    return rows.map((row) => ({ ...row, id: row.id.toString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
  }

  async function createAddress(userId: number, input: AddressInput) {
    return db.transaction(async (tx) => {
      // Serialize address-book writes per account to uphold the single-default invariant.
      const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update").limit(1);
      if (!owner) throw new AppError(404, "USER_NOT_FOUND", "Account not found");
      const existing = await tx.select({ id: userAddresses.id }).from(userAddresses).where(eq(userAddresses.userId, userId)).limit(1);
      const makeDefault = input.isDefault === true || existing.length === 0;
      if (makeDefault) await tx.update(userAddresses).set({ isDefault: false, updatedAt: new Date() }).where(eq(userAddresses.userId, userId));
      const [row] = await tx.insert(userAddresses).values({
        userId,
        recipientName: input.recipientName!, phone: input.phone!, addressLine: input.addressLine!, city: input.city!,
        district: input.district ?? null, ward: input.ward ?? null, label: input.label ?? null, isDefault: makeDefault,
      }).returning();
      return { ...row!, id: row!.id.toString(), createdAt: row!.createdAt.toISOString(), updatedAt: row!.updatedAt.toISOString() };
    });
  }

  async function updateAddress(userId: number, value: string, input: AddressInput) {
    const id = addressId(value);
    return db.transaction(async (tx) => {
      const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update").limit(1);
      if (!owner) throw new AppError(404, "USER_NOT_FOUND", "Account not found");
      const [current] = await tx.select().from(userAddresses).where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId))).for("update").limit(1);
      if (!current) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
      const values: Partial<typeof userAddresses.$inferInsert> = { updatedAt: new Date() };
      for (const field of ["recipientName", "phone", "addressLine", "city", "district", "ward", "label"] as const) {
        if (input[field] !== undefined) values[field] = input[field] as never;
      }
      if (input.isDefault === true) {
        await tx.update(userAddresses).set({ isDefault: false, updatedAt: new Date() }).where(eq(userAddresses.userId, userId));
        values.isDefault = true;
      } else if (input.isDefault === false && current.isDefault) {
        values.isDefault = false;
      }
      const [updated] = await tx.update(userAddresses).set(values).where(eq(userAddresses.id, id)).returning();
      if (current.isDefault && input.isDefault === false) {
        const [next] = await tx.select({ id: userAddresses.id }).from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(asc(userAddresses.createdAt), asc(userAddresses.id)).limit(1);
        if (next) await tx.update(userAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(userAddresses.id, next.id));
      }
      return { ...updated!, id: updated!.id.toString(), createdAt: updated!.createdAt.toISOString(), updatedAt: updated!.updatedAt.toISOString() };
    });
  }

  async function setDefault(userId: number, value: string) {
    const id = addressId(value);
    return db.transaction(async (tx) => {
      const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update").limit(1);
      if (!owner) throw new AppError(404, "USER_NOT_FOUND", "Account not found");
      const [target] = await tx.select({ id: userAddresses.id }).from(userAddresses).where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId))).limit(1);
      if (!target) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
      await tx.update(userAddresses).set({ isDefault: false, updatedAt: new Date() }).where(eq(userAddresses.userId, userId));
      await tx.update(userAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(userAddresses.id, id));
      return { id: id.toString(), isDefault: true };
    });
  }

  async function deleteAddress(userId: number, value: string) {
    const id = addressId(value);
    return db.transaction(async (tx) => {
      const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update").limit(1);
      if (!owner) throw new AppError(404, "USER_NOT_FOUND", "Account not found");
      const [current] = await tx.delete(userAddresses).where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId))).returning();
      if (!current) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
      if (current.isDefault) {
        const [next] = await tx.select({ id: userAddresses.id }).from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(asc(userAddresses.createdAt), asc(userAddresses.id)).limit(1);
        if (next) await tx.update(userAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(userAddresses.id, next.id));
      }
      return { id: id.toString(), deleted: true };
    });
  }

  async function changePassword(userId: number, currentPassword: string, newPassword: string) {
    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) throw new AppError(400, "CURRENT_PASSWORD_INVALID", "Current password is incorrect");
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const notification = await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
      return insertNotification(tx, { recipientUserId: userId, type: "SECURITY_ALERT", title: "Mật khẩu đã được thay đổi", message: "Mật khẩu tài khoản Technest vừa được cập nhật. Nếu bạn không thực hiện thay đổi này, hãy liên hệ bộ phận hỗ trợ.", entityType: "ACCOUNT", entityId: String(userId), targetUrl: "/account/security", eventKey: `account:${userId}:password:${Date.now()}` });
    });
    return { changed: true, sessionsRevoked: true, notification };
  }

  async function listSessions(userId: number) {
    const rows = await db.select({ id: authSessions.id, createdAt: authSessions.createdAt, expiresAt: authSessions.expiresAt, revokedAt: authSessions.revokedAt }).from(authSessions).where(and(eq(authSessions.userId, userId), gt(authSessions.expiresAt, new Date()))).orderBy(desc(authSessions.createdAt));
    return rows.map((row) => ({ id: row.id.toString(), createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null, currentSession: null }));
  }

  async function revokeSession(userId: number, value: string) {
    const parsed = addressId(value);
    if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new AppError(400, "INVALID_ID", "A valid session ID is required");
    const id = Number(parsed);
    const [row] = await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.id, id), eq(authSessions.userId, userId), isNull(authSessions.revokedAt))).returning({ id: authSessions.id });
    if (!row) throw new AppError(404, "SESSION_NOT_FOUND", "Active session not found");
    return { id: row.id.toString(), revoked: true };
  }

  return { profile, updateProfile, listAddresses, createAddress, updateAddress, setDefault, deleteAddress, changePassword, listSessions, revokeSession };
}

export type AccountService = ReturnType<typeof createAccountService>;
