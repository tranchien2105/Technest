import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, UserRound, Ban, CheckCircle2, X } from "lucide-react";
import AdminPagination, { AdminPageSize } from "./AdminPagination";
import AdminStatusBadge from "./AdminStatusBadge";
import { useAdminPageSize, useDebouncedValue } from "./useAdminList";
import { adminApi } from "../api/adminClient";
import { formatPrice } from "../utils/formatCurrency";

export default function AdminCustomersPanel({ canWrite = true }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useAdminPageSize("customers");
  const [status, setStatus] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim());
  const [data, setData] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const queryString = useMemo(() => new URLSearchParams({ page: String(page), limit: String(limit), ...(debouncedQuery ? { q: debouncedQuery } : {}), ...(status ? { status } : {}) }).toString(), [page, limit, debouncedQuery, status]);
  const load = useCallback(async (signal) => {
    setLoading(true); setError("");
    try {
      const result = await adminApi.customers(queryString, { signal });
      if (!signal.aborted) { setData(result); if (page > Math.max(1, result.pagination.totalPages)) setPage(Math.max(1, result.pagination.totalPages)); }
    }
    catch (failure) { if (!signal.aborted) setError(failure.message); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [queryString, page]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, revision]);

  const viewCustomer = async (id) => {
    setError("");
    try { setCustomer(await adminApi.customer(id)); }
    catch (failure) { setError(failure.message); }
  };
  const toggleStatus = async () => {
    if (!customer) return;
    const status = customer.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    if (status === "BLOCKED" && !window.confirm(`Khóa tài khoản ${customer.email}? Khách hàng sẽ không thể sử dụng phiên đăng nhập.`)) return;
    setBusy(true); setError("");
    try {
      await adminApi.customerStatus(customer.id, status);
      setCustomer(await adminApi.customer(customer.id));
      setRevision((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const pagination = data?.pagination;
  return <section className="admin-panel admin-table-panel">
    <div className="admin-panel-heading"><div><h2>Tài khoản khách hàng</h2><p>Xem lịch sử đơn hàng và quản lý quyền truy cập tài khoản.</p></div><div className="admin-heading-actions"><span className="admin-count">{(pagination?.total ?? 0).toLocaleString("vi-VN")} khách hàng</span><AdminPageSize limit={limit} onChange={(size) => { setLimit(size); setPage(1); }}/></div></div>
    <div className="admin-filter-bar">
      <label className="admin-filter-field admin-filter-search"><span>Tìm kiếm</span><span className="admin-search"><Search size={18}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên hoặc email khách hàng…" aria-label="Tìm khách hàng"/></span></label>
      <label className="admin-filter-field"><span>Trạng thái tài khoản</span><select aria-label="Trạng thái tài khoản" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="BLOCKED">Đã khóa</option></select></label>
      {(query || status) && <button className="admin-reset-filters" onClick={() => { setQuery(""); setStatus(""); setPage(1); }}><X size={15}/> Xóa bộ lọc</button>}
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading && <div className="admin-loading-line" role="status">Đang tải dữ liệu…</div>}
    {!(data?.items || []).length && !loading ? <div className="admin-empty">Không tìm thấy khách hàng.</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Khách hàng</th><th>Email</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>{(data?.items || []).map((item) => <tr key={item.id}><td><strong>{item.fullName || "Chưa cập nhật tên"}</strong><small>ID {item.id}</small></td><td>{item.email}</td><td><AdminStatusBadge status={item.status}/></td><td>{new Date(item.createdAt).toLocaleDateString("vi-VN")}</td><td><button className="admin-detail-button" onClick={() => void viewCustomer(item.id)}><UserRound size={15}/> Chi tiết</button></td></tr>)}</tbody></table></div>}
    <AdminPagination showPageSize={false} pagination={pagination} limit={limit} onLimitChange={(size) => { setLimit(size); setPage(1); }} onPageChange={setPage} loading={loading}/>
    {customer && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomer(null); }}><section className="admin-editor-modal admin-customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title">
      <header><div><small>HỒ SƠ KHÁCH HÀNG</small><h2 id="customer-detail-title">{customer.fullName || customer.email}</h2></div><button className="admin-icon-button" onClick={() => setCustomer(null)} aria-label="Đóng"><X size={18}/></button></header>
      <div className="admin-customer-facts"><p><span>Email</span><strong>{customer.email}</strong></p><p><span>Số điện thoại</span><strong>{customer.phone || "Chưa cập nhật"}</strong></p><p><span>Trạng thái</span><strong>{customer.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}</strong></p><p><span>Đơn hàng</span><strong>{customer.orderCount}</strong></p><p><span>Tổng giá trị đơn đã giao</span><strong>{formatPrice(customer.totalSpent)}</strong></p><p><span>Ngày tạo</span><strong>{new Date(customer.createdAt).toLocaleDateString("vi-VN")}</strong></p></div>
      <h3>Đơn gần đây</h3>{customer.recentOrders.length ? <div className="admin-recent-orders">{customer.recentOrders.map((order) => <div key={order.id}><span><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString("vi-VN")}</small></span><span>{order.status}</span><strong>{formatPrice(order.totalAmount)}</strong></div>)}</div> : <p className="admin-muted">Khách hàng chưa có đơn hàng.</p>}
      <footer><button className={customer.status === "ACTIVE" ? "admin-danger-button" : "admin-primary-button"} disabled={busy || !canWrite} onClick={() => void toggleStatus()}>{customer.status === "ACTIVE" ? <><Ban size={16}/> Khóa tài khoản</> : <><CheckCircle2 size={16}/> Mở khóa tài khoản</>}</button></footer>
    </section></div>}
  </section>;
}
