# Catalog quality & pricing / Flash Sale checkpoint

**Ngày:** 03/11/2026. **Database:** local development `technest_dev` only.

## Trạng thái

- Audit light queries: 5.060 products, 51 brands. 50 original fixtures, 60 curated fixtures, 4.950 legacy generated illustrations.
- Legacy records have exact dataset + seedKey + ordinal identifiers. 4.300 already have order references, 5 have campaign references. They must be preserved.
- Backup + dry-run + apply + read-only verification completed: **649** exact generator products without any business references changed to `INACTIVE`; **4.301** referenced legacy products preserved. No deletion, rename, price, brand, variant, image or inventory changes. Total products remains **5.060**, active products **4.411**, brands **51**.
- Original snapshot SHA-256: `01bd76cc3a7667bb226ebfc484bc16fb79c14adc2f6c4ef23be01f1759bae5d6`. Backup contains 649 products, 1.298 variants/inventory rows and 1.947 images. Post-check confirms all protected catalog, variants/images/inventory/CMS and business-table digests unchanged; only target status/updated_at differs. Additional candidates: **0**.
- Confirmed Flash Sale bugs: Product Detail only searched the first active campaign; client clock decided offer start; Flash Sale links lost variant; reconnect did not immediately reload offers; campaign image selection ignored variant image priority.
- Implemented scoped shared offer-selection/domain checks and corresponding code fixes. Also corrected backend `ENDED` campaigns reappearing as active, refreshed server clock on Redis cache hits, and capped detail purchase quantity by per-customer limit.
- Targeted frontend `flash-sale.test.js` PASS (4 cases in one Node test file). Backend new quality/cache/PostgreSQL pricing suites PASS (**5 tests**); existing order concurrency/inventory/Flash Sale integration PASS (**2 tests**). New pricing fixture including expiry, release and consume runs entirely inside a rollback transaction; persisted fixture products: **0**.
- Real HTTP after repair: newest10 curated, catalog total4.411, category=mice pagination, brands51, quarantined product404, CMS200, FlashSale200: **PASS**. Evidence in `technest-catalog-quality-api-results.json`.
- Targeted frontend/backend ESLint PASS; backend typecheck PASS before final test-extension; repeat final check pending root consolidated regression.

## Files owned by this work

- `backend/scripts/audit-catalog-quality.mjs`
- `backend/src/database/seeds/catalog-quality.ts`
- `backend/src/database/seeds/seed-large.ts` (explicit opt-in for legacy synthetic load fixtures)
- `backend/tests/catalog-quality.test.ts`
- `backend/src/modules/flash-sales/flash-sales.service.ts` (image ordering only)
- `src/domain/flashSale.js`, `tests/flash-sale.test.js`
- `src/pages/ProductDetailPage.jsx`, `src/pages/FlashSalePage.jsx`, `src/components/home/HomeFlashSaleSection.jsx` (offer/variant/reconnect logic only)

## Remaining / coordination

1. Root consolidated frontend build/tests, browser verification and final regression.
2. Browser agent owns CheckoutForm quote-line display/invalidation correction after identifying snapshot rows could disagree with repriced quote subtotal.
3. 4.301 legacy generated models linked to orders/campaigns/inventory history require merchandise review. They remain unchanged rather than being relabeled as genuine models. No automatic authenticity approval.

## Limits

Prices, stock and category illustrations in development fixtures are not verified commercial offers. The audit cannot turn fictional legacy model names into real merchandise; linked records remain for review. No heavy load benchmark, no production access, no commit/push.
