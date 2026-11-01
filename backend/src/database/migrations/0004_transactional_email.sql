CREATE TYPE "public"."order_email_event_type" AS ENUM('ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED');
--> statement-breakpoint
CREATE TYPE "public"."order_email_outbox_status" AS ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED');
--> statement-breakpoint
CREATE TABLE "order_email_outbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_email_outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_key" varchar(255) NOT NULL,
	"event_type" "order_email_event_type" NOT NULL,
	"order_id" text NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"recipient_name" varchar(200),
	"payload" jsonb NOT NULL,
	"status" "order_email_outbox_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"enqueued_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_email_outbox_event_key_unique" UNIQUE("event_key"),
	CONSTRAINT "order_email_outbox_attempts_nonnegative_check" CHECK ("order_email_outbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "order_email_outbox_pending_idx" ON "order_email_outbox" USING btree ("status","enqueued_at","created_at");
--> statement-breakpoint
CREATE INDEX "order_email_outbox_order_idx" ON "order_email_outbox" USING btree ("order_id","created_at");
