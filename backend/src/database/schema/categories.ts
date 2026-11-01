import { pgTable, timestamp, uuid, varchar, type AnyPgColumn } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }).notNull().default(""),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  parentCategoryId: uuid("parent_category_id").references((): AnyPgColumn => categories.id, {
    onDelete: "restrict",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
