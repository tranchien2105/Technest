ALTER TABLE "categories"
  ADD COLUMN "parent_category_id" uuid REFERENCES "categories"("id") ON DELETE RESTRICT;

CREATE INDEX "categories_parent_category_idx" ON "categories" ("parent_category_id");
