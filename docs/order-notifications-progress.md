# Thông báo cập nhật đơn hàng — 2026-11-01

Đã hoàn tất:
- Header trên toàn Storefront lắng nghe cập nhật đơn cho tài khoản đang đăng nhập, bao gồm Home.
- Chuông hiển thị số chưa đọc, danh sách cập nhật, đọc tất cả và liên kết tới chi tiết đơn.
- Thông báo nổi 9 giây có nút xem đơn; lịch sử tối đa 50 sự kiện được lưu localStorage riêng theo user ID trên trình duyệt hiện tại.
- SSE đọc payload JSON, bỏ qua sự kiện hỏng, heartbeat và chống hiển thị lặp.
- Tự kết nối lại khi mất mạng; refresh token khi kết nối trả 401; dừng khi component rời trang/đăng xuất.
- Vòng đời subscription Backend gắn với response đóng, dọn heartbeat và listener khi ngắt kết nối.

Giới hạn: đây là thông báo trong website cho sự kiện nhận khi đang mở Storefront. Không phải Web Push khi đã đóng trình duyệt, không đồng bộ lịch sử thông báo giữa thiết bị, không backfill sự kiện lúc offline.

Kiểm tra:
- Frontend 32/32 tests đạt, gồm parser và stream refresh/reconnect/cleanup.
- Backend live SSE regression test đạt: hai tài khoản chỉ nhận sự kiện của mình; đóng kết nối dọn subscription.
- Playwright trên Home nhận sự kiện qua router SSE thật với auth fixture; không cập nhật đơn hoặc gửi email khách hàng thật.
- Kiểm tra popup, unread counter, chống lặp, đọc tất cả, lưu lại sau F5; responsive 390/768/1280/1440/1920px đạt.
- FE/BE lint và build đạt; FE vẫn còn cảnh báo kích thước bundle >500 kB.
