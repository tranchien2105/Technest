CREATE TABLE IF NOT EXISTS seo_metadata (
  entity_type varchar(24) NOT NULL CHECK (entity_type IN ('products','categories','brands','pages')),
  entity_key varchar(180) NOT NULL,
  title varchar(160) NOT NULL DEFAULT '',
  description varchar(500) NOT NULL DEFAULT '',
  social_image text NOT NULL DEFAULT '',
  canonical_path varchar(300) NOT NULL DEFAULT '',
  noindex boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(entity_type, entity_key)
);
