# TechNest UX Optimization Progress

**Ngày cập nhật:** 2026-11-02

**Phạm vi:** Customer Storefront và Admin Dashboard trong repository hiện tại. Giữ nguyên nghiệp vụ và design system.

## Trạng thái

- Phase 1 — Audit source: **Đã rà source theo module, chưa có browser audit**. Đã đọc routing/app state/catalog, trang store, checkout/cart/account, Flash Sale, Admin shell, CMS và các API loading states.
- Phase 2 — Shared interaction states: **Đã cải thiện một phần**. Luồng điều hướng SPA hiện hỗ trợ guard điều hướng chưa lưu; trạng thái submit checkout rõ ràng.
- Phase 3 — Navigation/loading/skeleton: **Đã cải thiện một phần**. Khôi phục scroll theo history, filter URL không tự cuộn lên đầu, skeleton cho Admin route/dashboard/settings/CMS và Flash Sale.
- Phase 4 — Product Listing/Detail: **Đã rà source**. Listing và detail đã có skeleton/error/empty states từ trước; chưa chạy kiểm thử trình duyệt.
- Phase 5 — Cart/Checkout: **Đã rà source và tinh chỉnh phản hồi submit**. Luồng checkout có pending guard và idempotency hiện hữu; chưa browser-tested.
- Phase 6 — Account/Notifications: **Đã cải thiện**. Không tải/poll đơn ở các subsection không dùng; debounce tìm mã đơn; phân biệt loading/empty/error và có retry.
- Phase 7 — Flash Sale/Promotions: **Đã cải thiện**. Đồng hồ chạy độc lập, không cập nhật lại toàn bộ cards mỗi giây; thêm skeleton và retry nội tuyến cho trang Flash Sale.
- Phase 8 — Admin: **Đã cải thiện một phần**. Dashboard/settings/CMS loading skeleton; Admin được tải theo route; Admin table hiện giữ dữ liệu cũ khi refetch.
- Phase 9 — Visual Homepage CMS: **Đã cải thiện**. Chặn điều hướng SPA và Back/Forward khi bản nháp chưa lưu; giữ cảnh báo trước khi rời trang.
- Phase 10 — Responsive/Accessibility: **Đã rà CSS hiện có**, thêm layout skeleton responsive và reduced-motion. Chưa kiểm tra trực tiếp tại từng viewport hoặc screen reader.
- Phase 11 — Performance/code splitting: **Đã đo build output**. Tách Admin khỏi entry bundle.
- Phase 12 — Regression: **PASS**: lint, 32 frontend tests và production build.

## Baseline audit đã xác nhận

- Điều hướng dùng History API và intercept link nội bộ; trước sửa Back/Forward không khôi phục scroll. Filter/pagination listing lưu trên URL.
- Một số API views ban đầu chỉ hiện dòng loading; Admin dashboard/settings/CMS và Flash Sale đã chuyển sang skeleton tương ứng.
- Homepage CMS có đường điều hướng dùng `window.location.assign`; hiện dùng SPA navigation và guard thay đổi chưa lưu.
- Workspace có nhiều thay đổi chưa commit từ trước audit (backend, Flash Sale, checkout, styles và các trang storefront/admin). Những thay đổi đó được giữ nguyên; chỉ sửa phần cần thiết cho UX.

## Files thay đổi trong lượt audit

- `src/routing/useNavigation.js`: lưu vị trí cuộn theo history entry, khôi phục Back/Forward, giữ scroll khi đổi query cùng route và phát navigation guard.
- `src/App.jsx`: tải Admin bundle khi vào route Admin.
- `src/admin/AdminHomepageCms.jsx`: cảnh báo khi rời draft chưa lưu qua SPA/back và giữ điều hướng trong ứng dụng.
- `src/admin/AdminLoadingSkeleton.jsx`, `src/admin/admin.css`, `src/admin/AdminApp.jsx`, `src/admin/AdminSettingsPanel.jsx`: loading skeleton cho dashboard/settings/CMS.
- `src/pages/AccountPage.jsx`: chỉ fetch/poll orders ở overview/order history; debounce search; loading/error/empty/retry đúng trạng thái.
- `src/components/account/AccountNotifications.jsx`: optimistic mark-read/mark-all với rollback khi API lỗi; điều hướng từ notification không chờ request hoàn tất.
- `src/components/home/HomeFlashSaleSection.jsx`: countdown có state cục bộ, không rerender danh sách card từng giây.
- `src/pages/FlashSalePage.jsx`, `src/pages/FlashSalePage.css`: skeleton và retry không reload toàn trang.
- `src/components/store/CheckoutForm.jsx`: pending label và `aria-busy` khi tạo đơn.
- `src/index.css`: style skeleton trang/đơn hàng và trạng thái tải responsive.
- `tests/render.test.js`: xác nhận order detail hiển thị trạng thái loading trước khi API hoàn thành.

Không sửa framework, theme hay business rules.

## Kiểm tra

- `npm run lint`: **PASS**.
- `npm test`: **PASS — 6 test files, 32 tests**.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**.
- Browser E2E/manual checks: **NOT TESTED**.

### Build output đo được

So với số liệu baseline trong `technest-quality-audit.md` (975.18 kB JS / 253.13 kB CSS):

| Asset | Baseline | Sau thay đổi | Ghi chú |
| --- | ---: | ---: | --- |
| Entry JavaScript | 975.18 kB (gzip 246.74 kB) | 750.82 kB (gzip 204.87 kB) | Admin tách thành chunk riêng 251.91 kB (gzip 50.35 kB) |
| Entry CSS | 253.13 kB (gzip 43.53 kB) | 204.61 kB (gzip 36.30 kB) | Admin CSS tách riêng 73.90 kB (gzip 12.74 kB) |

Vite vẫn báo entry JavaScript vượt 500 kB. Đây là build size, không phải benchmark thời gian tải.

## Còn lại / hạn chế

- Cần tiếp tục rà chi tiết từng form/table/modal trên Admin (focus trap, bàn phím, unsaved edits) và các customer routes ngoài những luồng đã chỉnh.
- Chưa có browser E2E trong frontend scripts; responsive/browser behavior và console/image errors không được coi là xác minh.
- Chưa tối ưu chunk entry còn trên 500 kB; cần đo browser/network và tách tiếp dựa trên số liệu.
- Không có performance benchmark HTTP/API/query/Redis trong lượt audit này.

## Bổ sung: danh mục và phân trang Product Listing

- Khắc phục lỗi làm mất query `page` khi bấm phân trang; đổi trang giữ category/brand/sort, đổi bộ lọc thì quay về trang 1.
- Trang category hiện tên danh mục thực tế, tổng số kết quả và phân trang số trang có trạng thái hiện tại, khoảng kết quả và cuộn về đầu danh sách.
- Bộ lọc chuyển sang grid nhất quán và responsive.
- Kiểm tra `category=mice`: API trả 1.012 mục / 43 trang; trang 1 và 2 có sản phẩm khác nhau, giữ đúng danh mục Chuột và danh mục con.
- Frontend tests 6/6, lint và build PASS. Browser E2E chưa chạy.
