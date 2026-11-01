# Notifications implementation progress

## Phase 1 — Source audit

- Files changed: this checkpoint only.
- Features completed: audited backend schema/migrations, Auth/RBAC, Orders transitions and email outbox, existing Socket.IO rooms, Account APIs, storefront Header/Account page and frontend auth/event clients.
- Findings: Socket.IO is already installed and authenticated in `backend/src/server.ts`; the Frontend has an older localStorage order-notice widget and no socket client dependency. No standalone Promotions or Payments module exists. Voucher support is not a promotion campaign system.
- Tests passed: none in this phase.
- Remaining tasks: persistent notifications schema/service/API, post-commit socket delivery and Orders integration, Account integration, Header/dropdown and account page, tests and verification.
- Known issues: current order event SSE remains and will continue to support order refresh; it must not be duplicated by a second socket manager.

## Phase 2 — Persistent backend module

- Files changed: `backend/src/database/schema/notifications.ts`, `backend/src/database/schema/index.ts`, `backend/src/database/migrations/0011_notifications.sql`, migration journal, `backend/src/modules/notifications/*`, `backend/src/app.ts`.
- Features completed: persistent notification schema with BIGINT IDs, recipient/type/read/event-key indexes, idempotent creation helpers, owner-scoped paginated/filterable APIs, unread count/read/read-all, and a bounded ADMIN-only announcement endpoint for up to 100 selected active customers.
- Tests passed: PostgreSQL notification API integration tested with ownership isolation, duplicate event key, category filter, pagination, read actions, admin RBAC and announcement deduplication.
- Remaining tasks: storefront integration and final validation.
- Known issues: campaign/promotion and payment modules do not exist; their notification types are reserved but no events are fabricated.

## Phase 3 — Business event and realtime integration

- Files changed: Orders service/controller, Account service/controller/routes, Admin customer status service/controller/routes and `backend/src/server.ts`.
- Features completed: order transitions write notification in the same transaction as status/history/email outbox; no-op/invalid transitions do not create a notice; profile/password changes and customer lock transitions create notices transactionally; published only after commit. Socket.IO uses existing authenticated user rooms and emits notification/count events privately. Admin announcements publish after insertion commits.
- Tests passed: PostgreSQL Orders integration verifies status notices, invalid transition rollback, same-status retry deduplication, cancellation notice and recipient isolation.
- Remaining tasks: final lint/typecheck/build/test pass and dev API/socket reachability check.
- Known issues: ACCOUNT_LOCKED is persisted and queued for realtime, but there is no dedicated account-security email template; locked users cannot authenticate to view it until access is restored.

## Phase 4 — Frontend and verification

- Files changed: `src/api/notificationsClient.js`, `src/hooks/useNotifications.jsx`, `src/hooks/notificationsContext.js`, `src/components/account/AccountNotifications.jsx`, `src/components/layout/Header.jsx`, `src/pages/HomePage.jsx`, `src/pages/AccountPage.jsx`, `src/routing/navigation.js`, `src/styles/design-system.css`, `src/index.css`, removed `src/components/layout/OrderNotifications.jsx`, and `tests/render.test.js`.
- Features completed: one authenticated Socket.IO connection is shared at app level, refreshes count and list after reconnect, resets visible count on account switch/logout, Header User badge/dropdown, Notifications Account page with category filters, pagination and read actions. Removed the old localStorage order-only bell and its unused styles.
- Tests passed: Frontend lint, Node tests (6/6), production build. Backend lint, typecheck, build and full Vitest suite (54 passed, 10 environment-gated skipped); PostgreSQL notification + order integration tests (2 passed), including admin announcement and account lock integration.
- Runtime verification: additive migration applied; PostgreSQL/Redis health is `up`; `/api/v1/notifications/unread-count` responds 401 without auth; Socket.IO client bundle and `/account/notifications` return HTTP 200. Frontend remains available at `http://localhost:5173`; Backend is already listening at `http://localhost:3000`.
- Remaining tasks: visual responsive check at 375/768/1280 requires a browser.
- Known issues: realtime event delivery is best-effort across process crashes; PostgreSQL remains the source of truth and reconnect fetch restores persisted state. No Redis Socket.IO adapter is configured for multi-instance deployment. Account lock notices are stored/realtime only; no dedicated account-security email template exists.
- Build note: Vite reports the existing main bundle is above 500 kB minified; build succeeds.
- Audio notification attempt: `powershell.exe` failed in this WSL environment with `UtilBindVsockAnyPort`; no sound was confirmed.
