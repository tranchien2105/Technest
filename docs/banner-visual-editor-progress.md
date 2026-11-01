# Technest Visual Banner Editor Progress

## Phase 1 — Source audit

- Homepage uses the public `GET /api/v1/banners?position=...` API through `useBanners` for `HOME_HERO`, `HOME_PROMO`, and `HOME_BOTTOM`.
- The two side cards in `HeroSection.jsx` were hardcoded editorial cards; they did not come from Banner Management.
- Admin CRUD uses `/api/v1/admin/banners`, image upload uses `/api/v1/admin/banners/uploads`, and placements were stored in `store_banners.position`.
- Banner placement was a single nullable field per banner; there was no assignment/reorder transaction or slot capacity validation.
- Existing upload infrastructure uses Multer memory storage + Sharp validation/conversion and serves `/images/uploads`; uploaded files live under the backend public directory.
- Actual managed areas now include: Hero slider, Hero right top/bottom, Setup Studio poster, in-page promo row, and lower-page banner row. Static style and feature imagery remain editorial content outside Banner CMS.

## Phase 2 — Data/API foundation

- Added migration `0012_visual_banner_placements.sql` to allow unassigned banners, widen placement keys, and preserve current side-card content as idempotent CMS records.
- Added admin `GET /api/v1/admin/banners/placements`, `GET /api/v1/admin/banners/:id`, and transactional `PUT /api/v1/admin/banners/placements`.
- Public banner query now recognizes the two Hero side positions; public filtering retains active/date checks and sort order.
- Added Zod slot capacity and duplicate-assignment validation.
- Tests: placement schema test passes (capacity and duplicate assignments).

## Phase 3 — Visual-first editor

- Added the default Website Map mode and kept the existing Banner List in a secondary tab.
- Reuses the real `HomePage` component in a read-only preview with draft banner overrides; visual assignment changes are not published until Save.
- Added desktop/mobile switches, slot selection, picker search/status/placement filters and server pagination, slot capacity, reorder, unassign, status/schedule details, and before-unload protection.
- Banner List adds “Xem vị trí” and the existing CRUD can open the visual editor's selected record for editing.
- Frontend lint, production build, and all 6 frontend test files pass.
- Backend changed-file lint, TypeScript typecheck, production build, and the focused admin-operations test pass (6 assertions).
- Full backend test suite is blocked in this sandbox: HTTP/API test setup fails with `listen EPERM` when it binds `127.0.0.1`; 33 tests fail from that shared setup issue and one order event test times out as a consequence.
- No browser automation is available in this session, so visual checks were not claimed.

## Known limitations / next step

- The current schema has one placement per banner, so one banner cannot be assigned to several placements at once.
- Banner image fields remain single-image URLs; there are no separate desktop/mobile image fields.
- The existing local upload directory is not backed by a declared persistent Docker volume, so deployment persistence needs infrastructure configuration.
- The local upload directory is not backed by a declared persistent Docker volume; deployment persistence still needs infrastructure configuration.

## Follow-up — Editable homepage placements and matching preview

- Expanded all real CMS placements to support the existing larger legacy assignments (up to 100 each) and added the real Setup Studio poster as `HOME_SETUP_STUDIO`; it was previously hardcoded in `HomeCampaignBanners.jsx`.
- Homepage and Admin Visual Preview now use the same API-backed catalog data while viewing `/admin/*`.
- Setup Studio and the two Hero side placements rotate through active banners; reduced-motion preference disables automatic rotation.
- Added a banner-only incremental seed command that adds enough product-backed records to reach ten per actual placement without seeding vouchers/orders or deleting existing data.
- Added direct edit controls on each assigned banner in the visual editor.
- Frontend lint/build/tests pass; backend typecheck/build and focused operations tests pass.
- Added `npm run db:seed:banners` (development-only, `--banners-only`) to fill each real placement to ten records with product-backed images; it does not add vouchers or orders.
- The banner-only incremental seed completed on `technest_dev`: added 30 rows; verified 10+ records in all six placements and zero integrity violations.
- The pending image correction migration was applied successfully. Public Banner API returned active, scheduled results for all six placements.
- The existing Vite/Express processes are serving the workspace at `localhost:5173` and `localhost:3000`; no browser visual verification was available in this session.
