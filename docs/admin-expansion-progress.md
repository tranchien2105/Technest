# Technest Admin expansion — 2026-10-31

Scope authorized: image upload, bulk product actions, Excel import/export, scheduled homepage banners, vouchers, advanced reports, staff permissions, audit logs, returns/warranty, order-email monitoring/retry. Preserve existing data and uncommitted changes; additive migrations only; no commit/push.

## Recovery checklist
- [x] Audit existing routes/schema/auth/inventory/email and Admin UI.
- [x] Additive schema and dependencies.
- [x] Backend modules and RBAC/audit integration.
- [x] Upload/gallery and bulk products.
- [x] Excel import/export with validation/preview.
- [x] Banner management + homepage integration.
- [x] Voucher management + checkout integration.
- [x] Reports.
- [x] Staff permission management.
- [x] Audit viewer.
- [x] Returns/warranty workflow.
- [x] Email outbox monitoring/retry.
- [x] Tests, migration, live checks, responsive checks.
- [x] FE/BE dev running and completion notification.

Notification: Windows PowerShell works outside sandbox. Completion speech + Windows balloon will be attempted after verification.

Backend and frontend for all ten tools implemented and verified. Database migration 0010 applied successfully (additive only). Found and fixed an existing checkout/outbox error with local catalog image paths; this previously rejected seeded product orders.

Verification so far: Backend 54 passed / 8 optional tests skipped, including the new PostgreSQL rollback workflow. Frontend 30/30 passed. Desktop (1440) and tablet (768) all 16 admin routes verified. Mobile/form checks completed after reducing screenshot workload.

## Final implementation notes
- Image upload: drag/drop or select up to 10 files, 8 MB each; validate image content, resize to maximum 1600 px, convert to WebP. Gallery reorder/alt text retained. Files live in `public/images/uploads`; excluded from Git. Backend serves uploads; Vite development proxy enabled. Docker runtime exposes a persistent volume at `/public/images/uploads`. Production reverse proxy must route `/images/uploads` to the backend.
- Bulk products: select up to 500 rows; change status/category/brand, fixed/percentage prices, optionally SKU prices. Transactional idempotency keys protect retries; enabling sales requires an image.
- Excel: products import, products/inventory/orders export, reference sheets and Vietnamese instructions. Maximum 2,000 import rows, 50 SKUs per product, 8 MB compressed / 32 MB expanded. Preview validates before product writes. Ten products per request, transactional checkpoint per product, resume from history. Existing specifications and omitted SKUs preserved. Import stock adjustments reuse inventory movements.
- Banners: upload image, internal destination, three Home placements, sort order, activation and start/end dates. Public endpoint returns only currently scheduled active banners. Existing homepage sections retained.
- Vouchers: fixed VND or percentage, min spend/cap/global and per-customer usage limits, dates. Server-priced checkout, transactional usage and exactly-once release on pre-shipment cancellation. Voucher included in order idempotency fingerprint.
- Reports: date range, delivered/paid COD revenue, recorded refunds/net revenue, daily series, top products and slow stock. No invented profit calculation without cost data.
- Staff: STAFF role, per-module read/write permissions checked by APIs and UI, ADMIN-only staff management, password reset/block revokes refresh sessions. Authentication reads permissions from DB on each request.
- Audit: durable entry before mutation, status after response, filtered viewer; excludes passwords/tokens/file bodies.
- Returns/warranty: customer-owned delivered-order requests plus Admin intake; approved → received → resolved, rejection rules, refund cap, optional inventory restock exactly once. Refunds and replacements are **manual operations recorded by staff**, not bank payouts or automatic replacement shipments.
- Email: outbox filter/error/attempt monitoring. Retry creates a new outbox event linked to the original, prevents concurrent/repeated retries, preserves old history. Actual configured worker processes the new event.
- Fixed pre-existing issues found during integration: relative local product image paths rejected by order-email payload validation; newly added SKUs incorrectly deactivated when saving existing products.

## Verification
- Frontend tests: 30/30 passed.
- Backend suite: 54 passed, 8 optional tests skipped. New operational PostgreSQL integration test enabled and passed, with complete rollback.
- Focused follow-up: 19/19 passed, including staff creation/blocking, public banner create/delete, audit and operational workflows.
- Browser: all 16 Admin routes at 390, 768 and 1440 px (48 unique responsive checks); new forms checked on desktop/mobile. Fixed mobile Excel action overflow and selection-column width. Browser writes intercepted; actual write logic verified separately on PostgreSQL.
- Actual Backend health: PostgreSQL and Redis UP. No production database used, no existing records deleted, no real customer test emails sent.
- Build warning: existing frontend bundle exceeds 500 kB; build succeeds.
- Verification details: `docs/admin-expansion-verification.json`.

Final checks: FE lint clean, BE lint clean, FE build passed (bundle-size warning only), BE production build passed, TypeScript typecheck passed, git diff --check clean. FE localhost:5173 and BE localhost:3000 both HTTP 200; PostgreSQL/Redis UP. Temporary test server stopped. Windows completion balloon and speech executed successfully (PowerShell exit 0).
