import { bigint, integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const homepageCms = pgTable("homepage_cms", {
  id: integer("id").primaryKey().default(1),
  draft: jsonb("draft").notNull(),
  published: jsonb("published").notNull(),
  updatedBy: bigint("updated_by", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});
