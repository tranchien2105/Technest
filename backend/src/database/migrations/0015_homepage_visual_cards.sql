-- Add editable content for the three existing inspiration cards and feature banner.
-- Preserve values already customized in either draft or published configuration.
UPDATE homepage_cms
SET
  draft = jsonb_set(
    jsonb_set(
      draft,
      '{sections,style,cards}',
      '[
        {"key":"work","eyebrow":"01 / WORK","title":"Góc làm việc tối giản","titleEn":"A calmer workspace","description":"Sắp xếp góc bàn gọn gàng, tập trung cho công việc mỗi ngày.","descriptionEn":"Create a tidy desk that helps you focus through the workday.","imageUrl":"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85","categorySlug":"accessories"},
        {"key":"gaming","eyebrow":"02 / PLAY","title":"Góc gaming nổi bật","titleEn":"A standout gaming setup","description":"Chọn thiết bị phù hợp cho những giờ giải trí của bạn.","descriptionEn":"Find the right gear for your time away from work.","imageUrl":"https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=85","categorySlug":"keyboards"},
        {"key":"audio","eyebrow":"03 / LISTEN","title":"Không gian âm thanh","titleEn":"A personal sound space","description":"Khám phá tai nghe và loa cho không gian nghe riêng.","descriptionEn":"Explore headphones and speakers for your own listening space.","imageUrl":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85","categorySlug":"audio"}
      ]'::jsonb,
      true
    ),
    '{sections,feature-banner,imageUrl}',
    '"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1100&q=85"'::jsonb,
    true
  ),
  published = jsonb_set(
    jsonb_set(
      published,
      '{sections,style,cards}',
      '[
        {"key":"work","eyebrow":"01 / WORK","title":"Góc làm việc tối giản","titleEn":"A calmer workspace","description":"Sắp xếp góc bàn gọn gàng, tập trung cho công việc mỗi ngày.","descriptionEn":"Create a tidy desk that helps you focus through the workday.","imageUrl":"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85","categorySlug":"accessories"},
        {"key":"gaming","eyebrow":"02 / PLAY","title":"Góc gaming nổi bật","titleEn":"A standout gaming setup","description":"Chọn thiết bị phù hợp cho những giờ giải trí của bạn.","descriptionEn":"Find the right gear for your time away from work.","imageUrl":"https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=85","categorySlug":"keyboards"},
        {"key":"audio","eyebrow":"03 / LISTEN","title":"Không gian âm thanh","titleEn":"A personal sound space","description":"Khám phá tai nghe và loa cho không gian nghe riêng.","descriptionEn":"Explore headphones and speakers for your own listening space.","imageUrl":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85","categorySlug":"audio"}
      ]'::jsonb,
      true
    ),
    '{sections,feature-banner,imageUrl}',
    '"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1100&q=85"'::jsonb,
    true
  ),
  updated_at = now()
WHERE id = 1
  AND (
    draft #> '{sections,style,cards}' IS NULL
    OR draft #> '{sections,feature-banner,imageUrl}' IS NULL
    OR published #> '{sections,style,cards}' IS NULL
    OR published #> '{sections,feature-banner,imageUrl}' IS NULL
  );
