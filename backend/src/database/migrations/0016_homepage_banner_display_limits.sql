-- Keep the first promotional strip compact and the lower banner row at six cards.
-- This changes display limits only; no banner records or assignments are removed.
UPDATE homepage_cms
SET
  draft = jsonb_set(
    jsonb_set(draft, '{sections,promotional-banners,limit}', '3'::jsonb, true),
    '{sections,bottom-banners,limit}', '6'::jsonb, true
  ),
  published = jsonb_set(
    jsonb_set(published, '{sections,promotional-banners,limit}', '3'::jsonb, true),
    '{sections,bottom-banners,limit}', '6'::jsonb, true
  ),
  updated_at = now()
WHERE id = 1;
