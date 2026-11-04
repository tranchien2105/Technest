# Technest — Browser E2E và Mobile UX

**Ngày:** 03/11/2026. **Phạm vi:** Chromium headless + PostgreSQL development loopback. Không deploy, không gửi email, không commit/push.

## Tiến độ

- Đã audit auth, giỏ hàng, checkout, orders, fixtures PostgreSQL, header search, floating actions và responsive CSS.
- Đã xây máy chủ E2E riêng `127.0.0.1:4175`. Mọi user/session/product/variant/inventory/order/address test nằm trong **một transaction PostgreSQL**, kết thúc luôn rollback. Không dùng tài khoản khách thật; không sửa sản phẩm cũ. Chỉ local `technest_dev` được phép.
- Đã chạy baseline Chromium cho 8 trang tại 360/390/768px (**24 snapshots**). Không tràn document; phát hiện quantity/pagination targets dưới 44px, inputs 11–14px và mascot che góc CTA Cart.
- Đã thêm CSS mobile riêng: targets tối thiểu 44px, input 16px để tránh Safari tự zoom, pagination wrap, ẩn floating helpers trên mobile Cart/Checkout; giữ design system.
- Đã sửa Header combobox và keyboard ArrowUp/ArrowDown/Enter, announcement copies `inert`, accessible names khớp nhãn hiện trên giao diện.
- Đã sửa khóa submit từ trước API lưu địa chỉ, nhớ địa chỉ vừa lưu khi retry; quote price rows dùng đúng variant + Flash Sale item, invalidation theo cart/voucher.

## Bằng chứng ban đầu

- Browser thực login → search → variant sold-out → đổi variant/giá → quantity → thêm giỏ → refresh Cart → required validation đều PASS.
- Thử cắt socket sau order creation: Chromium tự retry POST với cùng idempotency key; PostgreSQL vẫn chỉ có 1 order. Test đã đổi thành gateway503 có kiểm soát sau order creation để bắt lỗi/retry UI một cách xác định.
- Hai transaction thử đầu đã rollback; xác nhận fixture users/products/orders còn 0.
- `docs/technest-mobile-before-results.json`: số đo targets/input và snapshots baseline.
- Ảnh tạm `/tmp/technest-mobile-before`; ảnh không được đưa vào bundle.

## Files sở hữu trong phiên

- `backend/scripts/browser-e2e-server.ts`, một dòng include trong `backend/tsconfig.json` để lint/typecheck fixtures.
- `scripts/browser-cdp.mjs`, `scripts/verify-purchase-browser.mjs`, `scripts/verify-mobile-browser.mjs`.
- `src/styles/mobile-interactions.css`, import trong `src/main.jsx`.
- `src/components/layout/{Header,AnnouncementBar,Footer,FloatingActions}.jsx`.
- `src/components/store/CheckoutForm.jsx`, `src/pages/CheckoutPage.jsx`, `src/hooks/useCheckout.js`.
- `src/domain/checkoutQuote.js`, `tests/checkout-quote.test.js` và các reports mới.

## Còn lại trước kết luận

- Build/lint/tests sau fixes.
- Chạy lại purchase E2E với gateway503, double-submit, lưu địa chỉ, retry idempotency, order history, stock error.
- Chromium mobile after 24 snapshots + input/target/CTA checks.
- Browser keyboard autocomplete assertions.
- Rollback final transaction và xác nhận không còn fixture records.

## Giới hạn

- Device emulation Chromium không thay thế Safari/iOS hoặc thiết bị vật lý.
- Metadata endpoint test riêng chỉ noindex scaffolding; không dùng để chấm SEO production.
- Auth rate limiter dùng in-memory riêng; auth/password/JWT/session và order/inventory repositories dùng PostgreSQL thật.
- Không chạy worker; email outbox có thể được tạo trong transaction nhưng không gửi và rollback cùng fixtures.

## Xác minh cuối — 04/11/2026

- FE lint, 12/12 test files và production build PASS. Bản browser dùng `VITE_API_BASE_URL=/api/v1`; cấu hình dev `localhost:3000` không được dùng cho server fixture 4175.
- Chromium 130: **13/13 bước COD PASS**, gồm autocomplete keyboard, sold-out variant, cart refresh, required fields, repricing, invalidation quote, double-submit, gateway 503 sau khi tạo đơn, retry cùng key, một địa chỉ, một COD order, history và stock conflict. Evidence: `technest-purchase-browser-results.json`.
- **24/24 lượt trang PASS** ở 360/390/768 px; không document overflow, CTA detail không bị che, không control dưới 44 px hoặc text input dưới 16 px trong tập selector đã đo. Evidence: `technest-mobile-after-results.json`.
- Screenshots được giữ tại `docs/evidence/mobile-after/` và `docs/evidence/purchase-browser/`. Đã xem screenshot checkout mobile trực tiếp.
- Final fixture đã rollback: **0 user, 0 product, 0 order thử tồn tại**. Evidence: `technest-browser-fixture-cleanup.json`; fixture Admin/mobile trước đó: `technest-admin-mobile-fixture-cleanup.json`.
- Sửa setup test: focus input trước khi gửi phím CDP; stock fault dùng `adjustStock` với số lượng tuyệt đối và assert fault thành công. Lượt chạy cộng dồn nhiều reload từng chạm rate-limit của fixture; lượt COD cuối dùng fixture riêng. Không thay rate-limit hoặc logic tồn kho production để làm test pass.
- Chromium dependencies được tải và giải nén trong `/tmp/technest-browser-deps`, không cài package hệ thống.
