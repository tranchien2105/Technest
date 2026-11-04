import { products } from "./catalog.js";
import {
  bigint,
  index,
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
export const seoMetadata = pgTable(
  "seo_metadata",
  {
    entityType: varchar("entity_type", { length: 24 }).notNull(),
    entityKey: varchar("entity_key", { length: 180 }).notNull(),
    title: varchar("title", { length: 160 }).notNull().default(""),
    description: varchar("description", { length: 500 }).notNull().default(""),
    socialImage: text("social_image").notNull().default(""),
    canonicalPath: varchar("canonical_path", { length: 300 }).notNull().default(""),
    noindex: boolean("noindex").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.entityType, table.entityKey] })],
);

export const seoProductRedirects = pgTable(
  "seo_product_redirects",
  {
    oldSlug: varchar("old_slug", { length: 180 }).primaryKey(),
    productId: bigint("product_id", { mode: "bigint" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("seo_product_redirects_product_idx").on(table.productId)],
);
