# Database seeding recovery and progress

Last updated: 2026-10-31

## Recovery audit

- Repository: `/home/minhchien/project/technest`; numerous existing modified and untracked files are present. None were reset or discarded.
- Development runtime: Vite on port 5173, two backend `tsx watch` processes, and Docker Compose PostgreSQL/Redis/Mailpit are running.
- Database identity: PostgreSQL 16, database `technest_dev`, `NODE_ENV=development`. No production connection was used.
- Migration history: 8 Drizzle migrations are recorded in schema `drizzle`; the current schema includes catalog, variants, images, inventory, accounts, email outbox, and orders. No migration was run during audit.
- Existing DB counts: 5 categories, 19 brands, 50 products, 50 variants, 50 product images, 50 inventory rows, 1 user, 6 orders, 9 order items, 14 order status history rows.
- Existing catalog seed: 50 curated products, 10 per each of keyboards, mice, monitors, audio, and accessories. All have name/brand/category/description/image; 39 unique external Unsplash URLs. Seed currently makes one SKU and one image per product and does not create orders/users.
- Product image storage: external URLs in `product_images`; only two generic SVGs exist in `public/images`. There is no object-storage/image-proxy integration.
- Frontend build and tests: passed (4 suites); Vite reports the main JS chunk exceeds 500 kB.
- Backend build: passed. Tests initially could not bind loopback under sandbox; rerun with local permission passed (44 passed, 2 skipped).
- Docker PostgreSQL, Redis, and Mailpit health: healthy. The container-local DB query verified migration versions and counts. Direct sandbox loopback HTTP/DB probes are restricted.

## Status before implementation

| Area | Status | Evidence / gap |
|---|---|---|
| Catalog schema and migrations | COMPLETED | Product/category/brand/variant/image/inventory schemas and 8 migrations exist and DB is migrated. |
| Current 50-product catalog seed | PARTIAL | Seed runs idempotently but only supplies one SKU and one image per product; no technical attributes. |
| Image coverage and URL health | UNVERIFIED | Current URLs are external and not yet availability-checked; local repository has no product photos. |
| Product detail data | PARTIAL | `attributes` JSONB is supported but current seed leaves it empty. |
| Users/orders large seed | MISSING | DB has one user and six existing orders; no synthetic large data seeder. |
| Data-quality and image check scripts | MISSING | No scripts found in source. |
| Storefront/Admin display of seeded product data | PARTIAL | Catalog API and product detail payload were verified; product detail now renders category specifications/variants and clearly labels development illustrations. Builds pass, but no browser automation/visual check was available for every storefront/Admin screen. |

## Plan and safety

- Keep generated records clearly development-only, deterministic, resumable, and insert/upsert-only; never delete existing records.
- Preserve the 50 curated products and their current business data. Add category-specific local illustrative artwork only where licensed/repository product imagery is unavailable; mark it as illustration in alt text.
- Use bounded batches and stable slugs/SKUs/order numbers so reruns do not duplicate records.
- Do not run migrations or point scripts at production. Before any DB write, assert development environment and `technest_dev` database identity.

## Implementation checkpoints

- [x] Add safe catalog/order fixture generator and local category illustrations.
- [x] Add bounded image availability checker and database quality validator.
- [x] Run generator against the local development database and record actual counts.
- [x] Run data integrity checks, API tests, and frontend/backend builds.
- [x] Record remaining limitations (especially synthetic illustration vs official product photography).

## Implementation update

- Added an additive `parent_category_id` schema/migration entry so five storefront categories can contain 55 browseable subcategories without flooding the global navigation. Migration has not yet been applied.
- Product list category filtering now recognizes both a root category and its direct children; the product filter UI renders child options under their parent.

## Seed execution and verification

- Applied additive migration `0008_category_hierarchy` to local `technest_dev`; no destructive migration or production DB was used.
- Seed command: `npm run db:seed:large`. It can be rerun safely and has been rerun after normalizing fixture names/specs; stable keys prevented duplicate records.
- Final DB counts: 60 categories (5 roots + 55 children), 50 brands (all 50 used by active products), 5,000 active products, 10,000 active variants/SKUs, 15,000 product image rows (3 per product), 10,000 inventory rows, 120 development customers, 121 addresses, 2,006 total orders (2,000 seeded + 6 pre-existing), 5,009 total order items (5,000 seeded + 9 pre-existing), 5,678 status history rows, 4,183 inventory movements, 2,511 inventory reservations.
- Image checker: 5,000/5,000 active products have a thumbnail; 15,000 image rows; 213 distinct URLs checked; 213 valid, 0 broken. Three Unsplash URLs returned 404 and were replaced with matching local category illustrations. Current rows include 14,953 local illustrative SVG image records and 47 working Unsplash photo records.
- Image source limitation: no licensed manufacturer product feed or repository photo library is configured. The generated records and local category illustrations are clearly labelled development illustrations and must not be presented as official product photography or real SKUs. The 47 external photos originate from the existing seed and Unsplash; the other image slots reuse 180 locally generated category/view SVG assets.
- Data-quality validator: all thresholds met; zero missing brand/category, descriptions, technical specs, thumbnails, images outside 2–5 per product, products with fewer than two active variants, missing SKU price/inventory, duplicate SKU/slug, invalid order snapshots/totals/FKs, stock balance, or active reservation mismatches. It also filled `image_url` on 8 pre-existing order items that had null snapshots.
- API spot checks: `/api/v1/categories` returns the five roots with children; root filter `keyboards` returns 1,000 products; child filter `mechanical` returns 90; product detail returns 3 images, 2 priced variants, specs, and stock; `/api/v1/brands` returns 50 brands. Frontend and API local servers responded successfully.
- Frontend lint/build/tests: pass (4 test suites). Vite still warns that the main JS chunk is over 500 kB.
- Backend lint/typecheck/build: pass. Final API tests pass (44 passed, 2 skipped; loopback permission required).
- Visual browser automation was unavailable; local FE/API HTTP and API payload spot checks passed. A screenshot-level review across all storefront/Admin routes remains unverified.
- Requested Windows speech notification was attempted once; WSL reported `UtilBindVsockAnyPort` and could not reach the Windows PowerShell bridge.

## Development-only login

Seeded customer emails use `catalog.customer.001@technest.example` through `catalog.customer.120@technest.example`; their shared local test password is `TechnestDemo!2026`. The seed aborts unless `NODE_ENV=development` and the database name is exactly `technest_dev`.
