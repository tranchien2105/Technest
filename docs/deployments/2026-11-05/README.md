# Technest staging UI deployment — 2026-11-05

Verified website: https://technest-dev.duckdns.org

Application source deployed: `a64c577973509db37917bafeedeb32f164f4f872`.

## Findings and fixes

The historical screenshot's extreme, character-by-character collapse did not reproduce in a fresh browser at the start of this investigation. The currently deployed homepage and development homepage initially had the same computed widths. This report does not attribute that historical screenshot to an unobserved missing asset or browser cache problem.

The investigation did reproduce these sizing defects:

- The final `.home-content` and category navigation rules constrained the canvas to `78vw`, while header padding consumed `11vw` on each side. The 768px header overflowed its usable area.
- The featured carousel is a **flex** container. Its percentage card basis used four columns at tablet widths; at 768px the already constrained canvas produced approximately 139px cards. Grid components already used `minmax(0, 1fr)`; changing their column definitions would not fix the flex rail's available width.
- Featured cards had a fixed 494px height, leaving large gaps on narrower screens. Card height now follows content while the row stretches cards consistently.

The source now uses one fluid canvas capped at 1500px, with 20px side margins (16px on mobile). Sections and rails have explicit bounds and `min-width: 0`; featured cards do not flex-shrink. The carousel shows two columns on mobile, three on tablets, four on small desktops and five on larger desktops. Header spacing aligns with this canvas. Colors, fonts, borders, image treatment and controls are preserved.

CSS/JS requests on the original deployment succeeded and HTML used `Cache-Control: no-store`. A rule-level comparison found that local Tailwind scanning generated eight extra utility selectors from files outside the UI source, while Docker excluded documentation. The authored layout rules were identical; this difference was not evidence of missing core styles. Tailwind now scans `src` explicitly, making the tested local and VPS-built CSS/JS byte-identical.

The staging app's `web-proxy` membership was previously a manual container connection. `compose.staging.yml` now declares the external network and `technest-app` alias, so recreating the app preserves proxy access.

## Checks

- `npm test`: 12/12 test files passed.
- `npm run lint`: passed, no errors.
- `VITE_API_BASE_URL=/api/v1 npm run build`: passed, including the production React runtime guard.
- Actual production bundle served locally with an API proxy: passed all four viewport tests.
- Actual HTTPS deployment: passed all four viewport tests, with browser screenshots inspected.
- Carousel next/previous controls, category navigation and browser Back worked at each width.
- Returning from the admin login after loading its lazy CSS preserved the homepage layout.
- Product titles, prices, images and purchase buttons retained usable bounds; images loaded.
- No page horizontal overflow, uncaught exceptions, console errors, failed resources or same-origin HTTP errors were reported.

Measurements below come from Chromium's actual layout; desktop scrollbars reduce document width by 15px.

| Viewport | Canvas before | Canvas after | Featured card before | Featured card after |
| --- | ---: | ---: | ---: | ---: |
| 375px | 343.0px | 343.0px | 165.5px | 164.5px |
| 768px | 599.0px | 713.0px | 139.3px | 227.7px |
| 1024px | 798.7px | 969.0px | 189.2px | 231.8px |
| 1440px | 1123.2px | 1385.0px | 213.8px | 266.2px |

The 375px rail previously extended 2px beyond its section. Its corrected width accounts for the small card-width reduction.

### Deployed screenshots

| Viewport | Homepage | Products |
| --- | --- | --- |
| 375px | [Overview](375-top.png) | [Product cards](375-products.png) |
| 768px | [Overview](768-top.png) | [Product cards](768-products.png) |
| 1024px | [Overview](1024-top.png) | [Product cards](1024-products.png) |
| 1440px | [Overview](1440-top.png) | [Product cards](1440-products.png) |

[Original 768px product layout](before-768-products.png). [Machine-readable measurements, assets and timestamps](verification.json).

### Matching production assets

The following checksums matched between local production output and the image built on the VPS before activation:

```text
c81eda3207a8cbc2fcc70571f7da4992b032ab0a4cd42f9e3dc9464b661c9fa3  index-IHfQCwCX.css
e6932e608cc2a59769eaf949c672694eabaa651656cd4bd2cedef1502d6cb5b3  index-WSl-U40w.js
```

## Deployment and preservation

Only the staging application was built and recreated:

```sh
docker compose -f compose.staging.yml build app
docker compose -f compose.staging.yml up -d --no-deps --force-recreate app
```

After recreation, Docker reported `technest-app` in the app's `web-proxy` aliases. Readiness at `https://technest-dev.duckdns.org/api/v1/health/ready` returned HTTP 200 with PostgreSQL and Redis up. `https://papertrail-dev.duckdns.org/` returned HTTP 200.

The `.env.staging` checksum, PostgreSQL/Redis/upload volume mounts, PostgreSQL/Redis container IDs and start times, and all four Papertrail container IDs and start times were unchanged. No database imports, seed commands, table resets or volume removal were performed. Existing SMTP configuration was preserved.

Private config backups and before/after preservation records are on the VPS under `backups/staging-ui-20261105/`. The previous image is retained as `technest:staging-before-ui-20261105`; the deployed image is also tagged `technest:staging-a64c577`.

The staging database currently has no active homepage hero banner, so its existing empty-banner notice remains visible. Local demo banner content was not imported as part of this UI deployment.

## Repeat the visual check

With Chromium and its runtime libraries available:

```sh
TECHNEST_URL=https://technest-dev.duckdns.org \
TECHNEST_SCREENSHOTS=/tmp/technest-ui-check \
CHROME_PATH=/path/to/chromium \
node scripts/verify-home-layout-browser.mjs
```

The checker uses anonymous, read-only browsing. Reduced-motion emulation disables automatic carousel movement for deterministic screenshots; carousel buttons are exercised explicitly.
