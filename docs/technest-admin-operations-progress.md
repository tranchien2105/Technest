# TechNest — Admin catalog & operations progress

Ngày: 2026-11-03 (Việt Nam).

## Phạm vi và an toàn

- Task 6: Admin catalog lớn; giữ RBAC/design system.
- Task 8: health/readiness, request tracing, backup/restore vào DB riêng và runbook.
- Workspace có nhiều thay đổi chưa commit; chỉ sửa các vùng đã phối hợp. Không reset/truncate/drop DB hiện tại, không commit/push.

## Audit

- AdminCatalogPanel tải toàn bộ brands qua products/references; trang brands/categories còn lần lượt fetch tất cả trang của cả hai reference lists dù không dùng.
- Filter/page bị mất khi rời panel. Search đang reset page trước khi debounce hoàn tất, dễ phát sinh request với query cũ.
- Backend đã có request ID riêng, log không chứa query string, response lỗi có requestId và che lỗi nội bộ. Không cần tạo lại cơ chế này.
- Health hiện kiểm tra DB/Redis cùng endpoint; thiếu liveness độc lập và trạng thái readiness khi shutdown.

## Đang thực hiện

- Bounded searchable references, lưu filters/page theo session, tránh request khi debounce chưa ổn định.
- Endpoint live/ready + readiness trong shutdown.
- Chuẩn bị backup/restore rehearsal vào DB mới. Chưa chạy thao tác backup/restore tại thời điểm checkpoint.

## Tests / evidence

Chưa chạy trong phase này; chờ baseline Lighthouse hoàn tất để tránh tranh CPU.

## Phase hoàn tất — implementation và kiểm chứng

### Admin catalog

- Thay preload toàn bộ brands/categories bằng `AdminReferencePicker`: tìm kiếm phía server debounce 250 ms, tối đa 30 kết quả UI, API giới hạn 50, AbortController loại kết quả cũ, keyboard Arrow/Enter/Escape và selected-ID lookup.
- Chỉ tải references khi người dùng mở picker. Trang brands không còn tải references; parent-category picker chỉ tìm categories khi mở.
- Lưu search/status/filter/page riêng từng module trong sessionStorage. Khi quay lại giữ trạng thái; dữ liệu storage lỗi reset an toàn.
- Không gửi listing request khi debounce text/giá chưa ổn định. Giữ rows cũ lúc refetch, thêm skeleton lần tải đầu.
- Catalog editor có cảnh báo thay đổi chưa lưu khi đóng/refresh, focus ban đầu/restore/trap, Escape, submit guard đồng bộ và khóa input khi lưu. Không đổi RBAC/business rules.

### Operations

- `/api/v1/health/live` độc lập DB/Redis. `/ready` và endpoint `/health` cũ kiểm tra dependencies và trạng thái shutdown.
- Request ID server hiện có được expose qua CORS; error log bổ sung method/path/status/mã PG an toàn. Không log raw exception, query string, token/password.
- Dockerfile thêm readiness healthcheck; chưa build/run image production.
- Runbook: [technest-production-runbook.md](technest-production-runbook.md).

### Evidence thực tế

- FE targeted ESLint PASS; `tests/admin-catalog-state.test.js` PASS (2 trường hợp logic; Node runner report 1 test file).
- Backend typecheck PASS. Backend HTTP/unit + PostgreSQL admin read suite PASS **24/24** ở lượt chạy sau khi restore xong. Sau lượt đó thêm test server request-ID không tin ID của client và assertions references 401/403; sẽ nằm trong regression tổng cuối.
- Lượt test đầu trong sandbox bị `listen EPERM`; đã chạy lại bằng quyền loopback và không coi lỗi môi trường đó là PASS.
- Lượt Admin concurrent với backup có một stock-query timeout; chạy lại sau backup PASS toàn bộ. Không nâng timeout để che lỗi.
- HTTP thật trên BE development 3000: health/live/ready 200; missing API 404; references chưa đăng nhập 401. Evidence: [technest-operations-http-results.json](technest-operations-http-results.json).
- Backup/restore thực chạy **PASS** vào DB riêng `technest_restore_20261103151911_c412f2`, 32 bảng so khớp count/checksum, 130 constraints và 90 indexes; 1.562.372 bytes, SHA-256 trong [technest-backup-restore-results.json](technest-backup-restore-results.json), ~60,6 giây.
- Snapshot: products 5.060, brands 51, variants/inventories mỗi bảng 10.060, orders 2.015, users 122. Development source chỉ được đọc, không reset/truncate/drop/restore đè.
- Lượt restore đầu giữ riêng tại `technest_restore_20261103151652_6ee2b7`: bảng đúng nhưng raw CHECK definition khác spelling cast; normalize đúng equivalent varchar/text array representation, chạy lại PASS. Evidence lượt đầu được giữ.

### Files của phase này

- FE: `src/admin/AdminCatalogPanel.jsx`, `AdminBulkActions.jsx`, `AdminReferencePicker.jsx`, `catalogListState.js`, appended `admin.css`; `tests/admin-catalog-state.test.js`.
- BE: `src/modules/admin-operations/catalog-references.ts`, `operations.routes.ts`; `src/modules/health/health.routes.ts`, `health.service.ts`; narrow `src/server.ts` readiness, `src/app.ts` CORS; `src/middlewares/error-handler.ts`; `backend/package.json`; `scripts/rehearse-backup-restore.mjs`; `tests/app.test.ts`, `admin.test.ts`, `admin.integration.test.ts`, `catalog-references.test.ts`.
- Ops: Dockerfile readiness line; progress/runbook/JSON evidence.

### Remaining / limitations

- Browser Admin UI kiểm chứng đang phối hợp bằng transactional fixture app; chưa chấm PASS browser cho đến khi chạy thực.
- Chưa deploy production, chưa cấu hình domain/TLS/CDN/alerting/backup storage/PITR/retention; chỉ diễn tập PostgreSQL local, chưa diễn tập media-volume recovery.
- Hai DB restore riêng và dump hạn chế quyền được giữ để review; không DROP database nào.

## Xác minh browser cuối — 04/11/2026

- `scripts/verify-admin-browser.mjs` chạy Chromium thật trên transaction fixture: **6/6 checks PASS**.
- Đăng nhập bằng PostgreSQL auth; không preload toàn bộ references; 4 lần gõ nhanh chỉ có 1 request listing; 50 dòng mỗi trang và không trùng giữa trang 1/2; Back giữ query/page; picker tối đa 30 options và filter server-side; draft được giữ khi từ chối bỏ; 390 px không overflow và không exception.
- Browser audit không có catalog mutation. Fixture rollback sạch, không còn user/product/order thử.
- Evidence: `technest-admin-browser-results.json`, `technest-admin-mobile-fixture-cleanup.json`; screenshots: `docs/screenshots/admin-catalog-*.png`.
- Backend regression tổng cuối: lint/typecheck PASS, **82 tests PASS / 35 skip**. Các test cần listener ban đầu bị sandbox EPERM đã chạy lại với loopback được phép; không ghi lỗi môi trường đó thành pass.
