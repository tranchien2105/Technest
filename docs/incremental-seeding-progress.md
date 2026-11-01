# Incremental development seeding — progress

## Phase 1: source/database audit

- Audited Drizzle schema, migrations `0000`–`0011`, foreign keys, indexes, enums, seed scripts, Express routes and Admin pages.
- Development database verified as `technest_dev`; no reset or migration was run.
- Existing catalog seed already targets 5,000 products and 50 brands / 60 categories; existing large seed already targets 120 customers and 2,000 orders. Integrity checker currently reports these targets met.
- Admin business tables found include `store_banners`, `vouchers`, `voucher_redemptions`, `after_sales_requests`, catalog, inventory, orders and account data. No Promotions/Campaigns module or payment module exists; discounts are represented by vouchers.
- Admin APIs are mounted for dashboard, products, categories, brands, inventory, customers, orders, banners, vouchers, after-sales, imports/exports, reports, staff, audit, email outbox and settings.
- PostgreSQL reports 32 CHECK, 31 FK, 24 PK and 16 unique constraints plus 73 indexes and 10 enums.
- Current schema includes database-managed account/security/order/catalog/inventory/notification enums; no Promotions or Payments tables/routes were found.
- Initial table counts: `store_banners=0`, `vouchers=1`, `voucher_redemptions=1`, `after_sales_requests=0`, `products=5000`, `brands=50`, `categories=60`, `users=121` (120 customers), `orders=2007`, `order_items=5010`, `product_variants=10000`, `product_images=15000`, `inventories=10000`, `inventory_movements=4190`, `inventory_reservations=2512`, `order_inventory_reservations=2512`, `user_addresses=121`, `notifications=0`, `admin_audit_logs=25`, `admin_operations=0`, `catalog_imports=0`, `store_settings=1`, `auth_sessions=160`, `order_email_outbox=22`.
- The existing `db:check:data` reported no catalog/order/inventory integrity violations before this phase.

## Phase 2: incremental seed

- Added an incremental seeder restricted to `NODE_ENV=development` and `technest_dev`, with a stable batch ID (`dev26a` by default), conflict-safe voucher codes, deterministic banner selection and idempotent after-sales selection. No destructive SQL is present.
- Planned seed rows: 100 banners (only 12 currently active; future/expired/inactive coverage), 100 vouchers (active/upcoming/expired/disabled and exhausted examples tied to five actual development orders), 5 pending order fixtures with matching reservation/redemption/history, and 100 after-sales requests tied to shipped/delivered order items.
- Seeded batch `DEV26A`: +100 banners, +100 vouchers, +5 pending coupon orders with real SKU snapshots/reservations/status history/redemptions, and +100 after-sales requests linked to shipped/delivered order items.
- Re-ran `DEV26A`: +0 banners, +0 orders, +0 after-sales; voucher count remained at its 100 batch rows. This confirms same-batch resume/idempotency.
- The seed script creates no customers or passwords, sends no email/notifications, and does not change or delete pre-existing rows. It reserves five units across five SKUs to keep exhausted coupon examples consistent with real usage records.

## Phase 3–8: validation

- `npm run db:seed:verify` passed: 12 banners are currently public and the API caps output at 30. Catalog references, primary images, variants/inventory, order totals/items, voucher/redemption counts, after-sales ownership/quantities, image/variant links, inventory balances and active reservations all passed.
- The existing `npm run db:check:data` also passed after seeding with zero violations.
- GET-only API smoke checks returned HTTP 200 for health, storefront banners/products, dashboard, admin products/categories/brands/inventory/orders/customers/banners/vouchers/after-sales. Pagination and filters returned matching non-empty totals.
- Checkout preview accepted an active voucher and rejected an expired voucher and an exhausted voucher with HTTP 409. Preview did not create orders/redemptions.
- Backend typecheck/build/lint passed. Backend tests passed: 54 passed, 10 skipped. First test attempt hit sandbox `listen EPERM`; rerun with loopback permission passed.
- Frontend lint/build/tests passed; all 6 frontend test files passed. Vite reports the existing main JS chunk is larger than 500 kB. No browser automation was available, so no visual UI test is claimed.

## Audited table counts

Counts captured immediately before seeding and during final verification. The development app/database was active concurrently; runtime session, audit, notification, email-outbox, inventory-movement and order-history counts changed outside the seeder. It does not import or write `auth_sessions`, `admin_audit_logs`, `notifications` or `order_email_outbox`.

| Table                          | Before | Added by batch |        After | Status                                                     |
| ------------------------------ | -----: | -------------: | -----------: | ---------------------------------------------------------- |
| `admin_audit_logs`             |     25 |              0 |           28 | Three rows appeared during concurrent app activity         |
| `admin_operations`             |      0 |              0 |            0 | Idempotency records are runtime data                       |
| `after_sales_requests`         |      0 |            100 |          100 | Seeded, linked to shipped/delivered items                  |
| `auth_sessions`                |    160 |              0 |          186 | Runtime sessions changed concurrently; not seeded          |
| `brands`                       |     50 |              0 |           50 | Already has broad catalog coverage                         |
| `catalog_imports`              |      0 |              0 |            0 | No import jobs were run                                    |
| `categories`                   |     60 |              0 |           60 | Already has hierarchy and coverage                         |
| `inventories`                  | 10,000 |              0 |       10,000 | Existing SKU inventory retained                            |
| `inventory_movements`          |  4,190 |              5 |        4,196 | Five seeded movements; one concurrent movement observed   |
| `inventory_reservations`       |  2,512 |              5 |        2,517 | Five valid order reservations                              |
| `notifications`                |      0 |              0 |            3 | Appeared during concurrent app activity; not seeded       |
| `order_email_outbox`           |     22 |              0 |           25 | Three events appeared concurrently; not seeded            |
| `order_inventory_reservations` |  2,512 |              5 |        2,517 | Linked to five order reservations                          |
| `order_items`                  |  5,010 |              5 |        5,015 | Product/SKU/price snapshots                                |
| `order_status_history`         |  5,687 |              5 |        5,695 | Five seed entries; three concurrent updates observed      |
| `orders`                       |  2,007 |              5 |        2,012 | Pending orders backing exhausted codes                     |
| `product_images`               | 15,000 |              0 |       15,000 | Existing catalog images reused by banners                  |
| `product_variants`             | 10,000 |              0 |       10,000 | Existing variants retained                                 |
| `products`                     |  5,000 |              0 |        5,000 | Already meets high-volume Admin coverage                   |
| `store_banners`                |      0 |            100 |          100 | 12 current, 6 upcoming, 6 expired, 76 inactive             |
| `store_settings`               |      1 |              0 |            1 | Singleton configuration                                    |
| `user_addresses`               |    121 |              0 |          121 | Existing customer addresses retained                       |
| `users`                        |    121 |              0 |          121 | 120 customers + existing admin; no new accounts            |
| `voucher_redemptions`          |      1 |              5 |            6 | Five consumed-code records tied to fixture orders          |
| `vouchers`                     |      1 |            100 |          101 | Valid, upcoming, expired, disabled and exhausted scenarios |

Total added by batch: 335 rows across 10 tables. Products, categories, brands, users and orders already exceed the requested test-volume threshold; no extra rows were added there to avoid low-value catalog/customer noise. No Promotions/Campaigns, Payment, Wishlist, Reviews, or Banner placement table exists in current schema, so those were not fabricated.

## Remaining/known limitations

- Admin/storefront APIs and filtering were smoke-tested over HTTP, but CRUD actions and visual rendering were not automated in a browser. Existing Admin UI exposes list/form routes for banner/voucher/after-sales and catalog/order/inventory modules.
- The five seeded coupon orders intentionally have no email outbox entries and no notification rows, to avoid generated email/notification delivery for test fixtures.
- Product images for banners reuse each active product's existing primary image URL; external image-host availability was not independently probed.
- No campaign/product/category/brand promotion relation exists; only voucher-based discounts are seeded and checkout-tested.
- Windows audio notification was attempted once with `powershell.exe`; WSL returned `UtilBindVsockAnyPort:307: socket failed 1`, so sound could not be played.

## Known constraints

- User-facing `GET /api/v1/banners` returns at most 30 active, currently scheduled banners; seeded inactive/upcoming/expired records must not leak into the storefront.
- Seed scripts must be restricted to `NODE_ENV=development` and database `technest_dev`.
- Do not write to or truncate existing business rows.
- The seed's write paths insert fixture rows; `auth_sessions` showed concurrent count increases from 160 to 168 while the development app was running, unrelated to the seed scripts.
