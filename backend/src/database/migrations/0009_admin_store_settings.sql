CREATE TABLE "store_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"store_name" varchar(120) DEFAULT 'Technest' NOT NULL,
	"support_email" varchar(320) DEFAULT 'support@technest.local' NOT NULL,
	"support_phone" varchar(30) DEFAULT '' NOT NULL,
	"standard_shipping_fee" bigint DEFAULT 30000 NOT NULL,
	"free_shipping_threshold" bigint DEFAULT 1000000 NOT NULL,
	"cod_enabled" boolean DEFAULT true NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
);
INSERT INTO "store_settings" ("id") VALUES (1);
