import { and, eq, gt, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
const { users, authSessions, passwordResetTokens: tokens } = schema;

export function createPasswordResetRepository(db: NodePgDatabase<typeof schema>) {
  return {
    async issue(email: string, tokenHash: string, expiresAt: Date) {
      return db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.email, email))
          .for("update")
          .limit(1);
        if (!user || user.status !== "ACTIVE") return null;
        // Serialize issuance and consumption on the user, including simultaneous requests.
        await tx.delete(tokens).where(eq(tokens.userId, user.id));
        await tx.insert(tokens).values({ userId: user.id, tokenHash, expiresAt });
        return { email: user.email };
      });
    },
    async consume(tokenHash: string, passwordHash: string) {
      return db.transaction(async (tx) => {
        const [candidate] = await tx
          .select({ userId: tokens.userId })
          .from(tokens)
          .where(eq(tokens.tokenHash, tokenHash))
          .limit(1);
        if (!candidate) return null;
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, candidate.userId))
          .for("update")
          .limit(1);
        if (!user || user.status !== "ACTIVE") return null;
        const now = new Date();
        const [token] = await tx
          .update(tokens)
          .set({ usedAt: now })
          .where(
            and(eq(tokens.tokenHash, tokenHash), isNull(tokens.usedAt), gt(tokens.expiresAt, now)),
          )
          .returning({ id: tokens.id });
        if (!token) return null;
        await tx
          .update(users)
          .set({ passwordHash, passwordResetAt: now, updatedAt: now })
          .where(eq(users.id, user.id));
        await tx
          .update(authSessions)
          .set({ revokedAt: now })
          .where(and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt)));
        await tx
          .update(tokens)
          .set({ usedAt: now })
          .where(and(eq(tokens.userId, user.id), isNull(tokens.usedAt)));
        return { email: user.email };
      });
    },
  };
}
export type PasswordResetRepository = ReturnType<typeof createPasswordResetRepository>;
