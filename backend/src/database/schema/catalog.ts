import {
  boolean,
  bigint,
  integer,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { categories } from "./categories.js";

export const catalogStatus = pgEnum("catalog_status", ["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const brands = pgTable("brands", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable(
  "products",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    name: varchar("name", { length: 220 }).notNull(),
    description: text("description").notNull().default(""),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    brandId: bigint("brand_id", { mode: "bigint" })
      .notNull()
      .references(() => brands.id),
    price: numeric("price", { precision: 20, scale: 0 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 20, scale: 0 }),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    badge: varchar("badge", { length: 24 }),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredRank: integer("featured_rank"),
    isTrending: boolean("is_trending").notNull().default(false),
    trendingRank: integer("trending_rank"),
    compatibleWith: jsonb("compatible_with").$type<string[]>().notNull().default([]),
    status: catalogStatus("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("products_category_status_idx").on(table.categoryId, table.status),
    index("products_brand_status_idx").on(table.brandId, table.status),
    index("products_created_at_idx").on(table.createdAt),
    index("products_featured_idx").on(table.featuredRank),
    index("products_trending_idx").on(table.trendingRank),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    productId: bigint("product_id", { mode: "bigint" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    price: numeric("price", { precision: 20, scale: 0 }),
    compareAtPrice: numeric("compare_at_price", { precision: 20, scale: 0 }),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    status: catalogStatus("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("product_variants_product_status_idx").on(table.productId, table.status)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    productId: bigint("product_id", { mode: "bigint" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: bigint("variant_id", { mode: "bigint" }).references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    url: text("url").notNull(),
    altText: varchar("alt_text", { length: 220 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("product_images_product_sort_idx").on(table.productId, table.sortOrder)],
);
