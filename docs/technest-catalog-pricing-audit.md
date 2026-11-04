# TechNest — Catalog quality & price / Flash Sale verification

**Ngày:** 03/11/2026. **Môi trường:** PostgreSQL `technest_dev`, API `http://127.0.0.1:3000/api/v1`. Không truy cập production.

## 1. Kết quả catalog

| Chỉ số | Trước | Sau |
|---|---:|---:|
| Products tổng | 5.060 | 5.060 |
| Brands | 51 | 51 |
| Active products | 5.060 | 4.411 |
| Variants / inventory rows | 10.060 / 10.060 | Giữ nguyên |
| Product images | 15.060 | Giữ nguyên |
| Products xóa | 0 | 0 |

Audit xác định **4.950** sản phẩm có provenance khớp generator legacy: `attributes.dataset=development-illustration`, `seedKey`, ordinal, category, namespace/suffix slug và tên sinh ra khớp brand liên kết. Không nhận diện chỉ theo tên hoặc ngày tạo.

- **649** sản phẩm không có quan hệ nghiệp vụ được chuyển `INACTIVE`, có thể phục hồi từ backup. Không đổi tên/giá/tồn kho/ảnh.
- **4.301** sản phẩm có tham chiếu order, campaign, inventory history/reservation hoặc CMS được giữ nguyên. Trong đó 4.300 có order references. Không xóa hoặc relabel những model giả lập thành hàng chính hãng.
- 50 sản phẩm gốc và 60 model curated được giữ nguyên. Không thêm brand/product mới.
- Guard mặc định chặn chạy lại generator lớn có tên model/thông số tổng hợp. Fixture legacy chỉ có thể chạy khi truyền rõ `--allow-synthetic-fixtures`, dành cho database load-test tách biệt.

### An toàn và bằng chứng

1. [Dry-run](./technest-catalog-quality-dry-run.json) ghi chính xác ID, tên và thay đổi dự kiến; tự dò foreign keys từ schema và bảo vệ CMS selections/links, reserved stock.
2. Backup trước sửa lưu local tại `docs/technest-catalog-quarantine-backup.json` (Git-ignored, không đưa snapshot database lên GitHub): 649 product records, 1.298 variants, 1.947 images và 1.298 inventory rows. SHA-256 nội dung target snapshot: `01bd76cc3a7667bb226ebfc484bc16fb79c14adc2f6c4ef23be01f1759bae5d6`.
3. [Kết quả apply](./technest-catalog-quality-results.json): transaction SERIALIZABLE, yêu cầu snapshot/dry-run khớp hoàn toàn, khóa đúng target rows, chỉ cập nhật status/updated_at.
4. [Đối chiếu sau sửa](./technest-catalog-quality-verification.json): protected catalog, toàn bộ variants/images/inventory/CMS và business tables có digest khớp. Brands, categories, orders/items, inventory movements/reservations, campaigns/items/reservations, vouchers giữ nguyên. Không có ứng viên mới cần quarantine.

Script bảo vệ backup trước sửa khỏi việc chạy dry-run lần sau ghi đè. Hậu kiểm dùng:

```bash
cd backend
node --import tsx scripts/audit-catalog-quality.mjs --verify
```

Hậu kiểm fingerprint so sánh thời điểm sửa. Nếu dữ liệu nghiệp vụ được cập nhật hợp lệ sau đó, cần xem diff; không được hiểu sai thay đổi mới thành lỗi của batch.

### Chất lượng dữ liệu đã kiểm tra

**PASS:** không orphan products/variants/image links; không thiếu image/inventory; không tồn kho âm hoặc reserved vượt on_hand; không trùng SKU, product slug, product name, brand slug; không brand bắt đầu `Demo `; giá VND integer dương; 60 curated identities khớp model/brand/category/image type; tất cả local image paths tồn tại.

**Chưa đạt chất lượng thương mại:** 4.301 model tổng hợp được bảo vệ vẫn cần duyệt, giá/tồn kho chỉ là development fixtures. Ảnh minh họa theo category không chứng minh đúng ảnh model. Generator legacy dùng ảnh quá rộng cho các loại như keycaps, switch, microphone, webcam và adapter, cùng variants màu chung; những records có lịch sử nghiệp vụ được giữ nguyên. Chưa xác minh toàn bộ ảnh URL bên ngoài hoặc thông số/giá hiện hành từ nhà sản xuất. Structural PASS không phải chứng nhận dữ liệu hàng hóa production.

## 2. HTTP storefront sau sửa

[Bằng chứng HTTP thực](./technest-catalog-quality-api-results.json):

| Request | Kết quả |
|---|---|
| `products?limit=10&sort=newest` | **200/PASS** — 10 model curated mới nhất, tổng active 4.411 |
| `products?category=mice&limit=12` | **200/PASS** — pagination còn hoạt động, tổng 874 |
| `brands?paginated=1&limit=10` | **200/PASS** — 51 brands, không mất brand |
| Product legacy đã quarantine theo slug cụ thể | **404/PASS** — không tiếp tục bán |
| `homepage/config` | **200/PASS** — published CMS không bị đổi |
| `flash-sales` | **200/PASS** — campaigns vẫn truy cập được |

## 3. Lỗi price / Flash Sale đã sửa

| Lỗi được xác nhận | Sửa |
|---|---|
| Detail chỉ tìm variant trong campaign active đầu tiên | Tìm đúng variant xuyên qua các campaign hợp lệ |
| Client clock quyết định thời điểm được hưởng deal | Dùng thời gian API; start inclusive/end exclusive |
| Card/page Flash Sale mở default variant | Deep link giữ `?variant=...` |
| Reconnect SSE chờ polling mới cập nhật | Refetch ngay khi kết nối mở lại |
| Response cũ có thể ghi đè response mới trên detail | Request version bỏ response lỗi thời |
| Redis trả serverNow cũ | Làm mới timestamp khi đọc cache |
| Campaign đặt `ENDED` nhưng chưa đến endsAt bị hiển thị ACTIVE | Bảo toàn terminal status |
| Campaign chọn ảnh ngẫu nhiên trong product/variant images | Ưu tiên ảnh variant, sort_order rồi id |
| Detail quantity có thể vượt giới hạn mỗi khách | Cap bởi stock, quota và perCustomerLimit; Backend vẫn xác nhận cuối |

Không optimistic checkout/reservation success. Không thêm payment provider hoặc thay chính sách COD.

## 4. Tests thực chạy

- Frontend `node --test tests/flash-sale.test.js`: **PASS**, 4 case cho time boundary/terminal status, multiple campaigns/selected variant, sold-out/stale expensive offer, variant deep link + regular/sale cart line identity.
- Backend quality + cache + pricing rollback suites: **5/5 PASS**.
- Existing `RUN_ORDER_DB_TESTS=1 npm test -- tests/orders.integration.test.ts`: **2/2 PASS**, gồm HTTP auth/ownership, retry/idempotency, stock concurrency, quota competition và dispatch consume.
- Targeted frontend/backend ESLint: **PASS**. Backend typecheck: **PASS** trước lượt extension expiry; root chạy regression tổng hợp sau các tác vụ song song.

[Bằng chứng pricing PostgreSQL](./technest-pricing-flash-sale-results.json) xác minh:

- Variant Black 500.000đ, White 600.000đ; đúng White có Flash Sale 400.000đ và đúng ảnh variant.
- Quote và order snapshot cùng giá/subtotal; key retry trả đúng một order.
- Wrong variant, draft/paused/cancelled/ended/upcoming/expired deal bị từ chối.
- Regular price giảm thấp hơn flash price, voucher stacking, hết quota và customer limit bị từ chối.
- Cancel trả quota/stock; reservation hết hạn hủy pending order và trả quota/stock; ship chuyển reserved→sold một lần.
- Expiry test từ chối sweep nếu có reservation hết hạn ngoài fixture.
- Fixture chạy trong một transaction rollback; **0 product fixture tồn tại sau test**, không khởi động email worker.

## 5. Hạn chế / việc cần duyệt

- Chưa thể chứng nhận 4.301 model legacy được bảo vệ là merchandise thật. Cần import catalog có nguồn, duyệt danh mục/brand/model/ảnh và quyết định xử lý từng record có lịch sử.
- Giá và inventory development không được coi là giá bán/khả năng giao hàng đã xác minh.
- Browser end-to-end reconnect và Flash Sale UI riêng nằm ở báo cáo browser của tác vụ tổng; các kiểm tra trên là domain/unit, actual PostgreSQL và HTTP, không tự coi là browser PASS.
- CheckoutForm quote-line rendering được giao tác vụ browser để tránh ghi đè code đang sửa song song; xem báo cáo tổng hợp cho kết quả cuối.
