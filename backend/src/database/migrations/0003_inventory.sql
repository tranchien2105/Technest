CREATE TYPE "inventory_movement_type" AS ENUM ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'RESERVE', 'RELEASE');
CREATE TYPE "inventory_reservation_status" AS ENUM ('ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED');

CREATE TABLE "inventories" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "variant_id" bigint NOT NULL UNIQUE REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "on_hand" integer DEFAULT 0 NOT NULL,
  "reserved" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventories_on_hand_nonnegative_check" CHECK ("on_hand" >= 0),
  CONSTRAINT "inventories_reserved_nonnegative_check" CHECK ("reserved" >= 0),
  CONSTRAINT "inventories_reserved_lte_on_hand_check" CHECK ("reserved" <= "on_hand")
);

CREATE TABLE "inventory_movements" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "variant_id" bigint NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "type" "inventory_movement_type" NOT NULL,
  "quantity" integer NOT NULL,
  "reference_type" text,
  "reference_id" text,
  "idempotency_key" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_movements_quantity_check" CHECK (
    ("type" = 'ADJUSTMENT' AND "quantity" <> 0) OR
    ("type" <> 'ADJUSTMENT' AND "quantity" > 0)
  )
);
CREATE INDEX "inventory_movements_variant_created_idx" ON "inventory_movements" ("variant_id", "created_at");
CREATE INDEX "inventory_movements_reference_idx" ON "inventory_movements" ("reference_type", "reference_id");
CREATE UNIQUE INDEX "inventory_movements_variant_idempotency_idx"
  ON "inventory_movements" ("variant_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;

CREATE TABLE "inventory_reservations" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "variant_id" bigint NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL,
  "status" "inventory_reservation_status" DEFAULT 'ACTIVE' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "reference_type" text NOT NULL,
  "reference_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_reservations_quantity_positive_check" CHECK ("quantity" > 0)
);
CREATE INDEX "inventory_reservations_expiry_idx" ON "inventory_reservations" ("status", "expires_at");
CREATE INDEX "inventory_reservations_variant_status_idx" ON "inventory_reservations" ("variant_id", "status");
CREATE INDEX "inventory_reservations_reference_idx" ON "inventory_reservations" ("reference_type", "reference_id");
