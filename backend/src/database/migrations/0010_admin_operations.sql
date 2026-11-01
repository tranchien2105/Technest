ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'STAFF';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_code varchar(40);
ALTER TABLE order_email_outbox ADD COLUMN IF NOT EXISTS retry_of_id bigint REFERENCES order_email_outbox(id);
CREATE INDEX IF NOT EXISTS order_email_retry_idx ON order_email_outbox(retry_of_id, created_at);
CREATE TABLE IF NOT EXISTS admin_audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id bigint REFERENCES users(id) ON DELETE SET NULL,
 actor_email varchar(320) NOT NULL, action varchar(20) NOT NULL, resource varchar(240) NOT NULL,
 request_id varchar(100), details jsonb NOT NULL DEFAULT '{}', status_code integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_logs(created_at);
CREATE TABLE IF NOT EXISTS store_banners (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title varchar(160) NOT NULL, subtitle text NOT NULL DEFAULT '', image_url text NOT NULL,
 link varchar(500) NOT NULL, button_text varchar(60) NOT NULL DEFAULT 'Khám phá ngay', position varchar(30) NOT NULL DEFAULT 'HOME_PROMO',
 sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true, starts_at timestamptz, ends_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS vouchers (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(40) NOT NULL UNIQUE, name varchar(160) NOT NULL,
 type varchar(12) NOT NULL CHECK (type IN ('FIXED','PERCENT')), value bigint NOT NULL CHECK(value>0), min_subtotal bigint NOT NULL DEFAULT 0 CHECK(min_subtotal>=0),
 max_discount bigint CHECK(max_discount>0), usage_limit integer NOT NULL CHECK(usage_limit>0), per_user_limit integer NOT NULL DEFAULT 1 CHECK(per_user_limit>0),
 used_count integer NOT NULL DEFAULT 0 CHECK(used_count>=0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at), CHECK(type <> 'PERCENT' OR value<=100), CHECK(used_count<=usage_limit)
);
CREATE TABLE IF NOT EXISTS voucher_redemptions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, voucher_id bigint NOT NULL REFERENCES vouchers(id), user_id bigint NOT NULL REFERENCES users(id),
 order_id bigint NOT NULL UNIQUE REFERENCES orders(id), discount bigint NOT NULL CHECK(discount>=0), released_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voucher_redemptions_user_idx ON voucher_redemptions(voucher_id,user_id);
CREATE TABLE IF NOT EXISTS after_sales_requests (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id bigint NOT NULL REFERENCES orders(id), item_id bigint NOT NULL REFERENCES order_items(id), user_id bigint NOT NULL REFERENCES users(id),
 type varchar(12) NOT NULL CHECK(type IN ('RETURN','WARRANTY')), quantity integer NOT NULL CHECK(quantity>0), reason text NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','APPROVED','RECEIVED','RESOLVED','REJECTED')),
 admin_note text NOT NULL DEFAULT '', resolution varchar(20), refund_amount bigint NOT NULL DEFAULT 0 CHECK(refund_amount>=0), restocked_at timestamptz, resolved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS after_sales_created_idx ON after_sales_requests(created_at);
CREATE TABLE IF NOT EXISTS catalog_imports (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id bigint NOT NULL REFERENCES users(id), filename varchar(240) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'PREVIEW', rows jsonb NOT NULL, cursor integer NOT NULL DEFAULT 0, total integer NOT NULL,
 lease_until timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_operations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id bigint NOT NULL REFERENCES users(id), key varchar(160) NOT NULL, hash varchar(64) NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT admin_operations_actor_key_unique UNIQUE(actor_id,key)
);
