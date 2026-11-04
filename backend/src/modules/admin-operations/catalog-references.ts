import { and, asc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { brands, categories } from "../../database/schema/index.js";
import type { Database } from "./common.js";

export const referenceQuery = z.object({
  type: z.enum(["brands", "categories"]).default("brands"),
  q: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  id: z.string().max(100).optional(),
}).superRefine((input, ctx) => {
  if (!input.id) return;
  const valid = input.type === "brands"
    ? /^[1-9][0-9]{0,18}$/.test(input.id) && BigInt(input.id) <= 9_223_372_036_854_775_807n
    : z.uuid().safeParse(input.id).success;
  if (!valid) ctx.addIssue({ code: "custom", path: ["id"], message: "ID không hợp lệ." });
});

export async function catalogReferences(db: Database, input: z.infer<typeof referenceQuery>) {
  const rows = input.type === "brands"
    ? await db.select({ id: brands.id, name: brands.name }).from(brands)
      .where(and(input.id ? eq(brands.id, BigInt(input.id)) : undefined,
        input.q ? or(ilike(brands.name, `%${input.q}%`), ilike(brands.slug, `%${input.q}%`)) : undefined))
      .orderBy(asc(brands.name), asc(brands.id)).limit(input.limit + 1)
    : await db.select({ id: categories.id, name: categories.name }).from(categories)
      .where(and(input.id ? eq(categories.id, input.id) : undefined,
        input.q ? or(ilike(categories.name, `%${input.q}%`), ilike(categories.slug, `%${input.q}%`)) : undefined))
      .orderBy(asc(categories.name), asc(categories.id)).limit(input.limit + 1);
  return { items: rows.slice(0, input.limit).map((row) => ({ ...row, id: String(row.id) })), hasMore: rows.length > input.limit };
}
