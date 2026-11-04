CREATE INDEX IF NOT EXISTS products_status_created_id_idx ON products (status, created_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS brands_created_id_idx ON brands (created_at DESC, id DESC);
