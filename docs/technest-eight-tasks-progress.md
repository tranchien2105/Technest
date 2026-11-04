# Technest — tiến độ 8 công việc

Cập nhật: 04/11/2026. Giữ design system và thay đổi chưa commit; không commit/push, không reset database.

| Task | Phạm vi | Trạng thái |
| --- | --- | --- |
| 1 | Hiệu năng Homepage/Product Detail, Lighthouse trước/sau | Đã sửa build/data flow và đo 8 lượt thật; mobile performance vẫn cần tối ưu thêm |
| 2 | Kiểm duyệt toàn catalog, backup/dry-run/corrections có provenance | Đã audit, backup, dry-run và quarantine 649 record an toàn; 4.301 record có nghiệp vụ cần duyệt hàng hóa |
| 3 | Browser E2E COD, lỗi tồn kho/double-submit | PASS 13/13 bước browser thực; fixture rollback sạch |
| 4 | Mobile 360/390/768, ảnh và sửa lỗi xác nhận | PASS 24/24 trang sau sửa; screenshots lưu trong evidence |
| 5 | Giá/Flash Sale xuyên card/detail/cart/checkout/order | Domain, PostgreSQL và checkout browser đã xác minh |
| 6 | Admin catalog lớn, search/filter/pagination/dropdown | PASS 6 kiểm tra browser; filter/pagination PostgreSQL và RBAC đã kiểm tra |
| 7 | SEO Back/Forward, schema/social/Lighthouse mới/deploy checklist | HTTP và 10 kiểm tra browser PASS; 8 lượt Lighthouse SEO 100; chưa có production/Search Console |
| 8 | Health/readiness/request IDs/logs, backup/restore DB riêng, runbook | Đã triển khai và diễn tập restore DB riêng PASS |

## Checkpoints theo phần

- `technest-browser-mobile-progress.md`
- `technest-catalog-pricing-progress.md`
- `technest-admin-operations-progress.md`
- Báo cáo tổng sẽ ghi tests, files, evidence và hạn chế sau kiểm chứng.

## Baseline

- Dev FE5173/BE3000 hoạt động; build production-like read-only 4173 phục vụ SEO measurements.
- Entry JS khoảng566.60kB, CSS201.43kB từ phiên kiểm chứng trước. Sẽ build và đo lại.
- Catalog theo checkpoint trước:5060 products,51brands; không dùng count cũ làm xác nhận mới.
- Lighthouse cũ không được dùng để tuyên bố cải thiện; tạo raw evidence mới trong docs/evidence/performance.

## Checkpoint kỹ thuật

- Task 1: `.env` dùng chung đã khiến Vite đóng gói React DEV. Build wrapper đặt production trong child process và guard phát hiện runtime DEV. Bản audit API cùng origin có entry JS 334,65 kB / gzip 102,62 kB; baseline 566,61 kB. Bỏ request page 3 không dùng, deal limit 100→24, render detail trước recommendations, responsive ảnh và CSS theo route.
- Task 2: 649 fixture legacy có provenance và không có tham chiếu được chuyển `INACTIVE`, có backup/dry-run. Giữ nguyên 4.301 record được bảo vệ. Tổng 5.060 products / 51 brands không đổi.
- Task 3/4: browser thật xác nhận 13 bước COD và 24 lượt mobile. Fixture dùng PostgreSQL transaction, rollback về 0 user/product/order thử. Sau nhiều suite reload phải dùng fixture riêng để không cộng dồn rate-limit kiểm thử.
- Task 6: Admin browser xác nhận search debounce, hai trang không trùng, Back giữ query/page, brand picker giới hạn 30, cảnh báo draft và không overflow ở 390 px. Không ghi catalog trong lượt browser.
- Task 7: 8 trang public và canonical sau Back/Forward PASS. HTTP HTML/schema/robots/sitemap/API PASS. Ảnh SEO chọn đúng variant, PostgreSQL regression đã pass.
- Task 8: restore thật sang DB riêng so khớp 32 bảng, 130 constraints và 90 indexes. Runbook và evidence đã lưu.
- Regression: FE lint và 12/12 file test PASS; FE/BE build PASS. BE lint/typecheck PASS; default tests 82 pass / 35 skip sau khi chạy với quyền loopback. Các suite PostgreSQL được chạy riêng, không tính phần skip là pass.
- Bàn giao: báo cáo `technest-eight-tasks-report.md`. FE5173/BE3000 đã bật lại và HTTP kiểm tra thật PASS; PostgreSQL/Redis/Mailpit development healthy. Các giới hạn catalog, hiệu năng và production được ghi trong báo cáo, không tự đánh dấu đạt CWV hoặc đã được Google index.
