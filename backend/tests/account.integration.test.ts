import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/config/logger.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import { AppError } from "../src/shared/errors.js";
import type { AccountService } from "../src/modules/account/account.service.js";

const user = { id: 42, email: "customer@example.com", fullName: "Test Customer", phone: null, role: "CUSTOMER" as const, status: "ACTIVE" as const };
const account = {
  profile: vi.fn(async (userId: number) => ({ id: String(userId), email: user.email, fullName: user.fullName, phone: null })),
  updateProfile: vi.fn(async (userId: number, input: { fullName?: string }) => ({ id: String(userId), email: user.email, fullName: input.fullName, phone: null })),
  listAddresses: vi.fn(async (userId: number) => [{ id: "1", userId, isDefault: true }]),
  createAddress: vi.fn(async (userId: number, input: { recipientName: string }) => ({ id: "2", userId, recipientName: input.recipientName, isDefault: true })),
  updateAddress: vi.fn(), setDefault: vi.fn(), deleteAddress: vi.fn(),
  changePassword: vi.fn(async () => ({ changed: true, sessionsRevoked: true })),
  listSessions: vi.fn(async () => [{ id: "8", createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), revokedAt: null, currentSession: null }]),
  revokeSession: vi.fn(async (_userId: number, id: string) => ({ id, revoked: true })),
} as unknown as AccountService;
const auth = { authenticate: vi.fn(async (token?: string) => { if (!token) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required"); return user; }) } as unknown as AuthService;
const redis = { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(true) } as never;
const app = createApp({
  logger: createLogger("silent"), corsOrigin: "http://localhost:5173",
  health: { postgres: async () => 1, redis: async () => "PONG" },
  account: { service: account, auth, redis },
});

describe("Account API integration", () => {
  it("requires authentication and returns only the current user's safe profile", async () => {
    await request(app).get("/api/v1/account/profile").expect(401);
    const response = await request(app).get("/api/v1/account/profile").set("Authorization", "Bearer test").expect(200);
    expect(response.body.data).toEqual({ id: "42", email: user.email, fullName: user.fullName, phone: null });
    expect(account.profile).toHaveBeenCalledWith(user.id);
  });

  it("validates profile changes and drops attempts to change role or status", async () => {
    await request(app).patch("/api/v1/account/profile").set("Authorization", "Bearer test").send({ role: "ADMIN", status: "ACTIVE" }).expect(400);
    await request(app).patch("/api/v1/account/profile").set("Authorization", "Bearer test").send({ fullName: "Updated", role: "ADMIN" }).expect(200);
    expect(account.updateProfile).toHaveBeenCalledWith(user.id, { fullName: "Updated" });
  });

  it("scopes address and session operations to the authenticated user and never returns token hashes", async () => {
    const addresses = await request(app).get("/api/v1/account/addresses").set("Authorization", "Bearer test").expect(200);
    expect(addresses.body.data[0].userId).toBe(user.id);
    const created = await request(app).post("/api/v1/account/addresses").set("Authorization", "Bearer test").send({ recipientName: "Customer", phone: "0901234567", addressLine: "1 Test Street", city: "Hà Nội" }).expect(201);
    expect(created.body.data.userId).toBe(user.id);
    const sessions = await request(app).get("/api/v1/account/sessions").set("Authorization", "Bearer test").expect(200);
    expect(sessions.text).not.toMatch(/refreshToken|passwordHash|tokenHash/i);
    await request(app).delete("/api/v1/account/sessions/8").set("Authorization", "Bearer test").expect(200);
    expect(account.revokeSession).toHaveBeenCalledWith(user.id, "8");
  });
});
