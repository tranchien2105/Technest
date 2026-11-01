import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export function AdminPageSize({ limit, onChange }) {
  return <label className="admin-page-size">Hiển thị <select aria-label="Số bản ghi mỗi trang" value={limit} onChange={(event) => onChange(Number(event.target.value))}>{[50, 100, 200, 500].map((size) => <option key={size} value={size}>{size}</option>)}</select> / trang</label>;
}

export default function AdminPagination({ pagination, limit, onLimitChange, onPageChange, loading = false, showPageSize = true }) {
  const { page = 1, total = 0, totalPages = 0 } = pagination || {};
  const last = Math.max(1, totalPages);
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);
  return <div className="admin-list-pagination">
    {showPageSize && <AdminPageSize limit={limit} onChange={onLimitChange}/>}
    <span className="admin-result-range">{from.toLocaleString("vi-VN")}–{to.toLocaleString("vi-VN")} trong {total.toLocaleString("vi-VN")} kết quả</span>
    <nav aria-label="Phân trang" className="admin-page-navigation">
      <button disabled={loading || page <= 1} onClick={() => onPageChange(1)} aria-label="Trang đầu"><ChevronsLeft size={16}/></button>
      <button disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Trang trước"><ChevronLeft size={16}/></button>
      <span>Trang <strong>{Math.min(page, last)}</strong> / {last}</span>
      <button disabled={loading || page >= last} onClick={() => onPageChange(page + 1)} aria-label="Trang sau"><ChevronRight size={16}/></button>
      <button disabled={loading || page >= last} onClick={() => onPageChange(last)} aria-label="Trang cuối"><ChevronsRight size={16}/></button>
    </nav>
  </div>;
}
