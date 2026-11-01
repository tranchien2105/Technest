ALTER TABLE store_banners ALTER COLUMN position DROP NOT NULL;
ALTER TABLE store_banners ALTER COLUMN position TYPE varchar(40);

-- Preserve the existing two hero cards while moving their content into the banner CMS.
INSERT INTO store_banners (title, subtitle, image_url, link, button_text, position, sort_order, active)
SELECT 'Bàn phím cơ · Best Seller', 'Hiệu năng cao • Góc cực đã',
  'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=500&q=85',
  '/products?category=keyboards', 'Khám phá ngay', 'HOME_HERO_RIGHT_TOP', 0, true
WHERE NOT EXISTS (SELECT 1 FROM store_banners WHERE position = 'HOME_HERO_RIGHT_TOP');

INSERT INTO store_banners (title, subtitle, image_url, link, button_text, position, sort_order, active)
SELECT 'Âm thanh đỉnh cao', 'Làm việc • Giải trí • Đa thiết bị',
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=500&q=85',
  '/products?category=audio', 'Khám phá ngay', 'HOME_HERO_RIGHT_BOTTOM', 0, true
WHERE NOT EXISTS (SELECT 1 FROM store_banners WHERE position = 'HOME_HERO_RIGHT_BOTTOM');
