const labels = {
  ACTIVE: ["Đang hoạt động", "success"], INACTIVE: ["Tạm ẩn", "neutral"], ARCHIVED: ["Đã lưu trữ", "neutral"], BLOCKED: ["Đã khóa", "danger"],
  PENDING: ["Chờ xác nhận", "warning"], CONFIRMED: ["Đã xác nhận", "info"], PROCESSING: ["Đang chuẩn bị", "info"],
  SHIPPED: ["Đang giao", "warning"], DELIVERED: ["Đã giao", "success"], CANCELLED: ["Đã hủy", "danger"],
  PAID: ["Đã thanh toán", "success"], UNPAID: ["Chưa thanh toán", "neutral"],
};

export default function AdminStatusBadge({ status, label }) {
  const [text, tone] = labels[status] || [status, "neutral"];
  return <span className={`admin-badge admin-badge-${tone}`}>{label || text}</span>;
}
