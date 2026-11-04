# TechNest Full System Quality Audit

**Ngày audit:** 2026-11-02

**Phạm vi:** source tại workspace và PostgreSQL development local. Không kết nối hoặc chạy tải trên production.

## Kết luận triển khai

**Mức sẵn sàng: Chưa nên triển khai production cho đến khi hoàn tất kiểm thử trên staging và xác nhận cấu hình vận hành.** Các test tự động đang bật đều xanh; checkout/inventory/Flash Sale đã được xác minh trên PostgreSQL local. Tuy vậy, chưa có browser E2E hoặc đo tải HTTP, các test auth chưa chạy với repository PostgreSQL thật, và hệ thống hiện chỉ có COD, không có payment provider/callback để audit.

Migration 0017_flash_sales trước đó chưa có trên database development. Hai test PostgreSQL đặt đơn đã lỗi vì thiếu các cột flash_sale_* . Đã áp dụng migration additive trên database local đã xác nhận là development; không có bảng nào bị xóa hoặc truncate. Production/staging vẫn cần migration trước khi chạy code này.

## Modules đã kiểm tra

| Nhóm | Modules |
| --- | --- |
| Customer | Homepage/CMS sections, catalog/list/detail, search/filter, compare, favorites, cart, checkout, order history/detail/cancel, account/profile/address/session/password, notifications, auth, Flash Sale |
| Admin | Dashboard/reports, catalog/products/variants, inventory, orders/statuses, customers, staff/RBAC, settings, vouchers/promotions, banners/homepage CMS, notifications, email operations, Flash Sale campaigns |
| Backend | Express app/middleware, Zod validation, Auth/JWT/session rotation, PostgreSQL/Drizzle schema+migrations, Redis use, inventory reservations, order transactions/idempotency, notification/email outbox, Socket.IO/SSE, Flash Sale reservation lifecycle |
| Frontend | Route/page source, API clients, form states, cart/checkout domain code, shared styles, production build output |

## Test cases và kết quả

### Tự động hóa

| Kiểm tra | Kết quả | Ghi chú |
| --- | --- | --- |
| Frontend npm test | **PASS — 6/6 test files** | Node test suite |
| Frontend npm run lint | **PASS** | ESLint trên frontend |
| Frontend npm run build | **PASS** | Build production thành công |
| Backend test suite + PostgreSQL integration | **PASS — 18 files, 77/77 tests** | Chạy với DB development local và các cờ integration bên dưới |
| Backend typecheck | **PASS** | tsc --noEmit |
| Backend npm run lint | **PASS** | ESLint trên backend |
| git diff --check | **PASS** | Không có whitespace errors |

Backend test run bật RUN_ORDER_DB_TESTS=1, INVENTORY_DB_TESTS=1, RUN_NOTIFICATION_DB_TESTS=1, RUN_ADMIN_DB_READ_TESTS=1, và RUN_ADMIN_OPS_DB_TESTS=1. Các fixture dùng dữ liệu tạm hoặc transaction rollback; không chạy email delivery test.

Coverage đáng chú ý:

- Auth route/validation, Argon2 hashing, JWT expiry, refresh rotation/reuse, CSRF double-submit, logout và blocked account: **PASS**. Repository trong test auth hiện là in-memory fixture, không phải PostgreSQL.
- Orders trên PostgreSQL: ownership/IDOR, idempotency replay, competing checkout, inventory reservation, status transitions, cancellation, notifications và email outbox: **PASS**.
- Inventory trên PostgreSQL: idempotency, reserve/release/confirm/expire và 10 yêu cầu cạnh tranh cho lượng tồn giới hạn: **PASS**.
- Flash Sale trên PostgreSQL: hai checkout đồng thời cho quota 1, chỉ một đơn giữ được suất; xác nhận snapshot giá, inventory hold, idempotent replay và chuyển RESERVED sang CONSUMED khi giao hàng: **PASS**.
- Flash Sale admin RBAC trên PostgreSQL: customer bị từ chối, staff có flash-sales:read đọc được nhưng không ghi được; direct lookup campaign DRAFT bị ẩn: **PASS**.
- Admin operations trên PostgreSQL: voucher checkout/redeem/release, bulk edit idempotency, staff operations và audit: **PASS**.
- Admin PostgreSQL read APIs và notifications recipient scoping/deduplication: **PASS**.
- Flash Sale schema validation và kiểm tra không lộ campaign DRAFT/CANCELLED qua public ID: **PASS**.

### Chưa kiểm thử

| Hạng mục | Trạng thái | Lý do |
| --- | --- | --- |
| Payment provider, webhook/callback, late success/refund | **NOT TESTED / NOT IMPLEMENTED** | Source checkout hiện dùng COD; không tìm thấy payment provider hoặc callback lifecycle |
| Browser E2E cho toàn bộ customer/admin routes | **NOT TESTED** | Workspace không có Playwright/Cypress suite được cấu hình trong scripts |
| Manual responsive/browser accessibility, console errors, broken images | **NOT TESTED** | Chưa chạy phiên browser qua các viewport hoặc asset crawler |
| API p50/p95/p99 latency và HTTP load test | **NOT TESTED** | Không chạy server benchmark; tránh tải không cần thiết trên WSL |
| PostgreSQL EXPLAIN ANALYZE/slow-query profiling và Redis hit-rate | **NOT TESTED** | Chưa đo trên workload staging đại diện |
| Email SMTP delivery thực tế | **NOT TESTED** | Test email delivery riêng cần Mailpit local; không chạy trong audit này |
| Admin Flash Sale sửa/hủy campaign và kiểm tra xung đột trên PostgreSQL | **NOT TESTED** | Đã test schema, tạo campaign, RBAC và checkout/reservation; chưa có test tích hợp cho toàn bộ create/update/cancel matrix |

## Bugs và sửa chữa

| Mức | Phát hiện | Xử lý |
| --- | --- | --- |
| Medium | GET /api/v1/flash-sales/:id trả chi tiết campaign DRAFT/CANCELLED nếu biết ID, dù public listing đã ẩn chúng | Đã đổi direct lookup thành 404 cho hai trạng thái này; có test hồi quy |
| High — môi trường | PostgreSQL development thiếu migration 0017_flash_sales, làm checkout/order integration lỗi vì thiếu cột snapshot Flash Sale | Đã áp dụng migration additive lên database local và chạy lại toàn bộ DB integration suite thành công. Cần áp dụng tương ứng trên staging/production trước deploy |
| Medium — coverage | Chưa có PostgreSQL concurrency test xuyên suốt Flash Sale checkout/reservation | Đã thêm và chạy test PostgreSQL thật: 2 buyer cạnh tranh một quota, kiểm tra chỉ một winner cùng giá snapshot, idempotency và consume lifecycle |

Không thấy lỗi khác đủ bằng chứng để sửa trong phạm vi audit. Đây không phải chứng nhận bảo mật hoặc hiệu năng toàn diện.

## Security findings

- **Authentication:** access JWT xác minh theo HS256; refresh token lưu hash trong DB, refresh rotation được serialize, reuse có xử lý thu hồi session. Refresh cookie HttpOnly, Secure khi production, SameSite cấu hình được. Refresh/logout yêu cầu double-submit CSRF token.
- **Authorization/RBAC:** admin routes có authenticate + permission middleware; customer order detail/cancel và notification/address/session thao tác được scope theo user. Các test ownership và admin denial hiện có đều pass.
- **Rate limiting:** Redis rate limit áp dụng cho auth và một số thao tác nhạy cảm. Khi Redis lỗi, endpoint rate-limited fail closed với 503. Chưa xác nhận limit toàn diện cho checkout hoặc mọi admin write.
- **Checkout pricing:** giá/order totals lấy từ catalog và Flash Sale trong transaction backend; client không gửi unit price. Voucher stacking với Flash Sale bị chặn. DB inventory/Flash Sale quota là nguồn quyết định.
- **SQL injection:** code đọc được dùng Drizzle parameterized expressions cho truy vấn có input; không thấy raw query ghép trực tiếp dữ liệu người dùng trong các đường đi đã review.
- **XSS/sensitive data:** React render text theo escaping mặc định; không thấy dangerouslySetInnerHTML trong source scan. Logger có redaction cho trường credential. Đây là static review, chưa có DAST/SAST scan.
- **Rủi ro callback:** chưa có payment integration để xử lý signature verification, replay, callback idempotency hoặc thành công sau khi reservation hết hạn. Không được coi phần payments là đã an toàn.

## Backend và dữ liệu

- Checkout khóa hàng inventory theo variant trong transaction và dùng conditional updates cho stock/quota; idempotency key được lưu với request hash. Test PostgreSQL concurrency xác nhận không oversell trong các fixture đã chạy.
- Tiền dùng integer/bigint VND; snapshots Flash Sale nằm trong order item. Database có check constraints cho giá, quota, reservation/sold totals và campaign date range.
- Các danh sách lịch sử có phân trang; nhiều API dùng count + page query. Chưa đo query plan/slow queries.
- Flash Sale public/admin campaign listing thực hiện thêm truy vấn theo campaign (campaign item/detail, revenue/orders); có thể tăng query count khi nhiều campaign. Cần đo và tối ưu nếu campaign volume lớn.
- Redis cache Flash Sale public có TTL 2 giây; PostgreSQL vẫn là nguồn sự thật. Redis không được dùng làm quota counter.

## Performance metrics thực đo

Production frontend build:

| Asset | Kích thước | Gzip |
| --- | ---: | ---: |
| JavaScript bundle chính | 975.18 kB | 246.74 kB |
| CSS | 253.13 kB | 43.53 kB |
| HTML | 0.72 kB | 0.45 kB |

Vite phát cảnh báo JavaScript chunk lớn hơn 500 kB. Đây là chỉ số build, không đại diện cho thời gian tải thực tế trên thiết bị/mạng khách hàng. HTTP API latency, image latency và frontend render time chưa được đo.

## Ưu tiên tiếp theo

1. Chạy migration trên staging, sau đó thực hiện smoke test và payment/order reconciliation theo chính sách COD đang dùng.
2. Nếu bổ sung payment provider, triển khai và audit webhook signature/replay/idempotency/late-payment handling trước khi bật online payment.
3. Bổ sung browser E2E cho đăng ký/đăng nhập, cart→checkout→order history, admin RBAC và Flash Sale mobile/desktop.
4. Đo API p95, query plans, Redis cache hit-rate và image performance trên staging với tải đại diện; chỉ tối ưu bundle/chunk hoặc campaign query khi số đo chỉ ra bottleneck.
