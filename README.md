# Technest E-commerce

Technest is a full-stack electronics and desk-setup store with a customer storefront, an Admin Dashboard and a PostgreSQL-backed commerce API. It includes catalog browsing, product variants, COD checkout, inventory reservations, Flash Sale campaigns, a visual Homepage CMS and server-generated SEO HTML.

**Project status:** active development. Local verification was updated on **4 November 2026**. Production deployment still requires catalog approval, infrastructure configuration and further performance work; see [verification results](docs/technest-eight-tasks-report.md).

## Features

| Area | Included |
| --- | --- |
| Storefront | Homepage CMS sections, search, category/brand filters, sorting, pagination, slug-based product URLs, galleries and variants |
| Shopping | Favorites, comparison, recently viewed products, cart persistence and desk-setup builder |
| Checkout | COD, shipping addresses, server price/stock validation, idempotent order creation, order history and cancellation |
| Flash Sale | Scheduled campaigns, server-clock countdowns, variant pricing, quotas, per-customer limits and inventory/quota reservations |
| Account | Registration/login, refresh sessions, profile, addresses, password/session management and notifications |
| Admin | Dashboard, products/variants, categories, brands, inventory, orders, customers, staff/RBAC, vouchers, banners and email operations |
| Homepage CMS | Draft editing, visual preview and protected publish workflow |
| SEO | Route-specific HTML metadata/content, canonical URLs, Open Graph/Twitter, JSON-LD, sitemap index, robots policy and redirects |
| Operations | Liveness/readiness, request IDs, transactional email outbox and an isolated backup/restore rehearsal |

Payments currently support **COD only**. There is no online payment provider or payment webhook integration.

## Technology

- **Frontend:** React 19, Vite, Tailwind CSS and Lucide icons.
- **Backend:** Express 5, TypeScript, Zod and Drizzle ORM.
- **Data:** PostgreSQL 16 and Redis 7.
- **Realtime/email:** Socket.IO, SSE, BullMQ, transactional email and Mailpit for local capture.
- **Checks:** Node test runner, Vitest, PostgreSQL integration suites, Chromium browser scripts and Lighthouse.

## Requirements

- Node.js **22+** and npm.
- Docker with Docker Compose for development dependencies.
- Separate terminals for frontend and backend development servers.

## Run locally

### 1. Configure the environment

From the repository root:

```sh
cp -n .env.example .env
```

Keep an existing `.env`. Replace the placeholder PostgreSQL password, Redis password and JWT secret; update the corresponding `DATABASE_URL` and `REDIS_URL` values together. The backend reads the root `.env`; shell/deployment variables take precedence. Local credentials are ignored by Git.

The default frontend API URL is `http://localhost:3000/api/v1`. `CORS_ORIGIN` must match the browser origin, normally `http://localhost:5173`.

### 2. Start PostgreSQL, Redis and Mailpit

```sh
docker compose up -d --wait
```

| Service | Local address |
| --- | --- |
| PostgreSQL | `127.0.0.1:5433` |
| Redis | `127.0.0.1:6380` |
| Mailpit SMTP | `127.0.0.1:1025` |
| Mailpit inbox | <http://localhost:8025> |

Existing database volumes retain their credentials. Changing `.env` alone does not change the password inside an initialized PostgreSQL volume.

### 3. Install dependencies and initialize the database

```sh
# Repository root
npm ci

cd backend
npm ci
npm run db:migrate
npm run db:seed
```

Migrations are incremental. The baseline seed is for development; it does not reset the database. Additional seed scripts and their restrictions are described in [data safety](#development-data-and-safety).

### 4. Start backend and frontend

```sh
# Terminal 1 — repository root
cd backend
npm run dev
```

```sh
# Terminal 2 — repository root
npm run dev
```

- **Storefront:** <http://localhost:5173>
- **Admin:** <http://localhost:5173/admin>
- **API:** <http://localhost:3000/api/v1>
- **Readiness:** <http://localhost:3000/api/v1/health/ready>

Customer registration does not grant Admin permissions. Backend RBAC protects Admin APIs independently of frontend route guards.

## Checks

Frontend, from the repository root:

```sh
npm run lint
npm test
npm run build
```

Backend, from `backend/`:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Database integration suites are opt-in. A skipped suite is not a successful database verification. Examples, from `backend/`, against the confirmed local development database:

```sh
RUN_SEO_DB_TESTS=1 npm test -- tests/seo-db.integration.test.ts
RUN_PRICING_DB_TESTS=1 npm test -- tests/pricing-flash-sale-db.integration.test.ts
RUN_ORDER_DB_TESTS=1 npm test -- tests/orders.integration.test.ts
RUN_ADMIN_DB_READ_TESTS=1 npm test -- tests/admin.integration.test.ts
```

Browser and Lighthouse tools are under `scripts/`; they require Chrome/Chromium and running local audit servers. [Browser checkpoints](docs/technest-browser-mobile-progress.md) and the [SEO audit](docs/technest-local-seo-audit.md) document the fixture setup and actual results.

## Build and deployment

Build the frontend with a same-origin API for an Express deployment:

```sh
# Repository root
VITE_API_BASE_URL=/api/v1 npm run build

cd backend
npm run build
```

The frontend build wrapper explicitly uses React's production runtime and checks the generated bundle, even when the shared development `.env` contains `NODE_ENV=development`.

Configure the deployment environment, apply reviewed migrations and point `STOREFRONT_DIST` at the frontend `dist` directory before starting the compiled backend. Set `NODE_ENV=production` for the server. Serve public pages through Express so route-specific SEO HTML, HTTP statuses, APIs and assets share the correct origin; `vite preview` is not the production SEO server.

For SEO, configure the actual HTTPS domain with `SEO_SITE_URL`. Keep `SEO_INDEXING_ENABLED=false` on development/staging. Enable production indexing only after reviewing catalog data and deployment behavior. Configure proxy trust and origin redirects for the real infrastructure.

A multi-stage [Dockerfile](Dockerfile) is included. The [production runbook](docs/technest-production-runbook.md) covers migrations, SMTP, persistent uploads, health checks, backup/restore and rollback. The Docker image still needs a deployment smoke test on the target infrastructure.

## API areas

APIs are versioned under `/api/v1`:

| Area | Routes |
| --- | --- |
| Catalog | `/products`, `/products/:idOrSlug`, `/categories`, `/brands` |
| Auth/account | `/auth`, `/account` |
| Checkout/orders | `/checkout`, `/orders`, `/admin/orders` |
| Inventory | `/inventory`, `/admin/inventory` |
| Notifications | `/notifications`, `/admin/notifications` |
| Flash Sale | `/flash-sales`, `/flash-sales/events`, `/admin/flash-sales` |
| Homepage CMS | `/homepage/config`, `/admin/homepage` |
| Banners/vouchers | `/banners`, `/admin/banners`, `/admin/vouchers` |
| Admin | `/admin` |
| Health | `/health`, `/health/live`, `/health/ready` |

Public SEO routes include `/products/<slug>`, `/categories/<slug>`, `/brands/<slug>`, `/robots.txt` and `/sitemap.xml`. Numeric product URLs remain compatible through redirects.

Checkout revalidates prices and available inventory on the backend. Flash Sale reserves quota and inventory within the order transaction; vouchers do not stack with Flash Sale prices. Unconfirmed pending Flash Sale orders expire after 15 minutes under the existing COD lifecycle. Browser prices and stock displays are informational until backend confirmation.

## Development data and safety

- Catalog, inventory, banners and CMS content are served from the backend. Manually selected CMS products keep their configured order; eligible automatic catalog sections prioritize newest data.
- Cart, favorites, comparison and recently viewed products are stored in the browser. Orders, accounts, inventory and published CMS content are stored on the backend.
- Seeded products, users and orders are development fixtures. Do not run development seeds on production or present illustrative product data as verified commercial information.
- The legacy large synthetic catalog generator is blocked unless explicitly opted into for a separate load-test database. Prefer curated data and the [catalog quality audit](docs/technest-catalog-pricing-audit.md).
- Back up before data repairs or migrations. Raw database snapshots and local dump files are ignored by Git; verification reports can be reviewed under `docs/`.
- Admin uploads live under `/images/uploads`; persist and back up this runtime directory separately from PostgreSQL.
- Keep `.env`, credentials, database dumps and customer data out of source control. `.env.example` contains placeholders.
- Avoid `docker compose down -v` when preserving development data; it deletes database/cache volumes.

## Verification and remaining work

The latest [eight-task report](docs/technest-eight-tasks-report.md) records the changes and evidence:

- Frontend lint, **12/12 test files** and build passed; backend lint/typecheck/build passed, with **82 default tests passed / 35 skipped** and separate PostgreSQL suites.
- Chromium verified **13 COD steps**, **24 mobile page/viewport checks**, **6 Admin checks**, and SEO navigation including browser Back/Forward. Transaction fixtures were rolled back.
- Entry JavaScript decreased from **566.61 kB to 334.65 kB**. Eight Lighthouse runs reported SEO/Best Practices **100**, Accessibility **96–97** and Performance **26–52 mobile / 59–75 desktop**.
- Catalog repair safely deactivated **649** unreferenced legacy fixtures. **4,301** records linked to business history remain protected and need merchandise review.
- An actual restore into an isolated database matched **32 tables, 130 constraints and 90 indexes**. Durable backup storage, retention and scheduled restore rehearsals still need deployment configuration.

These are local lab results, with WSL CPU warnings on some measurements. Mobile performance, LCP and layout shifts need further work. They do not establish field Core Web Vitals or Google indexing. Production also needs verified merchandise/images/prices, HTTPS/domain configuration, SMTP, media storage, monitoring and staging validation.

## Documentation

- [Backend setup](backend/README.md)
- [Latest implementation report](docs/technest-eight-tasks-report.md)
- [Local Technical SEO audit](docs/technest-local-seo-audit.md)
- [Catalog quality and pricing audit](docs/technest-catalog-pricing-audit.md)
- [Production and recovery runbook](docs/technest-production-runbook.md)
- [Progress checkpoint](docs/technest-eight-tasks-progress.md)

## Repository layout

```text
src/
  admin/                 Admin Dashboard, catalog editors and visual CMS
  api/                   Public/authenticated API clients
  components/            Layout, account, product, checkout and home UI
  domain/                Cart, checkout, Flash Sale and selection rules
  hooks/                 Catalog, navigation, notifications and UI state
  pages/                 Customer storefront pages
  routing/               Route handling and product URLs
backend/
  src/modules/           Express commerce, Admin, auth, SEO and health modules
  src/database/          Drizzle schema, migrations and development seeds
  scripts/               Local audit, browser fixtures and restore rehearsal
  tests/                 Backend unit/HTTP/PostgreSQL suites
scripts/                 Frontend build, browser and Lighthouse tools
tests/                   Frontend domain and rendering tests
public/                  Static assets; runtime uploads are Git-ignored
docs/                    Reports, evidence, runbooks and checkpoints
```
