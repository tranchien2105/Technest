import { and, eq, gt, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../database/schema/index.js";
import { authSessions, users } from "../../database/schema/index.js";

type Database = NodePgDatabase<typeof schema>;

export function createAuthRepository(db: Database) {
  return {
    async findUserByEmail(email: string) {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return user;
    },
    async findUserById(id: number) {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return user;
    },
    async createUser(input: { email: string; passwordHash: string; fullName: string | null }) {
      const [user] = await db.insert(users).values(input).returning();
      return user;
    },
    async createSession(userId: number, tokenHash: string, expiresAt: Date) {
      await db.insert(authSessions).values({ userId, refreshTokenHash: tokenHash, expiresAt });
    },
    async rotateSession(oldHash: string, newHash: string, expiresAt: Date) {
      return db.transaction(async (tx) => {
        const [session] = await tx
          .select()
          .from(authSessions)
          .where(eq(authSessions.refreshTokenHash, oldHash))
          .for("update")
          .limit(1);
        if (!session) return { kind: "invalid" as const };
        if (session.revokedAt) {
          if (session.rotatedAt && Date.now() - session.rotatedAt.getTime() < 10_000) {
            return { kind: "concurrent" as const };
          }
          // A consumed refresh token used again indicates theft. Revoke every session.
          await tx
            .update(authSessions)
            .set({ revokedAt: new Date() })
            .where(and(eq(authSessions.userId, session.userId), isNull(authSessions.revokedAt)));
          return { kind: "reuse" as const };
        }
        if (session.expiresAt <= new Date()) return { kind: "invalid" as const };
        const [user] = await tx.select().from(users).where(eq(users.id, session.userId)).limit(1);
        if (!user || user.status !== "ACTIVE") {
          await tx
            .update(authSessions)
            .set({ revokedAt: new Date() })
            .where(and(eq(authSessions.id, session.id), isNull(authSessions.revokedAt)));
          return { kind: "blocked" as const };
        }
        await tx
          .update(authSessions)
          .set({ revokedAt: new Date(), rotatedAt: new Date() })
          .where(and(eq(authSessions.id, session.id), isNull(authSessions.revokedAt)));
        await tx.insert(authSessions).values({ userId: user.id, refreshTokenHash: newHash, expiresAt });
        return { kind: "ok" as const, user };
      });
    },
    async revokeSession(tokenHash: string) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(authSessions.refreshTokenHash, tokenHash),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
          ),
        );
    },
    async revokeAll(userId: number) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
