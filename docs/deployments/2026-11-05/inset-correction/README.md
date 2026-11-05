# Centered storefront and campaign shelf correction — 2026-11-05

Verified live website: https://technest-dev.duckdns.org

Deployed application source: `0360426c5f5b7a34e9bdad013e976af470f8ccda`.

## Actual cause

The initial investigation checked the featured shelf (`#products`) but missed the separate category/brand shelf (`.home-campaigns`). The user's latest screenshot identified this missing coverage. Its extreme collapse was reproduced on the live website before changing the source; see [the before screenshot](before-1440-campaigns.png).

`HomeCampaignBanners` renders its Setup Studio poster conditionally. Local catalog data includes active posters; staging has none. The campaign CSS always declared two grid columns, even when the poster was absent. The remaining `.home-campaign-shop` was auto-placed in the first, narrow column, leaving the large second column empty. At a 1440px viewport, the section was 1385px wide, the shop only 246.86px wide, and each product card only 38.56px wide. Percentage flex bases then squeezed titles, prices and buttons into these narrow cards. Assets were loading; missing Tailwind utilities were not the cause of this collapse.

The prior widening to almost the whole viewport also did not match the user's requested design. Desktop content is now centered at 78% of available width, capped at 1500px; the header's inner spacing and navigation follow the same alignment. At widths below 1200px, existing fluid tablet/mobile spacing remains usable.

## Source changes

- `src/index.css`: campaign grid defaults to a single `minmax(0, 1fr)` column. A real poster enables the two-column desktop layout; mobile and empty placeholders retain a single column. Campaign cards have a responsive minimum width of 180px and use content height instead of a fixed height.
- `src/styles/design-system.css`: restore desktop side margins and align header/navigation with the centered canvas.
- `scripts/verify-home-layout-browser.mjs`: check the campaign shelf, every homepage product rail, category tabs, brand filtering, campaign carousel controls, and banner presence/absence/placeholder states. Capture the previously missed shelf as well as the homepage and featured products.

Colors, fonts, borders, application behavior, API and database schema are unchanged.

## Verification

- `npm test`: 12/12 test files passed.
- `npm run lint`: passed.
- `VITE_API_BASE_URL=/api/v1 npm run build`: passed, including the production React runtime guard.
- Local production bundle: passed at 375, 768, 1024, 1440 and 1920px; [local results](local-verification.json).
- Local Vite development page at `http://localhost:5173`: verified at 1440px with its actual poster and normal 180px campaign cards. Backend readiness returned 200. Use `localhost`, matching the existing backend CORS origin; `127.0.0.1:5173` is a different origin.
- Actual HTTPS staging website: passed at all five widths; [browser measurements, checks, asset responses and timestamps](verification.json).
- Screenshots were opened and visually inspected for desktop, tablet and mobile layouts. Campaign titles, prices, images and purchase buttons have usable dimensions. No page overflow, console errors, uncaught exceptions, failed non-cancelled resources or same-origin HTTP errors were reported.
- All five campaign tabs, brand selection, both campaign and featured carousel controls, category navigation, Back navigation, and lazy admin CSS isolation passed.
- Optional poster states were exercised with temporary browser DOM fixtures; no CMS or database writes were made.

Live measurements (desktop scrollbars reduce available document width by 15px):

| Viewport | Centered canvas | Left margin | Campaign shop | Campaign card |
| --- | ---: | ---: | ---: | ---: |
| 375px | 343.0px | 16.0px | 343.0px | 264.4px |
| 768px | 713.0px | 20.0px | 713.0px | 227.7px |
| 1024px | 969.0px | 20.0px | 969.0px | 231.8px |
| 1440px | 1111.5px | 156.8px | 1111.5px | 211.5px |
| 1920px | 1485.9px | 209.5px | 1485.9px | 286.4px |

### Screenshots of the deployed site

| Width | Homepage | Category and brand shelf |
| --- | --- | --- |
| 375px | [Homepage](375-top.png) | [Shelf](375-campaigns.png), [complete first card](375-campaign-products.png) |
| 768px | [Homepage](768-top.png) | [Shelf](768-campaigns.png) |
| 1024px | [Homepage](1024-top.png) | [Shelf](1024-campaigns.png) |
| 1440px | [Homepage](1440-top.png) | [Shelf](1440-campaigns.png) |
| 1920px | [Homepage](1920-top.png) | [Shelf](1920-campaigns.png) |

### Matching local and VPS assets

The production image built on the VPS contains the same CSS/JS bytes as the tested local production bundle:

```text
5df4631875929a2b7afc1553467964b2f63eea141cb848355347342d4ad43c3c  index-CR39ii2Z.css
9a25c0d230684e09500ae1d9d7e825bae358ee58a324b7fc2576b7acb8ee480e  index-ChjtZLzX.js
```

## Deployment and preservation

Only the existing staging app was built and recreated:

```sh
git pull --ff-only origin main
docker compose -f compose.staging.yml config --quiet
docker compose -f compose.staging.yml build app
docker compose -f compose.staging.yml up -d --no-deps --force-recreate app
```

The app is healthy. Its permanent external `web-proxy` network aliases include `technest-app` after recreation. `https://technest-dev.duckdns.org/api/v1/health/ready` and `https://papertrail-dev.duckdns.org/` returned HTTP 200.

Private backups and preservation checks are stored on the VPS under `backups/staging-ui-inset-20261105/` (directory mode 700, environment backup mode 600). The `.env.staging` checksum, including existing SMTP configuration, is unchanged. PostgreSQL/Redis/upload mounts are identical. PostgreSQL/Redis container IDs and start times and all four Papertrail container IDs and start times are unchanged. No imports, seeds, table resets, data-volume removal, or Papertrail restarts occurred.

Rollback image: `technest:staging-before-inset-20261105`. Deployed image tag: `technest:staging-0360426`.

Staging still has no active homepage hero/Setup Studio banners. The existing empty hero notice remains visible. This deployment fixes layout without importing local demo banner records into staging.
