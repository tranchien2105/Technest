# Technest E-commerce

Technest is a full-stack electronics and desk-setup store. The storefront is built with React, Vite and Tailwind CSS; the API uses Express 5, TypeScript, PostgreSQL, Drizzle ORM, Redis and Zod.

## Requirements

- Node.js 22 or newer
- npm
- Docker Compose (for PostgreSQL 16, Redis 7 and optional Mailpit)

## Local development

1. Create the local environment file once. Keep existing credentials if `.env` already exists:

   ```sh
   cp -n .env.example .env
   ```

   Replace the placeholder PostgreSQL password, Redis password and JWT secret in `.env`. Keep the passwords in `DATABASE_URL` and `REDIS_URL` in sync. `.env` is ignored by Git.

2. Start the development dependencies from the repository root:

   ```sh
   docker compose up -d --wait
   ```

   Compose exposes PostgreSQL at `127.0.0.1:5433`, Redis at `127.0.0.1:6380`, and Mailpit SMTP/UI at `127.0.0.1:1025` / `http://127.0.0.1:8025`.

3. Install dependencies and initialize the development database:

   ```sh
   cd backend
   npm ci
   npm run db:migrate
   npm run db:seed
   ```

   Migrations are incremental. `db:seed` inserts baseline development catalog data; it does not reset the database. Additional development fixtures are available through `npm run db:seed:incremental` and `npm run db:seed:banners`.

4. Run the API and storefront in separate terminals, both from the repository root/package directory shown:

   ```sh
   # Terminal 1
   cd backend && npm run dev
   ```

   ```sh
   # Terminal 2 (repository root)
   npm install
   npm run dev
   ```

   The storefront is served at `http://localhost:5173`; the API defaults to `http://127.0.0.1:3000/api/v1`. Set `VITE_API_BASE_URL` in the root `.env` when using a different API origin. `CORS_ORIGIN` must match the browser origin.

## Useful commands

Run storefront checks from the repository root:

```sh
npm run lint
npm test
npm run build
```

Run API checks from `backend/`:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Check API and its dependencies at `GET http://127.0.0.1:3000/api/v1/health`.

## Project structure

```text
src/                         React storefront and Admin Dashboard
  admin/                     Admin routes, catalog, orders, banners and CMS
  api/                       Storefront and Admin API clients
  components/                Shared layout, account, product and home sections
  hooks/                     Catalog, cart, auth and UI state hooks
  pages/                     Storefront routes
  routing/                   Storefront navigation and route selection
backend/src/
  modules/auth/              JWT access tokens, refresh sessions and RBAC
  modules/catalog/           Public categories, brands and products APIs
  modules/admin/             Admin dashboard and catalog operations
  modules/admin-operations/  Banners, vouchers, uploads and store operations
  modules/homepage-cms/      Homepage draft/published configuration APIs
  modules/inventory/         SKU inventory, movements and reservations
  modules/orders/             Checkout, customer orders and admin status flow
  modules/account/            Profile, addresses, sessions and password changes
  modules/notifications/      Customer notifications and admin announcements
  modules/email/              Transactional email and outbox workers
  database/schema/            Drizzle schema definitions
  database/migrations/         Versioned SQL migrations
  database/seeds/              Development seed and verification scripts
docs/                         Implementation and recovery checkpoints
```

## Main API areas

All APIs are versioned under `/api/v1`:

- Catalog: `GET /api/v1/products`, `/api/v1/products/:id`, `/api/v1/categories`, `/api/v1/brands`
- Authentication: `/api/v1/auth` (registration, login, refresh, logout and current user)
- Account: `/api/v1/account` (profile, addresses, password and sessions)
- Checkout and orders: `/api/v1/checkout`, `/api/v1/orders`, `/api/v1/admin/orders`
- Inventory: `/api/v1/inventory` and `/api/v1/admin/inventory`
- Notifications: `/api/v1/notifications` and `/api/v1/admin/notifications`
- Store banners and operations: `/api/v1/banners`, `/api/v1/admin/banners`, `/api/v1/admin/vouchers`
- Homepage CMS: `GET /api/v1/homepage/config` for published content and `/api/v1/admin/homepage` for protected draft/publish operations
- Admin dashboard/catalog: `/api/v1/admin`

Admin APIs enforce authorization in the backend. Frontend route guards improve navigation but are not the security boundary. Normal customer registration does not grant an Admin role.

## Storefront and development data

Products, categories, brands, inventory and banners are read from the API/database in the integrated flows. Homepage copy and section settings use the published Homepage CMS configuration; draft edits remain Admin-only until published. Cart, favorites, compare and recently viewed remain browser-local. Checkout/order behavior should be treated according to the current backend integration and development environment, not as a production payment service.

Seeded users, orders, banners and catalog records are development fixtures. Do not run development seed commands against production. Seed scripts check the environment for the supported development database; never put real customer information or credentials in seed data.

Product and banner images may use external URLs. Admin-uploaded media is served from `/images/uploads`; local uploads are runtime files and are Git-ignored. Persist the upload directory with durable storage when deploying.

## Database safety

- Use `npm run db:generate` in `backend/` after Drizzle schema changes, review the generated SQL, then apply it with `npm run db:migrate`.
- Do not use `docker compose down -v` unless you intentionally want to delete local database/cache volumes.
- Back up persistent data before applying migrations outside development.
- No secrets belong in source control; `.env.example` contains placeholders only.

## Current limitations

This repository is under active development. Payment provider integration, shipping-provider integration, production media storage, production observability and deployment-specific secrets/backups require environment-specific setup. Inventory is authoritative on the backend; a storefront stock display is informational until checkout validates availability again. Mailpit captures development email; configure a real SMTP provider only through environment variables for a deployment.
