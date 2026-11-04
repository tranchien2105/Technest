# Technest Technical SEO progress

**Ngày:** 02/11/2026. Implementation phases 1–10 đã triển khai; báo cáo tại technest-seo-implementation.md.

## Quyết định kiến trúc

- Source gốc: React/Vite CSR, Express API; metadata cố định và SPA fallback không cung cấp HTTP status theo nội dung.
- Đã tích hợp hybrid/progressive public HTML: Express render metadata, JSON-LD và nội dung công khai từ PostgreSQL, React tiếp tục phần tương tác. Response không phân biệt user agent. Đây không phải full App React hydration SSR.
- Vite development dùng cùng service SEO qua middleware. Production phải phục vụ frontend build qua Express, không dùng static SPA fallback hoặc Vite preview cho public hosting.
- URL chuẩn: /products/:slug, /categories/:slug, /brands/:slug. URL ID/query category/brand cũ redirect 308. Lịch sử slug sản phẩm được lưu khi Admin đổi slug kể từ migration 0020.
- Indexing mặc định tắt. Chỉ bật khi NODE_ENV=production, SEO_SITE_URL là HTTPS public origin, SEO_INDEXING_ENABLED=true.

## Files và phases

- Phases 1–2: audit architecture, routing, schema, deployment, seed quality và Google Search Central.
- Phases 3–5: backend/src/modules/seo/*; src/hooks/useSeo.js; canonical/meta/OG/Twitter/JSON-LD và public HTML trước JS. Variant URL đồng bộ giá/metadata và không refetch toàn bộ catalog.
- Phases 6–7: sitemap index + shards 1.000 URL, robots, 404/308, private noindex, API không bị HTML fallback intercept. HTML giá no-store; Flash Sale kiểm tra giờ/quota/tồn kho trực tiếp.
- Phase 8: migrations additive 0019/0020; AdminSeoEditor trong Product/Category/Brand và Settings. Backend dùng existing RBAC + validation/audit. Hai migration đã áp dụng lên technest_dev.
- Phase 9: lazy chunks cho Customer routes và Admin riêng; hero eager/high priority, ảnh list đầu ưu tiên, font preconnect/link thay CSS @import, links sản phẩm crawlable. Main JS 566.59 kB / gzip 163.09, thay vì 786.88 kB / gzip 212.82 baseline gần nhất; chưa đo CWV.
- Phase 10: HTTP source verification trên Vite, tests PostgreSQL rollback + regression, hướng dẫn deployment/Search Console.

## Kiểm chứng dữ liệu

- PostgreSQL development: 5.060 products, 51 brands. Catalog giữ nguyên.
- Chính sách sitemap hiện cho 50 products, 5 categories, 19 brands; loại 5.010 sản phẩm seed/demo/minh họa hoặc thiếu điều kiện.
- Đây là điều kiện kỹ thuật, không phải xác nhận nguồn hàng/giá thương mại của 50 bản ghi còn lại. Phải kiểm tra catalog trước khi bật production indexing.
- Local robots Disallow /, noindex trong HTML/header; /sitemap.xml trả 503 có chủ đích và không chứa localhost URLs.

## Tests / còn lại

- Frontend lint, 6 test files và build PASS.
- Backend full regression: 87 passed, 17 skipped trong lần chạy đầy đủ. SEO focused suite cuối: 19/19 PASS. Backend typecheck/lint/build PASS, policy robots cuối đã kiểm chứng.
- HTTP nguồn thực tế trên Vite 5173 và Express 3000 đã xác nhận metadata, Product JSON-LD, 404, 308 và dev noindex. XML parse 5 sitemap documents: 76 public URLs, 0 duplicate, PASS.
- Chưa browser E2E, Lighthouse, field CWV, Rich Results Test hoặc Search Console. Chưa có production domain được cấu hình; không claim Google đã index.
- Vite vẫn cảnh báo entry chunk >500 kB.

## Hoàn tất

- Hai migration additive đã chạy trên development. Catalog/orders không bị chỉnh sửa trong triển khai SEO.
- Express frontend asset trả HTTP 200 với Cache-Control immutable 1 năm; source HTML và sitemap không dùng cache giá.
- Backend lint/typecheck/build, frontend lint/tests/build và git diff --check PASS.
- Báo cáo: [technest-seo-implementation.md](./technest-seo-implementation.md).

## Local verification — 02/11/2026

- Compiled Express + Vite build chạy loopback 4173; production SEO policy với reserved `.test` origin; PostgreSQL development read-only; không chạy worker nghiệp vụ. `.env` và cổng development giữ nguyên.
- HTTP source: 20 HTML/redirect cases, 9 API cases, sitemap index + 4 shards/76 URL/0 duplicate PASS. Dev port 3000 vẫn noindex, sitemap 503 có chủ đích.
- Phát hiện production same-origin `/api/v1` làm notification socket `new URL()` throw ở module scope; sửa bằng `src/api/apiOrigin.js`, cập nhật hook và thêm regression test.
- Frontend 7 test files PASS; SEO + PostgreSQL rollback 19/19 PASS; build/lint/typecheck đã chạy. Lighthouse và CDP thực chạy bằng Chromium cache, thư viện tạm trong `/tmp`.
- Báo cáo kiểm chứng chi tiết và giới hạn ở `docs/technest-local-seo-audit.md`; JSON evidence `technest-local-seo-*-results.json`. Những ghi chú "chưa Lighthouse/browser" ở phần triển khai phía trên là trạng thái trước phiên kiểm chứng này.
- Hiệu năng lab còn thấp; không claim CWV đạt. Không xác minh Google indexing, public HTTPS/CDN hoặc logged-in Admin/checkout E2E.

## Tiếp tục local verification — 03/11/2026

- Khởi động lại loopback compiled app 4173, PostgreSQL read-only sau WSL restart; HTTP 20 cases + 9 API + sitemap 76 URL PASS mới.
- Sửa Product Detail hai H1: section gợi ý H2, giữ CSS; frontend lint, 7 test files và build PASS; backend lint/typecheck/build, SEO PostgreSQL tests 19/19 PASS.
- Chromium 390/1440: 8 trang PASS; click product/Back đúng pathname. Canonical sau Back chưa được xác nhận; script đã tăng cường chờ, pending rerun.
- Lighthouse phiên trước đã chạy 8 lượt; raw /tmp mất sau restart. Rerun hiện tại bị automatic approval timeout hai lần; báo cáo đánh dấu NOT TESTED sau H1 fix, giữ điểm cũ kèm provenance, không claim CWV.
- Remaining: chạy lại Lighthouse bằng script, kiểm tra canonical Back với verifier đã tăng cường; production HTTPS/CDN/Search Console chưa test.
