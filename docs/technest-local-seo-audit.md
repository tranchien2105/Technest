# Technest — kiểm chứng Technical SEO trên localhost

**Ngày cập nhật:** 04/11/2026, tiếp tục các lượt kiểm chứng 02–03/11. **Phạm vi:** PostgreSQL `technest_dev`, HTTP loopback và Chromium headless. Các kiểm tra SEO chỉ đọc hoặc rollback fixtures; không deploy, gửi Google hay commit/push. Tác vụ catalog riêng được ghi trong báo cáo 8 công việc.

## 1. Kết luận

**HTML SEO, canonical, JSON-LD, sitemap và HTTP status: PASS trong các trường hợp đã kiểm tra.** Phát hiện và sửa lỗi JavaScript làm storefront không khởi động với API cùng origin `/api/v1`. Không kết luận đạt Core Web Vitals hoặc đã được Google index. Điểm hiệu năng Lighthouse còn thấp; xem số đo và cảnh báo bên dưới.

## 2. Kiến trúc và cấu hình đã audit

- React/Vite dùng `createRoot`, không phải full React SSR/hydration. Express tạo metadata, JSON-LD và nội dung public vào HTML trước JavaScript; React tiếp quản phần tương tác. Không phân biệt Googlebot/người dùng.
- `backend/src/server.ts` gắn `seoStorefrontRouter` sau API. `/api/v1/seo/page` cung cấp metadata cho chuyển trang phía client. `STOREFRONT_DIST` chỉ tới frontend build; production phải đi qua Express, không đặt static SPA fallback trước SEO routes.
- Vite development có middleware SEO gọi Backend. `/robots.txt`, `/sitemap.xml`, `/sitemaps/*` được proxy về Backend; cổng 5173 là development, không dùng làm máy chủ production.
- Metadata/canonical và indexing được quyết định bằng `SEO_SITE_URL`, `SEO_INDEXING_ENABLED`, `NODE_ENV`. Origin enforcement và trust proxy phải cấu hình theo hạ tầng.

### Instance production-like thực tế

- URL: `http://127.0.0.1:4173`.
- Frontend production build: `VITE_API_BASE_URL=/api/v1 npm run build -- --outDir /tmp/technest-local-seo-dist`.
- Backend: `npm run build`, rồi chạy compiled `createApp` qua `backend/scripts/local-seo-server.mjs`.
- Dùng catalog/CMS/inventory/Flash Sale/auth routes thật và PostgreSQL development. Database connection ở chế độ read-only. Redis phục vụ auth rate limiter; không chạy email queue, reservation expiry hoặc các worker nghiệp vụ.
- SEO service dùng policy production, indexing bật **chỉ trong instance loopback thử nghiệm**, origin HTTPS dành riêng kiểm thử `https://seo-validation.example.test`. Không có DNS/deploy cho tên này; đây không phải domain production được đề xuất.
- Đây là compiled app với production SEO policy, **không phải chạy toàn bộ `server.ts` với các worker production**. Giữ nguyên `.env` và server development cũ.

## 3. HTTP source — không phụ thuộc React

Nguồn bằng chứng: `docs/technest-local-seo-http-results.json`; script `scripts/verify-local-seo.mjs`. Các HTML thực nhận được lưu tạm trong `/tmp/technest-local-seo-evidence`.

Mọi URL trong bảng dưới được gọi trực tiếp ở origin loopback 4173. Với bốn trang chính, script xác minh title duy nhất, description, canonical, OG title/description/image, Twitter image, một H1 và JSON-LD ngay trong response; không chạy JavaScript để lấy các giá trị này.

| URL | HTTP | Title trong HTML | Structured data | Kết quả |
| --- | ---: | --- | --- | --- |
| `/` | 200 | Technest \| Công nghệ cho góc làm việc của bạn | Organization, WebSite | PASS |
| `/products/keychron-k2-pro` | 200 | Keychron K2 Pro \| Technest | Product, BreadcrumbList, Offer | PASS |
| `/categories/keyboards` | 200 | Bàn phím \| Technest | CollectionPage, BreadcrumbList | PASS |
| `/brands/keychron` | 200 | KEYCHRON \| Technest | CollectionPage, BreadcrumbList | PASS |
| `/products?page=2` | 200 | Sản phẩm — Trang 2 \| Technest | CollectionPage/Breadcrumb | PASS; self canonical giữ `?page=2` |
| `/products?sort=priceLow` | 200 | Metadata listing | Không dùng làm trang index riêng | PASS; noindex |
| `/products/nonexistent-seo-verification` | 404 | Metadata trang không tìm thấy | Không có Offer | PASS |
| `/categories/nonexistent-seo-verification` | 404 | Metadata trang không tìm thấy | Không có Offer | PASS |
| `/brands/nonexistent-seo-verification` | 404 | Metadata trang không tìm thấy | Không có Offer | PASS |
| `/nonexistent-seo-verification` | 404 | Metadata trang không tìm thấy | Không có Offer | PASS |
| `/flash-sale` | 200 | Metadata Flash Sale | Landing noindex | PASS |
| `/products/1` | 308 | Location `/products/keychron-k2-pro` | — | PASS |
| `/products/keychron-k2-pro/` | 308 | Location bỏ trailing slash | — | PASS |
| `/products?category=keyboards` | 308 | Location `/categories/keyboards` | — | PASS |
| `/index.html` | 308 | Location `/` | — | PASS |

Canonical/OG URL bốn trang chính dùng HTTPS test origin và đúng pathname. Product OG image là ảnh trong database; fallback social image dùng `/seo-social.png`. URL tracking/variant không trở thành canonical riêng. Không trả Homepage HTTP 200 cho URL không tồn tại.

**Unpublished:** sau quarantine an toàn của tác vụ catalog, database có 649 products không ACTIVE. HTTP catalog verifier đã gọi một slug quarantine thực và nhận 404. Bộ test PostgreSQL còn tạo fixture ACTIVE/INACTIVE trong transaction, gửi HTTP qua Express/supertest, xác nhận INACTIVE → 404 và bị loại sitemap; rollback khi kết thúc. Bằng chứng catalog: `technest-catalog-quality-api-results.json`.

## 4. Giá và availability

Sản phẩm đã đối chiếu trực tiếp: **Keychron K2 Pro**, product `1`, variant `1`.

- API variant price: **2.490.000 VND**.
- JSON-LD `Offer.price`: `2490000`, `priceCurrency`: `VND`.
- API `inStock=true`, `availableQuantity=1013` tại lúc kiểm tra; schema `https://schema.org/InStock`.
- Không có active sale cho variant này tại thời điểm kiểm tra; không tự tạo giá giảm.
- **PASS:** giá lấy từ API/catalog, kiểm tra sale bằng PostgreSQL, không hardcode rating/review.
- Test rollback còn xác minh active Flash Sale 800.000 VND, hết hiệu lực/quota/stock, variant khác giá và OutOfStock. Không sửa campaign/stock thật để thử.
- HTML cùng URL nhận bằng User-Agent Googlebot và request thường giống nhau.

Đây là đối chiếu dữ liệu hệ thống, không phải xác minh giá thị trường hay nguồn hàng. Catalog development vẫn chứa dữ liệu biên tập/minh họa; cần duyệt trước khi xuất bản thương mại.

## 5. Robots, sitemap và trang riêng tư

| Kiểm tra | Kết quả thực tế | Đánh giá |
| --- | --- | --- |
| `/robots.txt` trên instance test production | HTTP 200, Allow `/`, Disallow `/api/`, sitemap absolute HTTPS test origin | PASS |
| `/sitemap.xml` | HTTP 200, sitemap index XML | PASS |
| `/sitemaps/pages.xml` | HTTP 200, XML hợp lệ | PASS |
| `/sitemaps/products-1.xml` | HTTP 200, XML hợp lệ | PASS |
| `/sitemaps/categories-1.xml` | HTTP 200, XML hợp lệ | PASS |
| `/sitemaps/brands-1.xml` | HTTP 200, XML hợp lệ | PASS |
| XML parse bằng Python ElementTree | 76 URL public; 0 trùng; mỗi shard ≤1.000 URL | PASS |
| Admin/account/cart/checkout/login trong sitemap | Không có | PASS |
| Các namespace seed/demo bị loại theo policy | Không có URL `catalog-*`, `tn-curated-*` trong sitemap | PASS theo policy hiện tại |
| `/admin`, `/account`, `/checkout`, `/cart`, `/login` | HTTP 200 shell, meta robots và X-Robots-Tag đều noindex, không có private JSON-LD | PASS |
| Backend development `http://localhost:3000` (kiểm chứng 02/11) | HTML/header noindex; robots Disallow `/`; sitemap HTTP 503 có chủ đích | PASS |

Private HTML được để crawler đọc `noindex`; robots không phải cơ chế bảo mật. Admin API không có token trả 401. Không có localhost URL trong XML của instance test. Chưa bật hoặc đăng sitemap lên bất cứ website công khai nào.

## 6. Regression HTTP và trình duyệt

**HTTP PASS:** product list/detail, categories, brands, published Homepage CMS config, banners và Flash Sale trả JSON 200; admin products không token trả JSON 401; API không tồn tại trả JSON 404. Assets được frontend HTML tham chiếu trả 200 đúng MIME và cache immutable. SEO middleware không nuốt API vào SPA HTML.

**Chromium CDP thực chạy lại ngày 04/11: 8 lượt trang PASS** — Homepage/Product/Category/Brand ở 390px và 1440px: có header React, một H1, canonical đúng origin, không exception, không overflow ngang, không ảnh đã tải bị lỗi hoặc HTTP lỗi tại snapshot. Bằng chứng: `docs/technest-local-seo-browser-results.json`. Đây không phải kiểm tra mọi ảnh lazy bên dưới.

Luồng category → click product → browser Back/Forward: kiểm tra canonical đích sau mỗi lần điều hướng. Kết quả thực tế xem `docs/technest-local-seo-browser-results.json`.

Các lượt SEO dùng guest và dữ liệu chỉ đọc. Suite riêng ngày 04/11 dùng auth PostgreSQL trong transaction để kiểm chứng 13 bước COD và 6 kiểm tra Admin; đơn và tài khoản thử được rollback sạch. Chưa kiểm thử Admin publish/CMS bằng browser hoặc thanh toán online; xem `technest-eight-tasks-report.md` để phân biệt phạm vi.

## 7. Lighthouse Mobile/Desktop — đo thực tế

Chạy mới sau sửa build React production, ngày 04/11/2026; raw JSON giữ trong `docs/evidence/performance/after`. Đây là lab WSL, không phải field CWV/INP. Baseline Homepage Mobile 22/100 có React DEV và API 500; không coi là benchmark kiểm soát sạch.

| Trang | Thiết bị | Performance | Accessibility | Best Practices | SEO | LCP (s) | TBT (ms) | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | mobile | 35 | 97 | 100 | 100 | 6.95 | 1668 | 0.137 |
| home | desktop | 66 | 97 | 100 | 100 | 1.72 | 500 | 0.058 |
| product | mobile | 52 | 96 | 100 | 100 | 6.12 | 684 | 0.003 |
| product | desktop | 75 | 96 | 100 | 100 | 1.35 | 97 | 0.372 |
| category | mobile | 48 | 96 | 100 | 100 | 6.09 | 725 | 0.000 |
| category | desktop | 68 | 96 | 100 | 100 | 1.66 | 231 | 0.276 |
| brand | mobile | 26 | 96 | 100 | 100 | 8.33 | 2224 | 0.231 |
| brand | desktop | 59 | 96 | 100 | 100 | 1.63 | 386 | 0.276 |

- home/mobile: The tested device appears to have a slower CPU than  Lighthouse expects. This can negatively affect your performance score. Learn more about [calibrating an appropriate CPU slowdown multiplier](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md#cpu-throttling).
- product/mobile: The tested device appears to have a slower CPU than  Lighthouse expects. This can negatively affect your performance score. Learn more about [calibrating an appropriate CPU slowdown multiplier](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md#cpu-throttling).
- category/mobile: The tested device appears to have a slower CPU than  Lighthouse expects. This can negatively affect your performance score. Learn more about [calibrating an appropriate CPU slowdown multiplier](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md#cpu-throttling).

Bằng chứng: `docs/technest-performance-results.json`. N/A là lỗi gatherer/metric thiếu, không tự chấm PASS.

## 8. Lỗi đã xác nhận và sửa

### FIXED — React crash khi deploy API cùng origin

Lighthouse trước sửa ghi exception `TypeError: Failed to construct 'URL': Invalid URL` tại notification socket bootstrap. `useNotifications.jsx` gọi `new URL(API_BASE)` với `API_BASE=/api/v1` ở module scope, khiến React không khởi động dù source HTML SEO đúng.

- Thêm `src/api/apiOrigin.js` để resolve API URL theo page origin.
- Notification script và socket connection dùng cùng origin đã resolve.
- Thêm regression test cho API relative, absolute và localhost khác port.
- Build lại, kiểm tra browser và Lighthouse sau sửa. Giữ nguyên design system.

### FIXED — Product Detail có hai H1 sau React render

Browser xác nhận tên sản phẩm và “Có thể bạn cũng thích” cùng dùng H1. `PageTitle` hỗ trợ heading cấp 2; hai section gợi ý dùng H2, CSS giữ nguyên kiểu hiển thị. Regression test và Chromium xác nhận Product Detail còn một H1.

### Còn lại / không tự đánh dấu PASS

- **Còn hạn chế hiệu năng lab:** entry bundle sau sửa React production còn 334,65 kB; Lighthouse vẫn báo LCP/CLS/TBT cao. Chưa đạt Core Web Vitals. Progressive HTML được React thay bằng full app góp phần vào nguy cơ layout shift; cần profiling và giải pháp rendering phù hợp trước khi thay kiến trúc.
- Lighthouse có cảnh báo CPU calibration và có lần page-load timeout; máy WSL, network ảnh/font bên ngoài và tải local ảnh hưởng số đo. Các API từng 500 trong lần đo có tải đồng thời đã được gọi lại riêng và trả 200; chưa chứng minh chịu tải ổn định.
- Accessibility chưa đạt 100 ở các trang full React. Không đổi palette/design trong phiên xác minh này.
- Schema validation ở đây là JSON parse, nội dung và HTTP tests; **NOT TESTED** với Google Rich Results Test trực tuyến.
- **NOT TESTED:** HTTPS thật, reverse proxy/CDN, www/non-www, Search Console, Google indexing, ảnh social tại production domain.
- Catalog demo được loại theo marker/điều kiện kỹ thuật; chưa đảm bảo mọi sản phẩm còn lại có dữ liệu thương mại đã xác minh.

## 9. Build và tests

- Frontend production build 04/11: PASS; entry JS **334,65 kB**, gzip theo Vite **102,62 kB**; CSS **196,21 kB**, gzip **35,00 kB**. Entry trước sửa là 566,61 kB. Build guard xác nhận không đóng gói React DEV.
- Frontend lint: PASS.
- Frontend tests cuối: **12/12 files PASS**, gồm API cùng origin, build config, checkout quote, Flash Sale và ảnh responsive.
- Backend build/typecheck/lint: PASS (chạy lại 03/11).
- SEO tests + PostgreSQL integration: **19/19 PASS**, fixture transaction rollback.
- Backend default suite cuối: **82 PASS / 35 SKIP**; test PostgreSQL bật riêng không được coi là pass từ phần skip. Backend build/typecheck/lint PASS.
- HTTP source verifier: **20 HTML/redirect cases + 9 API cases PASS**, XML và frontend assets PASS.
- Lệnh tái hiện từ repo: `node backend/scripts/local-seo-server.mjs`, `node scripts/verify-local-seo.mjs`; cần build frontend vào thư mục tạm nêu trên và backend build trước.
- Development policy: `SEO_VERIFY_BASE=http://localhost:3000 SEO_VERIFY_API=http://localhost:3000/api/v1 node scripts/verify-seo.mjs`.
- Browser: `CHROME_PATH=<chromium> node scripts/verify-local-seo-browser.mjs`; nếu Chromium cần thư viện tạm, bổ sung `LD_LIBRARY_PATH`.
- Browser 04/11: **8 public page/viewport checks + Back + Forward PASS**. Báo cáo riêng xác nhận thêm 13 bước COD, 24 lượt mobile và 6 kiểm tra Admin; xem `technest-eight-tasks-report.md`.
- Lighthouse: `CHROME_PATH=<chromium> npx lighthouse http://127.0.0.1:4173/ --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage' --output=json`; thêm `--preset=desktop` cho Desktop.

## 10. Sau khi deploy production

1. Dùng domain HTTPS thực cho `SEO_SITE_URL`; frontend build `VITE_API_BASE_URL=/api/v1`; phục vụ build qua Express. Thiết lập `SEO_TRUST_PROXY_HOPS` đúng số proxy tin cậy và kiểm tra origin redirect trước khi bật enforce.
2. Staging giữ noindex. Chỉ bật `SEO_INDEXING_ENABLED=true` trên production sau khi duyệt catalog, ảnh, giá, tồn kho và canonical.
3. Chạy lại HTTP HTML/status/sitemap/robots qua public origin và CDN. Kiểm tra response không cache giá Flash Sale sau thời điểm kết thúc.
4. Chạy lại Lighthouse trên môi trường ổn định; profiling LCP/CLS/main-thread work. Đo field CWV bằng dữ liệu người dùng thực trước khi kết luận.
5. Xác minh Google Search Console bằng DNS hoặc verification token cấu hình; submit sitemap index và dùng URL Inspection/Rich Results Test cho mẫu product/category/brand.
6. Kiểm tra 404/unpublished, redirect URL ID/slug cũ, private noindex và xác thực API sau deploy. Không báo Google đã index chỉ vì sitemap trả 200.

## 11. Files thay đổi trong phiên kiểm chứng

- `src/api/apiOrigin.js`, `src/hooks/useNotifications.jsx`, `tests/api-origin.test.js`: sửa API relative bootstrap.
- `src/components/store/PageElements.jsx`, `src/pages/ProductDetailPage.jsx`, `src/index.css`, `src/styles/design-system.css`, `tests/render.test.js`: heading semantics và regression, giữ style.
- `backend/scripts/local-seo-server.mjs`: compiled app local read-only, production-like policy; tùy chọn development policy tại 4174 để tái hiện noindex (tùy chọn mới chưa chạy lại).
- `scripts/verify-local-seo.mjs`, `scripts/verify-local-seo-browser.mjs`, `scripts/run-local-seo-lighthouse.mjs`, `scripts/summarize-local-seo.mjs`: công cụ tái hiện.
- `docs/technest-local-seo-*-results.json`, báo cáo này, `docs/technest-seo-progress.md`: bằng chứng/checkpoint.

Không commit/push hoặc reset database. Các kiểm thử SEO dùng dữ liệu chỉ đọc hoặc transaction rollback. Quarantine catalog thuộc tác vụ kiểm duyệt riêng, có backup/dry-run và bằng chứng tại `technest-catalog-pricing-audit.md`.
