ALTER TABLE users ADD COLUMN password_reset_at timestamptz;
--> statement-breakpoint
CREATE TABLE password_reset_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
