import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import type { SafeUser } from "../auth/auth.service.js";

export function auditDetails(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const allowed = [
    "name",
    "title",
    "status",
    "type",
    "code",
    "categoryId",
    "brandId",
    "price",
    "quantity",
    "newQuantity",
    "ids",
    "action",
    "permissions",
    "resolution",
    "refundAmount",
    "restock",
  ];
  return Object.fromEntries(
    Object.entries(body)
      .filter(([key]) => allowed.includes(key))
      .map(([key, value]) => [key, Array.isArray(value) ? value.slice(0, 500) : value]),
  );
}
export function adminAudit(db: NodePgDatabase<typeof schema>): RequestHandler {
  return async (request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    try {
      const user = response.locals.user as SafeUser;
      const [row] = await db
        .insert(schema.auditLogs)
        .values({
          actorId: user.id,
          actorEmail: user.email,
          action: request.method,
          resource: request.originalUrl.split("?")[0]!.slice(0, 240),
          requestId: String(request.id || ""),
          details: auditDetails(request.body),
        })
        .returning({ id: schema.auditLogs.id });
      response.on("finish", () => {
        if (row)
          void db
            .update(schema.auditLogs)
            .set({ statusCode: response.statusCode })
            .where(eq(schema.auditLogs.id, row.id))
            .catch(() => {});
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}
