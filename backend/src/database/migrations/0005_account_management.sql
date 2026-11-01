ALTER TABLE "users" ADD COLUMN "phone" varchar(30);

CREATE TABLE "user_addresses" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recipient_name" varchar(200) NOT NULL,
  "phone" varchar(30) NOT NULL,
  "address_line" text NOT NULL,
  "city" varchar(120) NOT NULL,
  "district" varchar(120),
  "ward" varchar(120),
  "label" varchar(60),
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses" ("user_id");
CREATE INDEX "user_addresses_user_created_idx" ON "user_addresses" ("user_id", "created_at");
CREATE UNIQUE INDEX "user_addresses_one_default_per_user_idx"
  ON "user_addresses" ("user_id") WHERE "is_default" = true;
