import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/config/database.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/config/logger.js";
import { createAuthRepository } from "../src/modules/auth/auth.repository.js";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import { createPasswordResetRepository } from "../src/modules/auth/password-reset.repository.js";
import { createPasswordResetService } from "../src/modules/auth/password-reset.service.js";
import { createApp } from "../src/app.js";
import { passwordResetTokens, users } from "../src/database/schema/index.js";

describe.skipIf(process.env.RUN_PASSWORD_RESET_DB_TESTS !== "1")(
  "Password reset PostgreSQL + HTTP",
  () => {
    it("handles issuance, expiry, concurrent one-time use, account isolation and session revocation", async () => {
      const env = loadEnv();
      if (env.NODE_ENV === "production") throw new Error("Development database required");
      const { db, pool } = createDatabase(env.DATABASE_URL, {
        statement_timeout: 10000,
        query_timeout: 12000,
      });
      const mail = {
        sendReset: vi.fn().mockResolvedValue(undefined),
        sendChanged: vi.fn().mockResolvedValue(undefined),
      };
      const auth = createAuthService(createAuthRepository(db), env.AUTH_JWT_SECRET);
      const reset = createPasswordResetService(createPasswordResetRepository(db), mail, () => {});
      const counts = new Map<string, number>();
      const redis = {
        incr: async (key: string) => {
          const n = (counts.get(key) || 0) + 1;
          counts.set(key, n);
          return n;
        },
        expire: async () => true,
      };
      const app = createApp({
        logger: createLogger("silent"),
        corsOrigin: env.CORS_ORIGIN,
        health: { postgres: async () => 1, redis: async () => 1 },
        auth: { service: auth, env, redis: redis as never, passwordReset: reset },
      });
      const email = `reset-${crypto.randomUUID()}@example.test`;
      const otherEmail = `reset-other-${crypto.randomUUID()}@example.test`;
      const ids: number[] = [];
      try {
        const account = await auth.register({ email, password: "old-password-123" });
        ids.push(account.user.id);
        const other = await auth.register({ email: otherEmail, password: "old-password-123" });
        ids.push(other.user.id);
        await request(app).post("/api/v1/auth/forgot-password").send({ email: "bad" }).expect(400);
        const unknown = await request(app)
          .post("/api/v1/auth/forgot-password")
          .send({ email: "unknown@example.test" })
          .expect(200);
        const known = await request(app)
          .post("/api/v1/auth/forgot-password")
          .send({ email: email.toUpperCase() })
          .expect(200);
        expect(known.body).toEqual(unknown.body);
        const first = mail.sendReset.mock.calls.at(-1)![1] as string;
        const [stored] = await db
          .select()
          .from(passwordResetTokens)
          .where(eq(passwordResetTokens.userId, account.user.id));
        expect(stored!.tokenHash).not.toBe(first);
        await reset.forgot(email);
        const second = mail.sendReset.mock.calls.at(-1)![1] as string;
        await expect(reset.reset(first, "new-password-123")).rejects.toMatchObject({
          code: "INVALID_RESET_TOKEN",
        });
        await db
          .update(passwordResetTokens)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(passwordResetTokens.userId, account.user.id));
        await expect(reset.reset(second, "new-password-123")).rejects.toMatchObject({
          code: "INVALID_RESET_TOKEN",
        });
        await auth.authenticate(account.accessToken);
        await reset.forgot(email);
        const token = mail.sendReset.mock.calls.at(-1)![1] as string;
        await request(app)
          .post("/api/v1/auth/reset-password")
          .send({ token, password: "short" })
          .expect(400);
        const [results, concurrentRefresh] = await Promise.all([
          Promise.all([
            request(app)
              .post("/api/v1/auth/reset-password")
              .send({ token, password: "new-password-123" }),
            request(app)
              .post("/api/v1/auth/reset-password")
              .send({ token, password: "new-password-123" }),
          ]),
          auth.refresh(account.refreshToken).catch(() => null),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
        if (concurrentRefresh) {
          await expect(auth.authenticate(concurrentRefresh.accessToken)).rejects.toThrow();
          await expect(auth.refresh(concurrentRefresh.refreshToken)).rejects.toThrow();
        }
        expect(
          await createAuthRepository(db).createSession(
            account.user.id,
            "a".repeat(64),
            new Date(Date.now() + 60000),
            null,
          ),
        ).toBe(false);
        await expect(auth.authenticate(account.accessToken)).rejects.toMatchObject({
          code: "UNAUTHENTICATED",
        });
        await expect(auth.refresh(account.refreshToken)).rejects.toThrow();
        await expect(auth.login({ email, password: "old-password-123" })).rejects.toThrow();
        const signedIn = await auth.login({ email, password: "new-password-123" });
        expect((await auth.authenticate(signedIn.accessToken)).id).toBe(account.user.id);
        expect((await auth.authenticate(other.accessToken)).id).toBe(other.user.id);
        expect(mail.sendChanged).toHaveBeenCalledTimes(1);
        counts.clear();
        for (let i = 0; i < 3; i++)
          await request(app)
            .post("/api/v1/auth/forgot-password")
            .send({ email: "limited@example.test" })
            .expect(200);
        await request(app)
          .post("/api/v1/auth/forgot-password")
          .send({ email: "LIMITED@example.test" })
          .expect(429);
        await db.update(users).set({ status: "BLOCKED" }).where(eq(users.id, account.user.id));
        mail.sendReset.mockClear();
        await reset.forgot(email);
        expect(mail.sendReset).not.toHaveBeenCalled();
      } finally {
        for (const id of ids) await db.delete(users).where(eq(users.id, id));
        await pool.end();
      }
    }, 90000);
  },
);
