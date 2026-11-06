# Order email images — 2026-11-06

Live site: https://technest-dev.duckdns.org (existing staging Compose, `NODE_ENV=production`).

Application commits: `2c92cf2` (inline PNG images) and `0259311` (SVG rasterization fonts).

## Findings

The local order confirmation contained an external Unsplash image URL. That URL returned HTTP 200 when fetched directly, but the received email showed a broken image. The previous sender only placed a URL in HTML, leaving loading to the recipient's mail client/image proxy. The existing VPS order used a relative catalog SVG; resolving its hostname alone would still leave an SVG dependent on mail-client support. The SVG rasterizer also needed font configuration/fonts in the production image to preserve labels within the illustration.

## Changes

- `backend/src/modules/email/order-email.images.ts`: load shipped/uploaded images from bounded public directories, or public HTTPS image sources; convert to 144px PNG thumbnails using existing Sharp; attach buffers inline with matching `cid:` HTML references. Repeated variants reuse the image attachment. Failed images use the template's existing text fallback. Fetches have time/size bounds and DNS address checks; local reads reject escaping symlinks. No new npm dependency was added.
- `backend/src/modules/email/order-email.service.tsx`: submit prepared inline attachments with the existing email template and SMTP transport. Nodemailer's file/URL access remains disabled; attachment content is supplied as buffers.
- `Dockerfile`: include `fontconfig` and `font-dejavu` for SVG text conversion.
- `backend/tests/email-images.test.ts`: cover CID reuse, PNG conversion, failure fallback, safe public paths and blocked private addresses/unsafe URLs.

This follows [Nodemailer's embedded-image mechanism](https://nodemailer.com/message/embedded-images): the image bytes travel in a related MIME part referenced by the HTML Content-ID. No UI, API, schema or checkout-pricing logic changed.

## Verification

Executed under Node 22:

```sh
cd backend
npm test -- tests/email-images.test.ts tests/email.test.ts
npm run typecheck
npm run build
npm run lint
```

All passed: 2 test files, 26 tests. The tests ran on the host Node 22 runtime; the existing local development container lacked Vitest's optional Rolldown native binding. Production backend compilation also passed during the actual VPS Docker image build.

Local order `TN-MW4EP5J0-83C1B326` was resent once using the existing outbox retry service: outbox row `264`, `SENT`, one attempt. Its actual MIME contained an inline PNG and matching HTML CID. An independent MIME parser checked the PNG signature/Content-ID, and Chromium rendered the private email preview with its image loaded.

### Actual VPS checkout and mail flow

A single test order was created through the public HTTPS checkout/orders API as the existing authenticated account, using an idempotency key to prevent duplicate orders:

- Order: `TN-MW4GF13L-930D7241`, ID `2`.
- Checkout preview: HTTP 200, no stock warnings.
- Order creation: HTTP 201; recipient matched the authenticated account email.
- Normal outbox → Redis worker → Gmail SMTP delivery: outbox ID `2`, `SENT`, one attempt.
- After adding fonts, the existing admin retry API returned HTTP 201 for one final confirmation of the same order: outbox ID `3`, `SENT`, one attempt, `2026-11-06T04:11:46.502Z` (11:11:46 Vietnam time).
- Final production MIME: one inline PNG, matching HTML CID, `multipart/related`; the catalog SVG was rasterized with fonts. Generating the MIME proof sent no additional email.
- Private final email preview was opened in Chromium and its embedded PNG loaded. Recipient Gmail inbox rendering was not directly accessed.

The test order remains `PENDING`, with a note identifying the requested email check. It was not confirmed for fulfillment. Existing orders were not deleted, reset or imported.

The deployed homepage was also checked in Chromium at 1440px: centered canvas 1111.5px within a 1425px document, no horizontal page overflow, built CSS/JS loaded, no browser exceptions or console errors. Frontend asset filenames remain `index-CR39ii2Z.css` and `index-ChjtZLzX.js`.

## Deployment and preservation

Only the Technest app was rebuilt/recreated with the existing configuration:

```sh
docker compose -f compose.staging.yml build app
docker compose -f compose.staging.yml up -d --no-deps --force-recreate app
```

Final image tag: `technest:staging-email-images-0259311`.
Rollback image: `technest:staging-before-email-images-20261106`.

The `.env.staging` checksum, PostgreSQL/Redis/upload mount identities, PostgreSQL/Redis container IDs/start times and all four Papertrail container IDs/start times are unchanged. The app retains its permanent external `web-proxy` alias `technest-app`. Technest readiness and Papertrail both returned HTTP 200 after deployment. No database migrations, catalog imports, seed/reset commands or volume removals were run.

Private configuration backups and MIME/HTML/results are on the VPS under `backups/staging-email-images-20261106/`; directory permissions are 700 and private files 600. Customer addresses, tokens, credentials and raw MIME were not committed to Git.
