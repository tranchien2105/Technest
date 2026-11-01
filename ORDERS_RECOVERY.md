# Orders recovery — 2026-10-31

## Recovery baseline

Repository: `/home/minhchien/project/technest` (the parent workspace is not a Git repository).
Existing working-tree edits and untracked files were preserved. The backend was entirely untracked at recovery time. No reset, volume removal, reseed, or destructive migration was performed.

Initial audit:

| Area | Initial status | Evidence |
| --- | --- | --- |
| Orders schema/items/history | PARTIAL | `0006_orders.sql` existed; database migration history ended at `0005` |
| Backend Orders | BROKEN | Six TypeScript errors, unregistered routes, cancellation ownership check missing |
| Inventory integration | BROKEN | Duplicated mutations; orders expired; confirmation deducted on-hand before shipping |
| Customer checkout/orders | PARTIAL | Orders created and read from browser storage |
| Admin Orders | MISSING | Placeholder |
| Email | UNVERIFIED | Outbox/runtime existed; BullMQ driver was missing |
| Realtime | PARTIAL | Unregistered SSE; Socket.IO dependency existed without server attachment |
| Infrastructure | COMPLETED | PostgreSQL/Redis/Mailpit healthy; migration history readable; Redis PONG |

## Implemented behavior

- Registered authenticated checkout preview, customer Orders and ADMIN-only Orders APIs.
- Server prices and snapshots use integer VND; IDs and money serialize as strings. Order primary keys are BIGINT.
- Creation uses a PostgreSQL transaction, row locks, a per-user/key advisory lock and a unique constraint. Retrying the same body/key returns the same order; a changed body returns 409.
- Customer detail and cancellation enforce ownership; invalid state transitions roll back.
- Orders reuse Inventory Service transaction operations. Creating COD reserves stock; order reservations are excluded from expiry. CONFIRMED/PROCESSING keep stock reserved. SHIPPED deducts on-hand and reserved once. Cancellation before SHIPPED releases once. DELIVERED marks COD payment PAID.
- Default shipping policy: 30,000 VND, free from 1,000,000 VND; preview and creation share the policy.
- Status history and email outbox are written in the order transaction. The worker now uses BullMQ's node-redis adapter with the installed `redis` dependency.
- Checkout calls preview/create and retains a retry key in sessionStorage across network errors/reloads. Orders are fetched from PostgreSQL rather than trusted from localStorage.
- Customer/admin lists support pagination, search and status filters; details include snapshots/history. Customers can cancel before shipment; admins can apply valid transitions.
- Socket.IO attaches to the HTTP server, authenticates JWT and assigns server-controlled customer/admin rooms. Status notifications publish after successful transaction completion. The frontend uses authenticated SSE plus 15-second REST polling.
- Migration `0006` was applied additively; history now contains seven entries. Restored the latest Drizzle schema checkpoint; schema-to-checkpoint migration diff is empty. Existing migration SQL was preserved.

## Verification

- Frontend production build, lint and Node/render tests.
- Backend production build, typecheck, lint and existing tests (38 passed; database opt-in tests are separate).
- `RUN_ORDER_DB_TESTS=1 RUN_ORDER_EMAIL_TESTS=1 npx vitest run tests/orders.integration.test.ts`:
  - simultaneous same-key retries produce one order;
  - simultaneous distinct orders cannot oversell;
  - cross-account detail/cancel denied;
  - rejected transitions preserve inventory;
  - stale COD reservations remain held;
  - shipment/cancellation retries affect stock once;
  - history, search/filter and unique email events;
  - outbox → BullMQ/Redis → SMTP → SENT, with messages visible in local Mailpit.
- Compiled runtime smoke: dependency health, actual JWT customer Orders, admin RBAC, SSE headers and Socket.IO handshakes accepting valid JWT/rejecting missing JWT.
- Fixtures from integration/smoke tests were removed by their own IDs. A hung preliminary email test was stopped and only its identified fixture rows were cleaned before rerunning successfully.
- The temporary runtime on port 3100 was stopped cleanly.

## Final audit classification

| Area | Status | Verification boundary |
| --- | --- | --- |
| Orders schema/items/history + migration | COMPLETED | PostgreSQL migration applied; real order/history tests |
| Customer/Admin Orders APIs + checkout preview | COMPLETED | HTTP/service integration, JWT/RBAC runtime smoke |
| Inventory integration | COMPLETED | Orders concurrency test and all four existing Inventory tests, including real PostgreSQL lifecycle/concurrency |
| Email queue/outbox | COMPLETED | Local Redis/BullMQ/SMTP/Mailpit delivery verified |
| Checkout/My Orders/Admin UI | UNVERIFIED | Code integrated; build/lint/render tests pass; interactive browser walkthrough pending |
| Socket.IO/SSE | PARTIAL | Server wired; auth handshakes and SSE endpoint verified; client-to-client event delivery pending |

Inventory regression command: `INVENTORY_DB_TESTS=1 npx vitest run tests/inventory.test.ts` (4 passed).

## Scope and remaining verification

Backend Orders, inventory invariants and local email delivery have automated/runtime verification. Frontend integration has build/render verification; a complete interactive browser checkout/admin walkthrough remains UNVERIFIED.

Realtime is in-process and has no cross-instance Redis adapter; PostgreSQL/REST and polling remain authoritative. Socket.IO room event delivery has not been tested end-to-end with a browser client. SMTP delivery is at least once: an SMTP success followed by a crash before persisting SENT can cause duplicate delivery, although outbox events are unique.

The user's request was truncated at `PHASE 5 — CUST`; subsequent unspecified requirements were unavailable. Work followed the Checkout/My Orders/Admin Orders scope stated before that point.
