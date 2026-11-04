# Báo cáo khắc phục dữ liệu seed chất lượng thấp

**Ngày:** 02/11/2026

**Database:** technest_dev (PostgreSQL development local)

**Phạm vi:** chỉ lô tn-large-20261102 được nhận diện bằng marker attributes.seedBatch trên products và prefix slug chính xác trên brands.

## Kết quả xử lý

- Đã backup toàn bộ bản ghi mục tiêu và metadata liên quan trước khi xóa. Backup local: `docs/technest-low-quality-seed-backup.json` (~5.46 MiB, Git-ignored; không công khai snapshot database).
- Đã lập dry-run với ID sản phẩm, slug thương hiệu và kiểm tra khóa ngoại trước khi thực thi: [technest-low-quality-seed-dry-run.json](./technest-low-quality-seed-dry-run.json). Thao tác giới hạn theo danh sách này và backup; không dựa riêng vào tên hoặc ngày tạo.
- Lô kém chất lượng đã dọn: **2.000 products, 2.000 brands, 4.000 variants, 4.000 ảnh, 4.000 inventory rows**. Không có order/order item, Flash Sale, inventory movement/reservation hay CMS reference tới lô đó.
- Dữ liệu cũ được giữ nguyên và đối chiếu hash trước/sau: **5.000 products, 50 brands, 10.000 variants, 15.000 images, 10.000 inventory rows, 2.014 orders, 5.019 order items**. Tất cả count và digest khớp.
- Bộ thay thế có **60 products**, thêm **1 brand ELGATO**; tổng DB hiện có **5.060 products, 51 brands**, 10.060 variants/inventory rows, 15.060 images. Trong bộ mới, **32 brand** hiện có hoặc mới thêm được liên kết với sản phẩm.
- Seed theo batch 20; lần chạy xác nhận cuối cùng: **0 sản phẩm mới được chèn** (idempotent), 0 lỗi. Lần chèn ban đầu mất khoảng 0,77 giây; lần xác nhận idempotency mất 3,78 giây.
- Lô cũ biến mất hoàn toàn: old_bad_products=0, old_bad_brands=0.

## Chất lượng dữ liệu và kiểm tra DB

| Kiểm tra | Kết quả |
|---|---:|
| Product có brand/category hợp lệ | PASS — không orphan |
| Giá <= 0 | PASS — 0 |
| Thiếu ảnh, biến thể bán được hoặc tồn khả dụng | PASS — 0 |
| SKU/slug sản phẩm trùng | PASS — 0 |
| Tên product trùng trong bộ curated | PASS — 0 |
| Slug/tên brand trùng | PASS — 0 |
| Product thuộc lô bị gắn vào order/Flash Sale | PASS — 0 |
| Dữ liệu cũ theo snapshot | PASS — count và digest khớp tất cả bảng đã nêu |

Có 60 sản phẩm chia theo danh mục cụ thể; 12 màn hình, 12 bàn phím, 12 chuột, 4 audio chung, 3 tai nghe true wireless, 2 tai nghe gaming và các nhóm phụ kiện/thiết bị họp/streaming/lưu trữ/mạng còn lại. Danh sách đầy đủ và kết quả truy vấn nằm trong [technest-seed-quality-repair.json](./technest-seed-quality-repair.json).

### 30 thương hiệu mẫu

1. ACER
2. ANKER
3. APPLE
4. ASUS
5. AUDIO-TECHNICA
6. BASEUS
7. BENQ
8. BOSE
9. COOLER MASTER
10. CORSAIR
11. DELL
12. ELGATO
13. GIGABYTE
14. HYPERX
15. JBL
16. KEYCHRON
17. KINGSTON
18. LENOVO
19. LG
20. LOGITECH
21. MARSHALL
22. MICROSOFT
23. RAZER
24. SAMSUNG
25. SANDISK
26. SENNHEISER
27. SHURE
28. SONY
29. STEELSERIES
30. TP-LINK

### 30 sản phẩm mẫu

1. RAZER — Razer Basilisk V3 Pro
2. RAZER — Razer Viper V3 Pro
3. LOGITECH — Logitech G Pro X Superlight 2
4. LOGITECH — Logitech G502 X Lightspeed
5. LOGITECH — Logitech MX Anywhere 3S
6. LOGITECH — Logitech G502 X Plus
7. LOGITECH — Logitech G915 X
8. COOLER MASTER — Cooler Master CK720
9. HYPERX — HyperX Alloy Origins Core
10. ASUS — ASUS ROG Strix Scope II 96 Wireless
11. MICROSOFT — Microsoft Designer Compact Keyboard
12. CORSAIR — Corsair K70 RGB Pro
13. STEELSERIES — SteelSeries Apex 7
14. RAZER — Razer Huntsman V3 Pro TKL
15. KEYCHRON — Keychron Q3 Max
16. KEYCHRON — Keychron V1 Max
17. LOGITECH — Logitech MX Keys S
18. LOGITECH — Logitech G Pro X TKL LIGHTSPEED
19. LENOVO — Lenovo ThinkVision P27h-30
20. ACER — Acer Nitro XV272U
21. GIGABYTE — GIGABYTE M27Q
22. BENQ — BenQ PD2705U
23. ASUS — ASUS ROG Swift PG32UCDM
24. ASUS — ASUS ROG Swift OLED PG27AQDM
25. LG — LG UltraGear 27GR95QE
26. LG — LG UltraGear 32GS95UE
27. SAMSUNG — Samsung Odyssey G6 27
28. SAMSUNG — Samsung Odyssey G7 32
29. DELL — Dell UltraSharp U2724D
30. DELL — Dell UltraSharp U3223QE

## Ảnh và nội dung mẫu

Bộ mới dùng 14 hình minh họa SVG cục bộ theo loại sản phẩm (màn hình, bàn phím, chuột, âm thanh, webcam, lưu trữ, hub, thiết bị streaming...). Ảnh và alt text ghi rõ đây là **minh họa danh mục, không phải ảnh model thực tế**; không dùng một ảnh cho mọi mặt hàng và không tải ảnh ngoài. Giá/tồn kho là dữ liệu development, được ghi rõ trong mô tả/attributes. Một số model có URL nguồn chính thức; fixture không tuyên bố thông số chưa kiểm tra.

## Homepage và storefront

- New Arrivals API trả sản phẩm curated mới nhất; 8 sản phẩm đầu gồm Apple USB-C Digital AV Multiport Adapter, Elgato Stream Deck MK.2, Logitech MX Brio, Kingston XS1000, SanDisk Extreme Portable SSD, Samsung T7 Shield, TP-Link Deco X50 và TP-Link Archer AX55.
- Homepage render thực tế bằng React SSR: 8 New Arrivals, 8 Featured, **24 ID khác nhau** giữa section được kiểm tra; 14 ảnh minh họa trả HTTP thành công.
- Featured tự động có nhóm sản phẩm khác với New Arrivals. Cấu hình CMS thủ công giữ nguyên; không đổi Flash Sale hoặc Promotions.
- Brand API trả brand có thật, phân trang; ELGATO được liên kết với Stream Deck.
- Kiểm tra là API + SSR trên môi trường dev, **không phải browser E2E/manual QA**.

## Thay đổi chính

- Seed cũ được thay bằng fixture model cụ thể, SKU/slug ổn định, brand/category hợp lệ, marker batch và upsert idempotent.
- Thêm seed ELGATO, 14 SVG minh họa danh mục, seed quality tests và DB integration tests.
- Thêm script cleanup chỉ chấp nhận development DB và yêu cầu backup/dry-run khớp trước khi xóa.
- Gỡ điều kiện hiển thị brands đã archive khỏi admin catalog queries; brands giả của batch đã được xóa.
- Tiến độ seed cũ được thay bằng trạng thái hiện tại trong [technest-large-seed-progress.md](./technest-large-seed-progress.md).

## Tests và hạn chế

- Frontend tests: PASS — 6/6 suites.
- Frontend build: PASS; còn cảnh báo Vite về main chunk >500 kB.
- Frontend lint: PASS.
- Backend curated seed + PostgreSQL integration: PASS — 8/8 tests.
- Backend full suite: PASS — 69 passed, 17 skipped (20 test files). Typecheck và lint: PASS. Lần chạy đầu không có quyền mạng thất bại vì sandbox chặn bind localhost; lần chạy có quyền mạng hoàn tất thành công.
- Homepage API + SSR verification: PASS.
- Chưa chạy browser E2E, Lighthouse hoặc kiểm tra responsive bằng browser.
- Baseline cũ có 4.950/5.000 sản phẩm với slug catalog-* từ dữ liệu seed cũ hơn, bên ngoài batch mục tiêu. Không xóa/đổi chúng vì yêu cầu giữ dữ liệu gốc; cần quyết định riêng nếu muốn thay thế catalog cũ.
- Giá và tồn kho là giá trị minh họa development, không xác minh theo giá thị trường hiện thời.

## Mức độ sẵn sàng

Batch lỗi gần nhất đã được backup, dry-run, xóa có kiểm tra quan hệ và thay bằng tập nhỏ hơn nhưng rõ nghĩa. Không tuyên bố toàn bộ catalog cũ đã đạt chất lượng production: còn 4.950 sản phẩm seed đời trước cần audit/cleanup riêng, và chưa có browser E2E.
