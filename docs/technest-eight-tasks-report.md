# Technest — kết quả 8 công việc

Cập nhật ngày 04/11/2026, giờ Việt Nam. Đã triển khai cả 8 hạng mục trên source và PostgreSQL development local. Giữ design system; không commit/push hoặc reset database. Đây là kiểm chứng local, chưa phải phê duyệt triển khai production.

## 1. Kết quả theo công việc

| Công việc | Thay đổi và kết quả thực tế | Bằng chứng |
| --- | --- | --- |
| 1. Hiệu năng | Sửa Vite đóng gói React DEV do NODE_ENV trong .env dùng chung; build guard chặn tái phát. Bỏ request không dùng, giới hạn deal list, detail không chờ recommendations, ảnh responsive và CSS theo route. Có 8 lượt Lighthouse sau sửa; mobile còn cần tối ưu. | [Performance](technest-performance-results.json) |
| 2. Chất lượng catalog | Audit 5.060 products / 51 brands. Backup + dry-run + provenance + foreign-key checks; 649 fixture không có quan hệ nghiệp vụ chuyển INACTIVE. Giữ nguyên 4.301 fixture được bảo vệ và dữ liệu gốc. Không xóa record. | [Catalog audit](technest-catalog-pricing-audit.md) |
| 3. Mua hàng browser | 13/13 bước PASS: login, keyboard search, variant/sold-out, cart refresh, validation, quote, double-submit, gateway503 sau khi tạo đơn, retry cùng key, history và stock conflict. | [COD browser](technest-purchase-browser-results.json) |
| 4. Mobile | 24/24 lượt trang PASS ở 360/390/768 px. Tập control được đo không dưới 44 px; text input không dưới 16 px; CTA không bị che. | [Mobile](technest-mobile-after-results.json), [screenshots](evidence/mobile-after/) |
| 5. Giá / Flash Sale | Campaign/variant đúng, server clock, expiry/terminal status, reconnect refetch, bỏ response cũ, ảnh variant, giới hạn mỗi khách. Checkout quote cập nhật cùng lúc đơn giá/tổng; đổi voucher invalidates quote. Backend xác nhận cuối. | [Pricing PostgreSQL](technest-pricing-flash-sale-results.json) |
| 6. Admin catalog lớn | Bounded searchable reference picker (30), debounce, filters/pagination, giữ query/page, pending/unsaved draft. 6/6 kiểm tra browser PASS, không ghi catalog trong audit. | [Admin browser](technest-admin-browser-results.json), [screenshots](screenshots/) |
| 7. SEO | Raw HTTP HTML, status/redirect, robots/sitemap/schema/OG đúng dữ liệu; ảnh SEO theo variant. 10 kiểm tra browser PASS gồm Back/Forward canonical. 8 lượt Lighthouse SEO100. | [SEO audit](technest-local-seo-audit.md) |
| 8. Vận hành | Liveness độc lập dependency, readiness theo DB/Redis/shutdown, request IDs và log an toàn. Restore thật sang DB riêng đối chiếu 32 bảng, 130 constraints, 90 indexes. Runbook đã viết. | [Restore evidence](technest-backup-restore-results.json), [runbook](technest-production-runbook.md) |

## 2. Bundle và Lighthouse

Entry JS: **566,61 → 334,65 kB**, giảm **40.9%** theo byte thực. Gzip theo output Vite: **163,09 → 102,62 kB**. CSS entry: **201,43 → 196,21 kB**; các route Admin/Detail/Account/Setup vẫn được tách riêng. Gzip trong JSON performance được tính bằng Node gzipSync nên có thể khác nhẹ output Vite.

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

Baseline Homepage Mobile: Performance22, LCP22,21s, TBT45.865ms, CLS0,118. Lượt sau: Performance35, LCP6,95s, TBT1.668ms, CLS0,137. Baseline chứa React DEV và có API500; các lượt sau có cảnh báo CPU WSL và phụ thuộc ảnh/font bên ngoài. Không suy diễn đây là mức tăng tốc production có kiểm soát hoặc đã đạt field CWV/INP. CLS Mobile Homepage chưa tốt hơn baseline.

Audit Lighthouse còn chỉ ra render-blocking CSS/font, LCP image chỉ được khám phá sau JS/API và layout shift khi HTML SEO ban đầu được React thay bằng app. Cần profiling/rendering phù hợp, compression/CDN và đo lại trên staging ổn định. Không thêm preload đoán ảnh hoặc thay kiến trúc lớn trong lượt kiểm chứng này.

Raw reports: [before](evidence/performance/before-home-mobile.json), [after](evidence/performance/after/). Các lượt cuối không ghi HTTP4xx/5xx hoặc console error trong báo cáo Lighthouse; warnings/gatherer errors được giữ trong JSON, không xóa để nâng điểm.

API timing tuần tự nhỏ: 7 endpoints × 5 lượt, median khoảng28–212ms. Đây không phải load test hoặc p95 production: [API evidence](technest-api-timing-results.json).

## 3. Kiểm chứng và cô lập dữ liệu

| Kiểm tra | Kết quả |
| --- | --- |
| FE lint | PASS trên source cuối; scoped lint lại các browser/report scripts sau chỉnh harness PASS |
| FE tests | 12/12 test files PASS |
| FE build | PASS, production React guard PASS, audit build API cùng origin |
| BE lint / typecheck / build | PASS; typecheck và fixture lint chạy lại sau chỉnh stock fault PASS |
| BE default suite | 82 PASS / 35 SKIP; skip thuộc các DB suites bật bằng flag, không tính là pass |
| SEO + PostgreSQL | 19/19 PASS, rollback fixtures |
| Catalog/cache/pricing PostgreSQL | 5/5 PASS; order integration hiện có 2/2 PASS |
| Admin/health/filter PostgreSQL | Lượt targeted24/24 PASS; assertions requestID/RBAC bổ sung nằm trong default regression cuối |
| SEO HTTP | 20 HTML/redirect cases + 9 API cases PASS; sitemap XML 76 URL, 0 duplicate |
| SEO browser | 10 kiểm tra PASS, 390/1440 px, Back/Forward |
| Admin browser | 6 checks PASS |
| Mobile browser | 24 lượt PASS, không exception |
| COD browser | 13 bước PASS, không exception |
| Rollback cuối | PASS: 0 user / 0 product / 0 order thử còn lại |
| FE/BE development sau khởi động | HTTP thật 5173:200, live/ready:200, Admin chưa login:401, API thiếu:404 |

Lượt default backend đầu bị sandbox chặn listener (EPERM); chạy lại với quyền loopback và pass. Browser harness từng phải sửa focus khi gửi phím, so sánh tên brand không phân biệt hoa/thường và stock fault theo absolute quantity. Lượt nhiều suite reload chạm rate-limit fixture; COD cuối dùng fixture riêng. Những lượt lỗi được chẩn đoán trước khi chấm PASS; không sửa logic auth/stock production để né test.

Fixture dùng auth/catalog/order/inventory PostgreSQL thật trong outer transaction; không chạy email worker, không gửi email. Lỗi503 được chèn sau khi service tạo đơn thật để kiểm tra tình huống mất xác nhận. Browser device emulation không thay thế Safari/iOS hoặc thiết bị thật. PG client có warning về query đồng thời trên connection fixture; cần serialize harness khi nâng pg9, không phải lỗi assert của production API.

## 4. Source chính đã sửa trong 8 tác vụ

- Build/performance: package.json; scripts/build-frontend.mjs, check-production-build.mjs, summarize-performance.mjs, measure-storefront-api.mjs; useCatalog.js; ProductImage.jsx; responsiveImage.js; HeroSection.jsx; HomePage.jsx; ProductDetailPage.jsx.
- Catalog/pricing: backend/scripts/audit-catalog-quality.mjs; seeds/catalog-quality.ts, seed-large.ts; flash-sales.service.ts; domain/flashSale.js; HomeFlashSaleSection.jsx; FlashSalePage.jsx; pricing/quality/cache tests.
- Checkout/mobile: CheckoutForm.jsx; CheckoutPage.jsx; useCheckout.js; domain/checkoutQuote.js; mobile-interactions.css; main.jsx; Header/AnnouncementBar/Footer/FloatingActions.jsx; browser harness và tests quote.
- Admin/ops: AdminCatalogPanel.jsx; AdminBulkActions.jsx; AdminReferencePicker.jsx; catalogListState.js; admin.css; catalog-references.ts; operations.routes.ts; health routes/service; app.ts; server.ts; error-handler.ts; restore rehearsal; Dockerfile healthcheck.
- SEO: seo.service.ts và SEO PostgreSQL tests; browser/HTTP/Lighthouse verifiers; báo cáo và evidence.

Workspace có nhiều thay đổi có sẵn từ các phiên trước; danh sách trên mô tả phần việc của lượt 8 task, không tự nhận toàn bộ git diff là thay đổi mới.

## 5. Giới hạn cần xử lý trước production

1. **4.301 model legacy có quan hệ nghiệp vụ vẫn cần duyệt hàng hóa**. Structural checks pass không chứng nhận tên/model, giá thị trường hoặc ảnh đúng model. Không tự xóa/đổi chúng vì có lịch sử orders/campaign/CMS.
2. **Mobile performance vẫn thấp** và CLS/LCP cần xử lý tiếp. Chưa có field CWV/INP hoặc tải staging đại diện.
3. Chưa có domain/TLS/CDN/Search Console/Rich Results live. SEO100 Lighthouse không chứng minh Google đã index.
4. Backup restore đã chạy thật; hai DB restore vẫn tồn tại khi kiểm tra04/11. Dump trong /tmp đã mất sau khi môi trường khởi động lại; cần backup storage bền vững, retention và lịch restore. Catalog quarantine snapshot vẫn có trong repository để review local.
5. Chưa build/run Docker image ở hạ tầng đích, chưa diễn tập media-volume restore hoặc cấu hình alerting/PITR. Runbook ghi rõ các bước còn lại.
6. Browser reconnect/expiry Flash Sale ở thời gian thực trên một campaign đang chạy chưa được kiểm chứng E2E riêng; domain và PostgreSQL boundary/expiry/release đã pass. Không tự gộp chúng thành browser PASS.

## 6. Môi trường bàn giao

- Storefront development: http://localhost:5173/
- Backend development: http://localhost:3000/api/v1
- Mailpit local: http://localhost:8025/
- Production-like SEO audit read-only: http://127.0.0.1:4173/ (canonical .test dành cho kiểm chứng, không phải domain triển khai).
- PostgreSQL/Redis/Mailpit đã khởi động từ các container development hiện có, giữ volumes.
- [Services HTTP evidence](technest-final-local-services.json), [tiến độ](technest-eight-tasks-progress.md).
