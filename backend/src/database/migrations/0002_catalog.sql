ALTER TABLE "categories" ADD COLUMN "name_en" varchar(100) DEFAULT '' NOT NULL;
UPDATE "categories" SET "name_en" = CASE "slug"
  WHEN 'keyboards' THEN 'Keyboards'
  WHEN 'mice' THEN 'Mice'
  WHEN 'monitors' THEN 'Monitors'
  WHEN 'audio' THEN 'Audio'
  WHEN 'accessories' THEN 'Accessories'
  ELSE "name"
END;

CREATE TYPE "catalog_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "brands" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar(120) NOT NULL UNIQUE,
  "slug" varchar(140) NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "products" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "slug" varchar(180) NOT NULL UNIQUE,
  "name" varchar(220) NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "category_id" uuid NOT NULL REFERENCES "categories"("id"),
  "brand_id" bigint NOT NULL REFERENCES "brands"("id"),
  "price" numeric(20, 0) NOT NULL,
  "compare_at_price" numeric(20, 0),
  "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "badge" varchar(24),
  "is_featured" boolean DEFAULT false NOT NULL,
  "featured_rank" integer,
  "is_trending" boolean DEFAULT false NOT NULL,
  "trending_rank" integer,
  "compatible_with" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "catalog_status" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "products_category_status_idx" ON "products" ("category_id", "status");
CREATE INDEX "products_brand_status_idx" ON "products" ("brand_id", "status");
CREATE INDEX "products_created_at_idx" ON "products" ("created_at");
CREATE INDEX "products_featured_idx" ON "products" ("featured_rank");
CREATE INDEX "products_trending_idx" ON "products" ("trending_rank");

CREATE TABLE "product_variants" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "product_id" bigint NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sku" varchar(100) NOT NULL UNIQUE,
  "name" varchar(180) NOT NULL,
  "price" numeric(20, 0),
  "compare_at_price" numeric(20, 0),
  "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "catalog_status" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "product_variants_product_status_idx" ON "product_variants" ("product_id", "status");

CREATE TABLE "product_images" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "product_id" bigint NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "variant_id" bigint REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "alt_text" varchar(220),
  "sort_order" integer DEFAULT 0 NOT NULL
);
CREATE INDEX "product_images_product_sort_idx" ON "product_images" ("product_id", "sort_order");
