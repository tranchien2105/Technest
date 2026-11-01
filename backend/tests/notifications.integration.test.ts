import { describe, expect, it } from "vitest";
import request from "supertest";
import { createDatabase } from "../src/config/database.js";
import { loadEnv } from "../src/config/env.js";
import * as schema from "../src/database/schema/index.js";
import { createNotificationsService } from "../src/modules/notifications/notifications.service.js";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/config/logger.js";
import { AppError } from "../src/shared/errors.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";

describe.skipIf(process.env.RUN_NOTIFICATION_DB_TESTS !== "1")("Notifications PostgreSQL + HTTP", () => {
  it("deduplicates events, isolates recipients, paginates, filters and marks read", async () => {
    const env = loadEnv();
    if (env.NODE_ENV === "production") throw new Error("Development database required");
    const { db, pool } = createDatabase(env.DATABASE_URL, { statement_timeout: 10000, query_timeout: 12000 });
    const suffix = crypto.randomUUID();
    let userId: number | undefined;
    try {
      const [user] = await db.insert(schema.users).values({ email: `notifications-${suffix}@example.test`, passwordHash: "test-only" }).returning();
      userId = user!.id;
      const auth = { authenticate: async (token?: string) => {
        if (!token) throw new AppError(401, "UNAUTHENTICATED", "Required");
        return { ...user!, id: token === "other" ? user!.id + 1000000 : user!.id, role: token === "admin" ? "ADMIN" : "CUSTOMER" };
      } } as unknown as AuthService;
      const service = createNotificationsService(db);
      const published: string[] = [];
      const publish = (recipientId: string) => published.push(recipientId);
      const app = createApp({ logger: createLogger("silent"), corsOrigin: "http://localhost:5173", health: { postgres: async () => 1, redis: async () => "PONG" }, notifications: { service, auth }, admin: { db, auth, notify: publish }, publishNotification: publish });
      const payload = { type: "SYSTEM_ANNOUNCEMENT" as const, title: "Thông báo hệ thống", message: "Cập nhật dịch vụ Technest.", targetUrl: "/account", eventKey: `notice:${suffix}` };
      const [first, duplicate] = await Promise.all([service.createForUser(userId!, payload), service.createForUser(userId!, payload)]);
      expect(first?.id).toBe(duplicate?.id);
      await service.createForUser(userId!, { ...payload, eventKey: `notice:${suffix}:2`, title: "Thông báo thứ hai" });
      await request(app).get("/api/v1/notifications").expect(401);
      const list = await request(app).get("/api/v1/notifications?page=1&limit=1&category=SYSTEM").set("Authorization", "Bearer self").expect(200);
      expect(list.body.data.items).toHaveLength(1);
      expect(list.body.data.pagination.total).toBe(2);
      expect(list.body.data.items[0].id).toMatch(/^\d+$/);
      expect(list.text).not.toMatch(/passwordHash|refreshTokenHash/i);
      const ownId = list.body.data.items[0].id as string;
      await request(app).patch(`/api/v1/notifications/${ownId}/read`).set("Authorization", "Bearer other").expect(404);
      await request(app).patch(`/api/v1/notifications/${ownId}/read`).set("Authorization", "Bearer self").expect(200);
      expect((await request(app).get("/api/v1/notifications/unread-count").set("Authorization", "Bearer self").expect(200)).body.data.unreadCount).toBe(1);
      const markAll = await request(app).patch("/api/v1/notifications/read-all").set("Authorization", "Bearer self").expect(200);
      expect(markAll.body.data).toMatchObject({ markedCount: 1, unreadCount: 0 });
      const announcement = { title: "Lịch bảo trì", message: "Technest sẽ bảo trì hệ thống vào tối Chủ nhật.", recipientUserIds: [String(userId)], eventKey: `announcement:${suffix}`, targetUrl: "/account" };
      await request(app).post("/api/v1/admin/notifications/announcements").set("Authorization", "Bearer self").send(announcement).expect(403);
      const sent = await request(app).post("/api/v1/admin/notifications/announcements").set("Authorization", "Bearer admin").send(announcement).expect(200);
      expect(sent.body.data.created).toBe(1);
      expect(published).toEqual([String(userId)]);
      const replay = await request(app).post("/api/v1/admin/notifications/announcements").set("Authorization", "Bearer admin").send(announcement).expect(200);
      expect(replay.body.data.created).toBe(0);
      expect(published).toHaveLength(1);
      await request(app).patch(`/api/v1/admin/customers/${userId}/status`).set("Authorization", "Bearer admin").send({ status: "BLOCKED" }).expect(200);
      expect((await service.getNotifications(userId!, { page: 1, limit: 50, category: "ACCOUNT" })).items.map((item) => item.type)).toEqual(["ACCOUNT_LOCKED"]);
      expect(published).toHaveLength(2);
      await request(app).patch(`/api/v1/admin/customers/${userId}/status`).set("Authorization", "Bearer admin").send({ status: "ACTIVE" }).expect(200);
      expect((await service.getNotifications(userId!, { page: 1, limit: 50, category: "ACCOUNT" })).pagination.total).toBe(1);
    } finally {
      if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      await pool.end();
    }
  }, 30000);
});
