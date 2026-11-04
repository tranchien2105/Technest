# Technest — Runbook triển khai, backup và rollback

Cập nhật: 2026-11-03. Đây là chuẩn bị vận hành; chưa deploy production.

## 1. Phạm vi đã kiểm chứng local

- FE/BE development tiếp tục chạy trên 5173/3000.
- API đã có request ID do server tạo, response lỗi có `requestId`, log có method/path/status/error type và mã PostgreSQL hợp lệ nếu có. Không log query string, token, cookie, mật khẩu hoặc raw exception message.
- `GET /api/v1/health/live`: process còn phục vụ HTTP, không phụ thuộc PostgreSQL/Redis.
- `GET /api/v1/health/ready`: PostgreSQL/Redis truy cập được và process không shutdown; lỗi trả 503, không cache. Endpoint `/health` cũ giữ tương thích.
- Khi nhận SIGTERM/SIGINT, readiness chuyển không sẵn sàng, dừng workers, drain HTTP/socket, đóng pool/Redis. Deadline hiện có là 10 giây.
- Dockerfile có healthcheck gọi readiness. Chưa build/chạy image production trong lượt kiểm tra này; không coi healthcheck container là đã chạy thực tế.

## 2. Trước khi deploy

1. Chốt domain thật, DNS/TLS và reverse proxy; không dùng domain `.test` trong production.
2. Cấu hình secret bên môi trường triển khai: DATABASE_URL, REDIS_URL, AUTH_JWT_SECRET, SMTP credentials, EMAIL_FROM, FRONTEND_URL, CORS_ORIGIN. Không commit `.env`.
3. Đặt `NODE_ENV=production`, `SEO_SITE_URL=https://<domain-thật>`. Giữ `SEO_INDEXING_ENABLED=false` cho staging; chỉ bật production sau khi kiểm duyệt catalog và robots/sitemap.
4. Chỉ đặt số `SEO_TRUST_PROXY_HOPS` đúng topology proxy thực. Bật canonical origin redirect sau khi xác nhận Host/Forwarded headers; kiểm tra không có redirect loop.
5. DB user runtime cần quyền DML phù hợp; dùng migration role riêng cho DDL. Kiểm tra connection limits, timeout và storage.
6. Mount volume uploads bền vững, backup cả DB và uploads. PostgreSQL dump không chứa file ảnh trên volume.
7. Chạy lint/tests/build và smoke test staging. Chạy migration additive trên staging trước khi chuyển traffic. Không chạy seeding development trên production.
8. Chỉ COD theo business rules hiện có; chưa có online payment provider để xác nhận vận hành payment.

## 3. Build và migration

### Không dùng Docker

Từ repository root:

```sh
npm ci
VITE_API_BASE_URL=/api/v1 npm run build
cd backend
npm ci
npm run build
```

Migration dùng output đã build (thư mục migrations phải đi cùng output):

```sh
node dist/database/migrate.js
```

Đặt `STOREFRONT_DIST` trỏ frontend `dist` thật rồi chạy `npm start` trong backend. Reverse proxy chuyển public requests tới Express để HTML SEO, API, assets, robots và sitemap cùng origin. Không phục vụ tất cả route bằng một fallback index.html tĩnh.

### Docker

Dockerfile hiện tạo frontend/backend rồi chạy Node bằng user `node`. Build image gắn tag release bất biến trong pipeline. Migration là một job riêng trước khi chuyển traffic, không chạy tự động trong mỗi replica. Container uploads ở `/public/images/uploads` phải có persistent volume đúng quyền.

Không xem việc Dockerfile tồn tại là bằng chứng image chạy được trên hạ tầng đích. Vẫn cần build/run smoke test tại staging.

## 4. Smoke test sau khi khởi động

Thay `<origin>` bằng origin thật:

```sh
curl --fail-with-body '<origin>/api/v1/health/live'
curl --fail-with-body '<origin>/api/v1/health/ready'
curl -I '<origin>/api/v1/products?limit=1'
curl -I '<origin>/robots.txt'
curl -I '<origin>/sitemap.xml'
```

Tiếp tục kiểm tra raw HTML của homepage/product/category/brand, sản phẩm thiếu trả 404, API thiếu trả JSON 404, Admin/Account/Checkout noindex, assets đúng MIME, cookie secure/TLS, login, COD checkout bằng fixture staging, admin RBAC, CMS published/draft và Flash Sale expiry. Không dùng sản phẩm/đơn hàng khách thật để smoke test.

Giám sát p95 HTTP, số 5xx, thời gian query, PostgreSQL connections/disk, Redis, email outbox retry/failure và worker lag. Request ID từ response giúp đối chiếu log; không gửi token/địa chỉ khách vào ticket công khai.

## 5. Backup và diễn tập restore local

Lệnh mới (từ backend):

```sh
npm run ops:restore:rehearsal
```

Script chỉ chấp nhận NODE_ENV development/test, PostgreSQL loopback và tên DB kết thúc `_dev`/`_test`. Script:

- Mở transaction REPEATABLE READ READ ONLY và export snapshot.
- Chạy `pg_dump --format=custom` theo snapshot qua container PostgreSQL hiện có.
- Archive đặt trong thư mục `/tmp/technest-backup-rehearsal-*` mode 0700, file mode 0600; không đưa dump vào Git.
- Tạo DB `technest_restore_<timestamp>_<random>` hoàn toàn mới, từ chối target tồn tại. Không restore vào DB nguồn.
- Chạy pg_restore `--exit-on-error --no-owner --no-privileges` vào target.
- Đọc target bằng connection mặc định read-only; đối chiếu mọi bảng theo count/checksum, constraints và indexes.
- Ghi báo cáo JSON; giữ lại target/dump để kiểm tra. Script không DROP DB nào.

Kết quả thực chạy lưu tại [technest-backup-restore-results.json](technest-backup-restore-results.json): **PASS**, 32 bảng, 130 constraints, 90 indexes; sản phẩm 5.060, brands 51, variants/inventories mỗi bảng 10.060, orders 2.015, users 122 trong snapshot được so khớp đầy đủ. Thời gian lượt PASS ~60,6 giây; đây là thời gian diễn tập local, không phải SLA/RTO production.

Lượt đầu có count/checksum bảng đúng, nhưng phép so sánh schema báo khác do PostgreSQL parse lại cast varchar/text array trong CHECK. Script đã normalize đúng biểu diễn tương đương đó; giữ log lượt đầu tại [technest-backup-restore-initial-results.json](technest-backup-restore-initial-results.json). Không bỏ qua constraint khác nhau về operator/grouping.

DB target đang giữ:

- `technest_restore_20261103151652_6ee2b7`: lượt đầu.
- `technest_restore_20261103151911_c412f2`: lượt PASS.

Dump có thể chứa dữ liệu cá nhân và password hash development. Giữ quyền truy cập hạn chế; không upload artefact này công khai. `/tmp` không phải kho backup bền vững. Sau khi review, người vận hành có thể dọn chính các target/artifact này theo chính sách retention đã duyệt; không áp dụng thao tác đó lên `technest_dev`.

Đối chiếu ngày 04/11 sau khi môi trường khởi động lại: cả hai DB restore trên vẫn tồn tại, nhưng dump trong `/tmp` không còn. Bằng chứng checksum/restore đã lưu vẫn là kết quả lần chạy thật ngày 03/11; không coi file dump tạm là backup hiện còn tải được. Cần storage bền vững và lịch backup trước production.

### Backup production

Thiết lập lịch backup được mã hóa tới storage riêng, retention, giám sát job thất bại và diễn tập restore định kỳ. Chọn PITR/WAL nếu yêu cầu RPO cần. Sao lưu uploads cùng mốc thời gian phù hợp. Tài khoản, storage, khóa mã hóa, RPO/RTO và lịch retention chưa được cung cấp nên chưa cấu hình hoặc xác nhận trong lượt local này.

Restore luôn vào DB mới trước; kiểm tra bảng, khóa ngoại, migrations, ảnh/media và smoke test app. Chỉ chuyển connection sau phê duyệt kế hoạch cutover. Không restore đè DB đang nhận đơn.

## 6. Rollback release

1. Dừng rollout/chuyển traffic về image release trước, giữ nguyên persistent volumes.
2. Kiểm tra readiness/HTTP/API rồi smoke test các luồng mua hàng. Không tự rollback schema bằng DROP COLUMN/TABLE.
3. Migration additive giữ khả năng chạy code cũ nếu đã xác minh staging; thay đổi không tương thích cần kế hoạch riêng.
4. Nếu sự cố dữ liệu: ngừng các thao tác ghi liên quan, bảo toàn DB/log hiện tại, restore backup vào DB mới và đối soát các đơn phát sinh sau backup trước khi cutover.
5. Không `docker compose down -v`, không reset/truncate DB, không tự xóa đơn hàng/giá/tồn kho để rollback giao diện.
6. Theo dõi lỗi sau rollback và lưu thời điểm release/request IDs. Không đánh dấu thành công chỉ dựa trên process còn chạy.

## 7. Việc phải xác nhận trên production/staging

Domain/TLS/CDN, reverse proxy/WebSocket timeout, resource limits, secret rotation, durable media, backup storage/encryption/retention/PITR, alerting và email provider. Chưa tuyên bố hệ thống sẵn sàng production chỉ từ các test local.
