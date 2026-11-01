CREATE TYPE "public"."notification_type" AS ENUM('ORDER_STATUS_UPDATED', 'ORDER_CANCELLED', 'ORDER_DELIVERED', 'PROMOTION_AVAILABLE', 'PROMOTION_EXPIRING', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'ACCOUNT_UPDATED', 'ACCOUNT_LOCKED', 'SECURITY_ALERT', 'SYSTEM_ANNOUNCEMENT');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"recipient_user_id" bigint NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"entity_type" varchar(40),
	"entity_id" varchar(100),
	"target_url" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"event_key" varchar(200),
	"read_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_title_nonempty_check" CHECK (length(trim("title")) > 0),
	CONSTRAINT "notifications_message_nonempty_check" CHECK (length(trim("message")) > 0)
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_idx" ON "notifications" USING btree ("recipient_user_id", "read_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_event_key_unique_idx" ON "notifications" USING btree ("event_key") WHERE "event_key" IS NOT NULL;
