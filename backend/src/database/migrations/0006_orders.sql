CREATE TYPE "order_status" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "order_payment_status" AS ENUM ('UNPAID', 'PAID');

CREATE TABLE "orders" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "order_number" varchar(40) NOT NULL UNIQUE,
  "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "idempotency_key" varchar(160),
  "request_hash" varchar(64) NOT NULL,
  "status" "order_status" NOT NULL DEFAULT 'PENDING',
  "payment_method" varchar(40) NOT NULL DEFAULT 'COD' CHECK ("payment_method" = 'COD'),
  "payment_status" "order_payment_status" NOT NULL DEFAULT 'UNPAID',
  "subtotal" bigint NOT NULL CHECK ("subtotal" >= 0),
  "shipping_fee" bigint NOT NULL CHECK ("shipping_fee" >= 0),
  "discount_amount" bigint NOT NULL DEFAULT 0 CHECK ("discount_amount" >= 0),
  "total_amount" bigint NOT NULL CHECK ("total_amount" >= 0),
  "shipping_full_name" varchar(200) NOT NULL,
  "shipping_phone" varchar(30) NOT NULL,
  "customer_email" varchar(320) NOT NULL,
  "shipping_address" text NOT NULL,
  "shipping_city" varchar(120) NOT NULL,
  "shipping_district" varchar(120),
  "shipping_ward" varchar(120),
  "customer_note" text,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("user_id", "idempotency_key")
);
CREATE INDEX "orders_user_created_idx" ON "orders" ("user_id", "created_at");
CREATE INDEX "orders_status_created_idx" ON "orders" ("status", "created_at");
CREATE INDEX "orders_order_number_idx" ON "orders" ("order_number");

CREATE TABLE "order_items" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "order_id" bigint NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "product_id" bigint NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "variant_id" bigint NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "sku" varchar(100) NOT NULL,
  "product_name" varchar(220) NOT NULL,
  "variant_name" varchar(180),
  "quantity" integer NOT NULL CHECK ("quantity" > 0),
  "unit_price" bigint NOT NULL CHECK ("unit_price" >= 0),
  "line_total" bigint NOT NULL CHECK ("line_total" >= 0),
  "image_url" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "order_items_order_idx" ON "order_items" ("order_id");
CREATE INDEX "order_items_variant_idx" ON "order_items" ("variant_id");

CREATE TABLE "order_status_history" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "order_id" bigint NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "from_status" "order_status",
  "to_status" "order_status" NOT NULL,
  "changed_by" bigint REFERENCES "users"("id") ON DELETE SET NULL,
  "note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "order_status_history_order_created_idx" ON "order_status_history" ("order_id", "created_at");

CREATE TABLE "order_inventory_reservations" (
  "order_id" bigint NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "reservation_id" bigint NOT NULL UNIQUE REFERENCES "inventory_reservations"("id") ON DELETE RESTRICT,
  UNIQUE ("order_id", "reservation_id")
);
