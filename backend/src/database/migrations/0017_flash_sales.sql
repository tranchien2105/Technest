CREATE TYPE "flash_sale_campaign_status" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');
CREATE TYPE "flash_sale_reservation_status" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED');

CREATE TABLE "flash_sale_campaigns" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar(160) NOT NULL,
  "slug" varchar(180) NOT NULL UNIQUE,
  "description" text NOT NULL DEFAULT '',
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "status" "flash_sale_campaign_status" NOT NULL DEFAULT 'DRAFT',
  "created_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "flash_sale_campaign_dates_check" CHECK ("starts_at" < "ends_at")
);
CREATE INDEX "flash_sale_campaign_status_dates_idx" ON "flash_sale_campaigns" ("status", "starts_at", "ends_at");

CREATE TABLE "flash_sale_items" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "campaign_id" bigint NOT NULL REFERENCES "flash_sale_campaigns"("id") ON DELETE RESTRICT,
  "product_id" bigint NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "variant_id" bigint NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "original_price_snapshot" bigint NOT NULL,
  "flash_price" bigint NOT NULL,
  "quota" integer NOT NULL,
  "reserved_quantity" integer NOT NULL DEFAULT 0,
  "sold_quantity" integer NOT NULL DEFAULT 0,
  "per_customer_limit" integer NOT NULL DEFAULT 1,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "flash_sale_items_price_check" CHECK ("flash_price" > 0 AND "flash_price" < "original_price_snapshot"),
  CONSTRAINT "flash_sale_items_quota_check" CHECK ("quota" >= 0 AND "reserved_quantity" >= 0 AND "sold_quantity" >= 0 AND "reserved_quantity" + "sold_quantity" <= "quota"),
  CONSTRAINT "flash_sale_items_limit_check" CHECK ("per_customer_limit" > 0)
);
CREATE UNIQUE INDEX "flash_sale_items_campaign_variant_idx" ON "flash_sale_items" ("campaign_id", "variant_id");
CREATE INDEX "flash_sale_items_variant_idx" ON "flash_sale_items" ("variant_id");

CREATE TABLE "flash_sale_reservations" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "flash_sale_item_id" bigint NOT NULL REFERENCES "flash_sale_items"("id") ON DELETE RESTRICT,
  "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "order_id" bigint REFERENCES "orders"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL CHECK ("quantity" > 0),
  "status" "flash_sale_reservation_status" NOT NULL DEFAULT 'RESERVED',
  "expires_at" timestamp with time zone NOT NULL,
  "idempotency_key" varchar(160) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "flash_sale_reservation_user_key_idx" ON "flash_sale_reservations" ("user_id", "idempotency_key");
CREATE INDEX "flash_sale_reservation_item_user_idx" ON "flash_sale_reservations" ("flash_sale_item_id", "user_id", "status");
CREATE INDEX "flash_sale_reservation_expiry_idx" ON "flash_sale_reservations" ("status", "expires_at");

ALTER TABLE "order_items" ADD COLUMN "flash_sale_campaign_id" bigint REFERENCES "flash_sale_campaigns"("id") ON DELETE RESTRICT;
ALTER TABLE "order_items" ADD COLUMN "flash_sale_item_id" bigint REFERENCES "flash_sale_items"("id") ON DELETE RESTRICT;
ALTER TABLE "order_items" ADD COLUMN "flash_sale_original_price" bigint;
ALTER TABLE "order_items" ADD COLUMN "flash_sale_discount_amount" bigint;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_flash_sale_snapshot_check" CHECK (
  ("flash_sale_item_id" IS NULL AND "flash_sale_campaign_id" IS NULL AND "flash_sale_original_price" IS NULL AND "flash_sale_discount_amount" IS NULL)
  OR ("flash_sale_item_id" IS NOT NULL AND "flash_sale_campaign_id" IS NOT NULL AND "flash_sale_original_price" > "unit_price" AND "flash_sale_discount_amount" > 0)
);

UPDATE "homepage_cms"
SET "draft" = jsonb_set(
      jsonb_set("draft", '{sections,flash-sale}', '{"visible":true,"title":"Flash Sale","description":"","ctaLabel":"Xem tất cả","ctaUrl":"/flash-sale","limit":4}'::jsonb, true),
      '{sectionOrder}', ("draft" -> 'sectionOrder') || '["flash-sale"]'::jsonb, true),
    "published" = jsonb_set(
      jsonb_set("published", '{sections,flash-sale}', '{"visible":true,"title":"Flash Sale","description":"","ctaLabel":"Xem tất cả","ctaUrl":"/flash-sale","limit":4}'::jsonb, true),
      '{sectionOrder}', ("published" -> 'sectionOrder') || '["flash-sale"]'::jsonb, true),
    "updated_at" = now()
WHERE "id" = 1;
