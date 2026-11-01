-- Correct the seeded Laptop Stand image and banners generated from that product.
-- This is intentionally scoped to the known old image URL and preserves all rows.
UPDATE product_images AS image
SET url = replace(
  image.url,
  'photo-1527864550417-7fd91fc51a46',
  'photo-1658869402195-9f0ea192ecd5'
)
FROM products AS product
WHERE image.product_id = product.id
  AND product.name = 'Aluminium Laptop Stand'
  AND image.sort_order = 0
  AND image.url LIKE '%photo-1527864550417-7fd91fc51a46%';

UPDATE store_banners
SET image_url = replace(
      image_url,
      'photo-1527864550417-7fd91fc51a46',
      'photo-1658869402195-9f0ea192ecd5'
    ),
    updated_at = now()
WHERE image_url LIKE '%photo-1527864550417-7fd91fc51a46%';
