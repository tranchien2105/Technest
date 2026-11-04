# Technest — hiệu năng và SEO

Ngày cập nhật: 04/11/2026. Task 1 và 7.

## Đã thực hiện

- Baseline Lighthouse Mobile Homepage thực chạy, raw JSON giữ tại `docs/evidence/performance/before-home-mobile.json`: Performance22, SEO100, LCP22.21s, TBT45.87s, CLS0.118. Có một request catalog500 và cảnh báo CPU calibration; không coi là phép đo sạch/production SLO.
- Xác nhận production build chứa React DEV do `NODE_ENV=development` trong `.env` dùng chung. Build wrapper đặt NODE_ENV cho child process; regression tests và build guard kiểm tra không còn React DEV diagnostic.
- Entry JavaScript cuối từ 566,61 kB về 334,65 kB (giảm 40,9%); gzip theo Vite 102,62 kB. Số đo tốc độ lab và giới hạn được ghi riêng.
- Bỏ request Homepage page3 không sử dụng; giới hạn danh sách deal100→24; giữ server pagination và CMS manual IDs.
- Product Detail render ngay khi API sản phẩm xác nhận; không chờ gợi ý và không chặn mua nếu API gợi ý lỗi.
- Responsive srcset chỉ cho URL Unsplash hiện có; giữ nguyên ảnh upload/SVG/host khác. Hero có dimensions và ảnh ưu tiên; Product Detail CSS tách theo route.
- Chromium cuối xác minh 8 public page/viewport ở 390/1440 và canonical sau cả Back/Forward PASS.
- SEO ảnh/OG/JSON-LD chọn theo variant thực; PostgreSQL fixture test PASS cùng19SEOtests, rollback sau chạy.

## Xác minh cuối

- API timing 7 endpoints × 5 lượt đã lưu; HTTP SEO regression 20 HTML/redirect + 9 API PASS.
- FE lint/12 test files/build PASS; BE lint/typecheck/build PASS, default tests 82 PASS / 35 SKIP và các PostgreSQL suites bật riêng.
- Lighthouse chạy đủ 8 lượt Mobile/Desktop cho 4 trang. SEO100, Best Practices100, Accessibility96–97; Performance Mobile26–52 và Desktop59–75. Raw JSON có thật, không console/HTTP/gatherer errors; giữ cảnh báo CPU WSL.
- Báo cáo tổng: `technest-eight-tasks-report.md`; số đo: `technest-performance-results.json`; SEO audit đã cập nhật.

## Giới hạn

- Môi trường WSL local, không phải field Core Web Vitals/INP.
- Chưa có domain production/Search Console do người dùng chưa cung cấp; runbook chuẩn bị sẵn, không đăng dữ liệu development lênGoogle.
- LCP/CLS còn cao; HTML SEO ban đầu được React thay bằng app, CSS/font chặn render và ảnh LCP được khám phá sau API. Chưa đạt field CWV; cần tối ưu/đo staging tiếp.
