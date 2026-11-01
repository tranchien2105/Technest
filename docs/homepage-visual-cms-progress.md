# Homepage Visual CMS Progress

## Phase hiện tại

Đã triển khai nền tảng CMS, API draft/publish và Admin Visual Homepage editor. Migration đã áp dụng vào development DB; public API và Admin guest guard đã được gọi thực tế.

## Audit & hoàn thành

- Homepage component ở `src/pages/HomePage.jsx` dùng Catalog API cho sản phẩm/danh mục nhưng nhiều heading/CTA vẫn lấy nội dung tĩnh từ `src/data/storeContent.js`.
- Banner public được đọc qua `GET /api/v1/banners/active` trong hook banner; Admin List/placement CRUD dùng `/api/v1/admin/banners` và `/api/v1/admin/banners/placements`.
- Placements thực tế: `HOME_HERO` (slider), `HOME_HERO_RIGHT_TOP`, `HOME_HERO_RIGHT_BOTTOM`, `HOME_SETUP_STUDIO`, `HOME_PROMO`, `HOME_BOTTOM`. Hero là 1 slider chính + 2 thẻ bên phải; các vùng có capacity/ordering riêng trong Banner Management.
- Admin banner route giữ visual preview + list CRUD hiện có. Banner placement save cập nhật bảng cũ và Homepage fetch lại qua API; schema cũ không hỗ trợ CMS text/draft.
- Role middleware chung cho phép STAFF có scope; CMS endpoints khóa riêng role `ADMIN`.
- Ảnh hiện nằm dưới dạng URL/path trong database: external image URLs, frontend assets và `/images/uploads/...` do backend static upload phục vụ. Không có thay đổi storage.

## Files đã đổi trong phase này

- Backend: schema `homepage_cms`, migration `0014_homepage_cms.sql`, module `homepage-cms` (Zod, public/admin routes), route wiring và migration journal.
- Frontend: hook public config, admin API methods, route `/admin/homepage`, editor/preview dùng HomePage thật, các section áp dụng copy/visibility/filter/limit CMS, CSS editor.

## Hoàn thành

- Bản nháp và bản public được lưu riêng trong PostgreSQL; migration khởi tạo cả hai bằng nội dung mặc định tương thích trang hiện tại, dùng `ON CONFLICT DO NOTHING`.
- Public API chỉ trả `published`; admin GET đọc draft/published; PATCH lưu draft; POST publish sao chép draft sang public sau validation.
- Announcement, danh mục, featured/deals/trending/new arrivals và các section hiện có có cấu hình hiển thị; một số section hỗ trợ tiêu đề/mô tả/CTA/limit; danh mục và sản phẩm cụ thể được chọn từ dữ liệu API hiện có.
- Admin preview nhúng HomePage thật; desktop/mobile width preview, click section để chỉnh, click banner điều hướng về Visual Banner Management.
- Product prices/stock/discount eligibility và nội dung sản phẩm vẫn do Catalog API quản lý.
- Editor click được announcement, section và các `data-banner-placement` trên Homepage thật; click banner mở Banner Management đúng placement. Có danh sách chọn vùng để chỉnh cả section đang ẩn.
- CMS có thể chỉnh tiêu đề/eyebrow/mô tả/CTA trên các section hiện có, ẩn/hiện section, giới hạn số sản phẩm/banner, lọc category và chọn product IDs từ danh sách API đã tải.

## Tests

- Frontend `npm run lint`: pass; `npm test`: 6/6 pass; `npm run build`: pass (cảnh báo chunk bundle > 500 kB).
- Backend `npm run lint`, `npm run typecheck`, `npm run build`: pass.
- Full Backend Vitest: 13 files passed, 4 skipped; 59 tests passed, 10 skipped.
- CMS schema/migration validation: 4/4 tests pass, gồm kiểm tra payload khởi tạo migration qua Zod.
- Migration `0014_homepage_cms.sql`: applied successfully.
- `GET /api/v1/homepage/config`: trả cấu hình published thành công.
- `GET /api/v1/admin/homepage` không token: `401 UNAUTHENTICATED`.

## Việc còn lại / known issues

- Cần đăng nhập bằng tài khoản ADMIN trong browser để kiểm tra thao tác Save Draft/Publish end-to-end.
- `sectionOrder` hiện được áp dụng vào thứ tự render Homepage; Admin có thể đổi thứ tự các section, trong khi Hero vẫn cố định trước các section và danh mục được giữ ngay sau Hero theo bố cục hiện hữu.
- Cấu hình sản phẩm nổi bật hỗ trợ lọc brand/category, chọn sản phẩm và sắp xếp theo đề xuất/mới nhất/giá; Catalog request lấy tối đa 24 bản ghi và UI vẫn giữ số lượng mặc định cũ.
- Mobile editor hiện là preview ở khung 390px dùng component HomePage trong DOM quản trị. Media queries của trình duyệt vẫn dựa trên viewport ngoài, nên chưa thể khẳng định đây là mô phỏng mobile hoàn toàn chính xác; cần kiểm tra/hoàn thiện bằng browser viewport thật.
- Promotions section vẫn dùng business data/logic hiện hữu; chưa có module campaign API tổng quát để chọn campaign từ CMS.
- Chưa có browser automation trong môi trường này; không tuyên bố đã kiểm thử trực quan.

## Phase bổ sung sau audit nghiệm thu

- Files bổ sung: `backend/src/modules/homepage-cms/homepage-cms.schemas.ts`, `src/pages/HomePage.jsx`, `src/admin/AdminHomepageCms.jsx`, `src/hooks/useCatalog.js`.
- Hoàn thành: section ordering áp dụng trên Homepage; brand filter và sort trong khu vực sản phẩm nổi bật; tăng số sản phẩm Catalog được lấy để tùy chỉnh limit trong phạm vi schema mà không đổi số mặc định hiển thị.
- Kiểm thử sau thay đổi: Frontend lint/build/tests pass; Backend lint/typecheck/build và CMS tests pass.
- Remaining: kiểm tra trực quan desktop/mobile và Save Draft/Publish qua browser bằng tài khoản ADMIN.
- Known issue: mobile preview khung 390px chưa thay đổi viewport media-query thực của trình duyệt.
- Next step: chạy Browser automation ở viewport desktop và mobile khi môi trường được trang bị browser.

## Phase editable visual cards và banner choices

- Files changed: `backend/src/modules/homepage-cms/homepage-cms.schemas.ts`, `backend/src/database/migrations/0015_homepage_visual_cards.sql`, migration journal, `backend/src/database/seeds/seed-incremental.ts`, `src/admin/AdminHomepageCms.jsx`, `src/admin/admin.css`, `src/components/home/StyleSection.jsx`, `src/components/home/FeatureBanner.jsx`.
- Completed: ba thẻ WORK/PLAY/LISTEN có thể chỉnh nhãn, tiêu đề tiếng Việt/Anh, mô tả hai ngôn ngữ, ảnh và category đích; banner ảnh lớn có thể đổi URL ảnh trong Admin CMS. Draft chỉ tác động preview; public tiếp tục dùng published config đến khi publish.
- Migration 0015 giữ nguyên giá trị đã chỉnh, chỉ thêm các trường này nếu đang thiếu.
- Seed: batch `VISCMS1` thêm 60 lựa chọn banner mới, đúng 10 lựa chọn cho mỗi 6 placement (`HOME_HERO`, hai hero side, `HOME_PROMO`, `HOME_BOTTOM`, `HOME_SETUP_STUDIO`). Các banner mới để inactive để không đổi nội dung Homepage ngay; Admin có thể chọn và bật qua Banner Management.
- Database verify sau seed: `store_banners=190`; placement totals lần lượt 44, 20, 20, 43, 43, 20; integrity `invalid_banner_dates=0`, `currently_visible_banners=22`.
- Idempotency: chạy lại đúng batch `VISCMS1` thêm 0 records.
- Tests: Frontend lint/build + 6/6 tests pass; Backend lint/typecheck/build + full tests 13 files/59 pass/10 skipped; Homepage CMS tests sau bổ sung 6/6 pass.
- Remaining: cần đăng nhập Admin kiểm tra trực quan thao tác preview/publish; chưa có browser automation.

## Bổ sung affordance cho banner giới thiệu lớn

- Lý do: người quản trị khó nhận ra khối ảnh lớn có thể click để mở editor.
- Đã thêm nút nổi “Chỉnh sửa banner này” chỉ xuất hiện trong chế độ Edit của Admin Preview; nút chọn trực tiếp section `feature-banner` và side panel chứa eyebrow/title/description/CTA/image URL.
- Nút và editing UI không render trên Customer Homepage hoặc chế độ Preview.

## Fix CMS preview bị tràn ngang

- Preview desktop dùng khung canvas theo chiều rộng Homepage chuẩn 1440px rồi scale theo chiều rộng panel; chiều cao canvas bám theo nội dung, bỏ thanh cuộn ngang gây cắt Header.
- Preview mobile dùng canvas 390px và scale vừa khung.
- Frontend lint, test, build pass; `/admin/homepage` trả HTTP 200. Chưa có browser automation để xác nhận trực quan.
