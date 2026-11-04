# Technest seed progress — trạng thái hiện tại

**Cập nhật:** 02/11/2026

Lô seed quy mô lớn tn-large-20261102 tạo ra 2.000 brand dạng ghép và 2.000 sản phẩm generic. Đã backup, dry-run, xác minh foreign keys và dọn đúng toàn bộ lô mục tiêu. Không có quan hệ order, Flash Sale, inventory history/reservation hoặc CMS tới lô đó.

Lô thay thế tn-curated-20261102: 60 sản phẩm minh họa có model cụ thể, 32 brand liên kết, 14 SVG phân loại, seed idempotent. Tổng hiện tại: 5.060 products, 51 brands. Dữ liệu cũ được đối chiếu hash và giữ nguyên.

Chi tiết, 30 tên brand/product, backup, dry-run, homepage/API và tests: [technest-seed-quality-repair.md](./technest-seed-quality-repair.md). Snapshot máy đọc: [technest-seed-quality-repair.json](./technest-seed-quality-repair.json).

Còn lại: 4.950 sản phẩm thuộc catalog seed đời trước (slug catalog-*) chưa được rà soát; không thuộc lô vừa dọn và không bị sửa. Browser E2E chưa chạy.
