# Technest — UI refinement progress

## Hướng thiết kế đang áp dụng

Yêu cầu mới “Full website UI refinement inspired by CellphoneS” thay thế hoàn toàn hướng brutalist cũ. Không còn yêu cầu góc 0px, viền đen dày hay shadow cứng.

- Giữ thương hiệu Technest, cam `#ff5a00`, màu chữ và semantic colors hiện có.
- Bo card/panel 8px, controls 6px, badge 4px, dropdown/dialog 10px.
- Border 1px `#e5e7eb`; shadow-card 0 2px 8px/6%, hover 0 4px 14px/10%, dropdown 0 6px 20px/10%.
- Heading 700, tên sản phẩm 600, giá 700–800, nav 600, body 400–500, labels 500–600.
- Không đổi API, dữ liệu, ảnh, xác thực, nghiệp vụ; không reset/commit/push.
- Giữ FE và BE chạy cuối công việc. Thử âm thanh một lần khi hoàn thành/dừng vì lỗi.

## Tham khảo thực tế

Đã mở CellphoneS bằng Chromium và đọc các trang public bằng web tool:
- Homepage: https://cellphones.com.vn/ — ảnh quan sát tại `/tmp/technest-cellphones-reference.png`.
- Catalog: https://cellphones.com.vn/man-hinh.html
- Product detail: https://cellphones.com.vn/man-hinh-lg-ultragear-27g411a-b-27-inch.html
- Cart: https://cellphones.com.vn/cart/

Tham khảo cách tổ chức header/search, khung nội dung khoảng 1200px, hero/promos, section theo mục đích, tên hai dòng, phân cấp giá và bộ lọc. Không dùng logo/ảnh/nội dung thương mại của nguồn tham khảo trong Technest.

## Audit route thực tế — 28 mẫu route

| Nhóm | Routes / trạng thái đã tìm thấy | Tiến độ |
| --- | --- | --- |
| Home | `/` với hero, categories, featured, trending, deals, style, new arrivals, brands, feature banner, services | AUDITED |
| Catalog | `/products`, `/search`, `/products/:id`; category/brand/search/filter là query state trên catalog | AUDITED |
| Mua sắm khác | `/favorites`, `/compare`, `/setup`, `/cart` | AUDITED |
| Checkout / Orders | `/checkout`, `/order-success/:id`, `/account/orders`, `/account/orders/:id` với tracking và history | AUDITED |
| Auth | `/login`, `/register`, `/forgot-password` | AUDITED |
| Account | `/account`, `/account/profile`, `/account/addresses`, `/account/security` với đổi mật khẩu và sessions | AUDITED |
| Store fallback | `*` → NotFound | AUDITED |
| Admin | `/admin`, `/admin/products`, `/admin/categories`, `/admin/brands`, `/admin/inventory`, `/admin/orders`, `/admin/customers`, `/admin/*` fallback | AUDITED |

28 mẫu trên bao gồm fallback; đăng nhập admin và các gate là trạng thái của layout admin, chi tiết đơn admin nằm inline trên Orders.

Chưa có route Reset Password hoặc Admin Settings riêng. Admin Products/Categories/Brands hiện hiển thị Unavailable từ source; refactor style cả các trạng thái này, không thêm chức năng mới.

## Checkpoint hiện tại

- [x] Khôi phục trạng thái sau lần ngắt và đọc lại các thay đổi chưa commit.
- [x] Nghiên cứu nguồn tham khảo, rà lại 28 mẫu route từ audit trước.
- [x] Thay token brutalist bằng radius/border/shadow và typography của e-commerce.
- [x] Refine ProductCard: ảnh contain, tên hai dòng, giá trước mô tả, controls gọn; giữ mọi handler/dữ liệu.
- [x] Homepage: container 1200px, rút spacing, hero/promos/categories gọn, rail 5/4/2 sản phẩm theo viewport. Khi featured chỉ có hai sản phẩm, chuyển thành hai card ngang trên desktop bằng CSS, không thêm hoặc lặp dữ liệu.
- [x] Áp dụng shared system cho Catalog/Detail/Auth/Account/Checkout/Orders/Admin, giữ cấu trúc route và chức năng hiện có.
- [x] Browser verification: 32 route/trạng thái × desktop 1440px và mobile 390px = 64 lượt; không tràn ngang, lỗi JavaScript, hard shadow hoặc lỗi radius/border tại các surfaces chính.
- [x] Tìm kiếm (dropdown/Escape/submit), yêu thích, thêm giỏ, focus form, login Admin riêng, menu mobile Customer/Admin và mở/đóng chi tiết đơn Admin đều pass. Contrast mẫu Home/Checkout/Admin đã kiểm tra lại bằng parser hỗ trợ CSS color(srgb), không còn lỗi ở chữ được đo; bỏ qua nội dung trên ảnh và dấu chấm logo.
- [x] `npm run lint`, `npm run build`, `npm test` (4/4 test files) và `git diff --check` đều đạt. Build còn cảnh báo chunk JS khoảng 700kB.
- [x] FE localhost:5173 và BE localhost:3000 trả HTTP 200.
- [x] Đã gọi PowerShell Speech một lần, exit code 0; không xác minh được âm thanh thực tế từ trình duyệt.

## Cách kiểm tra và giới hạn

- Catalog trong browser đọc API local thật. Các trang riêng tư dùng browser fixture/interception để quan sát đủ trạng thái CUSTOMER/ADMIN mà không sửa tài khoản/database.
- Các trang Admin Products/Categories/Brands hiện chỉ có Unavailable được giữ và refine style; chưa tạo chức năng mới. Reset Password và Admin Settings chưa có route riêng.
- Browser native prompt/confirm của Inventory và popup hệ điều hành của select vẫn do trình duyệt vẽ.
- `src/App.css` là starter không được import; 4 stylesheet đang dùng và shared design system mới mới là phạm vi runtime.
- Các kết quả browser trước lần đổi hướng không được tính là pass cho thiết kế mới. Bộ kiểm tra mới đã xác minh radius nhẹ, border subtle, shadow có blur và không có hard shadow.

## Kết quả kiểm tra bổ sung

- Home được chụp lại ở 320/390/768/1440px sau thay đổi cuối; không tràn ngang. Catalog mobile và featured hai sản phẩm đã xem lại bằng ảnh.
- Báo cáo gọn lưu tại `docs/ui-style-refactor-verification.json`. Ảnh và báo cáo browser đầy đủ ở `/tmp/technest-commerce-audit/` (tạm thời, có thể mất sau restart).
- CartDrawer không nằm trong navigation hiện tại; đã mount riêng và kiểm tra thành công hiển thị/đóng trên mobile. Phát hiện và sửa lớp phủ bị sticky header che nút đóng (z-index 120). Build sau sửa đạt.

## Trạng thái bàn giao

Đã hoàn tất visual refinement cho 28 mẫu route hiện có; 64 lượt route/state browser pass, 8 nhóm kiểm tra tương tác pass (bao gồm drawer mount riêng), responsive Home 320/390/768/1440 không tràn. Không thay nghiệp vụ/API/database/auth trong đợt UI refinement. Chưa kiểm thử giao dịch thực hoặc gửi email thật ở đợt này; private route dùng fixture.

## Admin list refinement — 2026-10-31

Yêu cầu mới: sửa giao diện Admin, ảnh sản phẩm, thêm bộ lọc và chọn 50/100/200/500 bản ghi mỗi trang.

Đã triển khai:

- Shared `AdminPagination`, `AdminPageSize`, `AdminStatusBadge` và hook lưu số dòng theo từng danh sách. Bộ chọn số dòng đặt trên đầu bảng; thanh cuối hiển thị khoảng kết quả và điều hướng đầu/trước/sau/cuối. Mặc định 50, đổi bộ lọc/số dòng sẽ trở về trang 1.
- Products: tìm tên/slug/SKU/thương hiệu; trạng thái; danh mục (gồm danh mục con); thương hiệu; còn/sắp hết/hết hàng; khoảng giá; sắp xếp mới/cũ/tên/giá. Tính SKU và available bằng truy vấn server, không lọc trên dữ liệu của riêng trang đang mở.
- Categories: tìm kiếm, đã/chưa có sản phẩm trực tiếp, cấp gốc/con. Brands: tìm kiếm và đã/chưa có sản phẩm. Customers: tìm kiếm và hoạt động/đã khóa. Inventory: tìm tên/SKU, trạng thái phiên bản, tình trạng kho. Orders: tìm mã/tên/email/SĐT, trạng thái, thanh toán, ngày tạo theo múi giờ Việt Nam, sắp xếp.
- Sáu danh sách trên và lịch sử biến động kho hỗ trợ limit đến 500. Customer Orders và public catalog giữ giới hạn hiện có.
- Sửa cấu trúc bảng Products: thêm th Thao tác, chuyển flex/grid vào div trong td, thống nhất thumbnail, giá, badge, button và chiều rộng cột. Khung bảng cuộn bên trong khi nhiều hàng; mobile cuộn ngang trong bảng, không làm tràn cả trang.
- Sửa nguồn ảnh Admin: chọn ảnh base/primary theo sort_order và ID thay vì min(URL). Dùng ProductImage có fallback trên catalog/dashboard/chi tiết đơn.
- Phát hiện 9 SVG malformed do dấu & trong title. Đã sửa 9 asset thuộc audio, audio-interfaces, headphone-dacs và mã hóa XML trong hàm tạo ảnh của seed-large.ts. Không chạy seed lại, không thay dữ liệu DB.
- Chuẩn hóa filter labels, button/icon, bộ chọn số dòng, sidebar sticky và bố cục chi tiết đơn hàng.

Xác minh đã đạt:

- Backend toàn bộ: 53 passed, 2 skipped theo cấu hình, chạy tối đa 2 worker. Sau thay đổi lọc danh mục cha/con, 6 bài PostgreSQL integration chạy lại đạt.
- Kiểm tra browser trên 8 trang (overview, products, categories, brands, inventory, orders, customers, settings) ở 390/768/1440px; Products thêm 1280/1920px. Không tràn ngang viewport, số cột header/body khớp, controls đồng chiều cao.
- Chọn 100/200/500/50 trên từng danh sách trong sáu danh sách, số hàng hiển thị khớp số hàng API và tổng kết quả. Kiểm tra 200 vẫn giữ sau reload.
- Browser tương tác: lọc tồn kho, xóa lọc, sort, mở editor sản phẩm, mở/đóng chi tiết đơn và khách hàng, lịch sử kho, menu mobile, fallback ảnh, căn giữa icon.
- XML parse và browser decode toàn bộ 180 SVG trong public/images/catalog-illustrations: 0 lỗi sau sửa.
- Browser dùng phiên ADMIN giả lập và server tạm chỉ GET, đọc PostgreSQL thật. Không thao tác lưu/xóa/đổi trạng thái trong đợt kiểm tra giao diện này.
- Ảnh kiểm tra và chi tiết browser tại /tmp/technest-admin-refinement/ (tạm thời).

Lint/build cuối: frontend lint/build đạt; backend typecheck/lint/build đạt. Frontend vẫn có cảnh báo chunk JS khoảng 800 kB (build thành công). Server audit tạm đã đóng. Frontend /admin/products trả HTTP 200; backend health báo PostgreSQL và Redis up. Không commit/push; FE/BE dev được giữ chạy.

## Product editor — structured specifications (2026-10-31)

- Đã thay textarea JSON cho sản phẩm và từng SKU bằng trình sửa tên thông số / giá trị, có thêm/xóa dòng và nhóm lồng nhau. Màu sắc, bảo hành, ghi chú, thứ tự phiên bản… có nhãn tiếng Việt.
- Kiểu dữ liệu cũ (số, boolean, null, danh sách và object lồng nhau) được giữ khi không thay đổi. Metadata dataset/seedKey/seedOrdinal/categoryLabel được giữ tự động, không đưa vào form nhập của người dùng.
- Chặn tên thông số trống/trùng và giá trị số không hợp lệ để tránh ghi đè hoặc mất dữ liệu.
- Mỗi phiên bản có card, các ô giá/trạng thái và nhóm thông số riêng. Trạng thái hiển thị tiếng Việt.
- Gallery có preview, ô đường dẫn/mô tả từng ảnh, thêm/xóa/đổi thứ tự và nhãn ảnh đại diện. Preview chờ khi người dùng dừng gõ để giảm yêu cầu tải ảnh.
- API validation chấp nhận ảnh local /images/... đang có trong dữ liệu, cùng HTTP/HTTPS; từ chối traversal và nguồn không hỗ trợ. Không đổi schema database.
- Frontend unit tests đạt, gồm 5 tình huống mới bảo vệ round-trip, metadata, kiểu dữ liệu, tên trùng và xóa dòng. Admin API tests 4/4 đạt.
- Browser 1440px/390px: thêm/sửa/xóa thông số, sửa SKU, đổi thứ tự/mô tả ảnh, tạo form mới và kiểm tra payload lưu đạt; không còn ô JSON, không tràn ngang dialog. PATCH được mock trong browser audit, không ghi dữ liệu thật. Ảnh và báo cáo: /tmp/technest-admin-refinement/structured-editor*.
- Frontend build đạt (cảnh báo bundle lớn hiện có). Backend lint/build và lint frontend cuối đều đạt. FE/BE dev giữ chạy, không commit/push.
