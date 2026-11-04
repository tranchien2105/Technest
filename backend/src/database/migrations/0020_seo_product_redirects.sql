CREATE TABLE IF NOT EXISTS seo_product_redirects (
 old_slug varchar(180) PRIMARY KEY,
 product_id bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seo_product_redirects_product_idx ON seo_product_redirects(product_id);
