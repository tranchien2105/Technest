import { watchOrders } from "../api/orderEvents";
import { useEffect, useMemo, useState } from "react";
import { Eye, Search, X, Package, MapPin, Clock } from "lucide-react";
import { ordersApi } from "../api/ordersClient";
import { formatPrice } from "../utils/formatCurrency";
import ProductImage from "../components/common/ProductImage";
import AdminPagination, { AdminPageSize } from "./AdminPagination";
import AdminStatusBadge from "./AdminStatusBadge";
import { useAdminPageSize, useDebouncedValue } from "./useAdminList";

const transitions = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"], PROCESSING: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [] };
const labels = { PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", PROCESSING: "Đang chuẩn bị", SHIPPED: "Đang giao", DELIVERED: "Đã giao", CANCELLED: "Đã hủy" };
const actions = { CONFIRMED: "Xác nhận đơn", PROCESSING: "Chuẩn bị hàng", SHIPPED: "Bàn giao vận chuyển", DELIVERED: "Xác nhận đã giao", CANCELLED: "Hủy đơn hàng" };

export default function OrdersPanel({ canWrite = true }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useAdminPageSize("orders");
  const debouncedQuery = useDebouncedValue(query.trim());
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const queryString = useMemo(() => new URLSearchParams(Object.entries({ page, limit, q: debouncedQuery, status, paymentStatus, dateFrom, dateTo, sort }).filter(([, value]) => value !== "")).toString(), [page, limit, debouncedQuery, status, paymentStatus, dateFrom, dateTo, sort]);
  const key = `${queryString}|${revision}`;
  const loading = state.key !== key;
  const data = state.data;
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await ordersApi.adminList(queryString, { signal: controller.signal });
        if (!controller.signal.aborted) { setState({ key, data: result, error: "" }); if (page > Math.max(1, result.pagination.totalPages)) setPage(Math.max(1, result.pagination.totalPages)); }
      } catch (failure) { if (!controller.signal.aborted) setState((old) => ({ ...old, key, error: failure.message })); }
    };
    void load(); const timer = setInterval(load, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [queryString, key, page]);
  useEffect(() => watchOrders(true, () => setRevision((value) => value + 1)), []);
  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    ordersApi.adminDetail(selectedId).then((order) => { if (active) setSelected(order); }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [selectedId, revision]);
  const inspect = async (id) => { setError(""); try { setSelected(await ordersApi.adminDetail(id)); } catch (failure) { setError(failure.message); } };
  const change = async (next) => {
    setBusy(true); setError("");
    try { setSelected(await ordersApi.transition(selected.id, next, "Cập nhật bởi quản trị viên")); setRevision((value) => value + 1); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const filter = (setter, value) => { setter(value); setPage(1); };
  return <section className="admin-panel admin-table-panel" aria-busy={loading}>
    <div className="admin-panel-heading"><div><h2>Danh sách đơn hàng</h2><p>Theo dõi giao hàng, thanh toán và tiến độ xử lý.</p></div><div className="admin-heading-actions"><span className="admin-count">{(data?.pagination.total || 0).toLocaleString("vi-VN")} đơn hàng</span><AdminPageSize limit={limit} onChange={(size) => { setLimit(size); setPage(1); }}/></div></div>
    <div className="admin-filter-bar">
      <label className="admin-filter-field admin-filter-search"><span>Tìm kiếm</span><span className="admin-search"><Search size={18}/><input aria-label="Tìm đơn hàng" placeholder="Mã đơn, tên, email hoặc SĐT…" value={query} onChange={(event) => filter(setQuery, event.target.value)}/></span></label>
      <label className="admin-filter-field"><span>Trạng thái đơn</span><select aria-label="Trạng thái đơn" value={status} onChange={(event) => filter(setStatus, event.target.value)}><option value="">Tất cả trạng thái</option>{Object.keys(transitions).map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label className="admin-filter-field"><span>Thanh toán</span><select aria-label="Thanh toán" value={paymentStatus} onChange={(event) => filter(setPaymentStatus, event.target.value)}><option value="">Tất cả thanh toán</option><option value="UNPAID">Chưa thanh toán</option><option value="PAID">Đã thanh toán</option></select></label>
      <label className="admin-filter-field"><span>Từ ngày</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => filter(setDateFrom, event.target.value)}/></label>
      <label className="admin-filter-field"><span>Đến ngày</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => filter(setDateTo, event.target.value)}/></label>
      <label className="admin-filter-field"><span>Sắp xếp</span><select aria-label="Sắp xếp đơn hàng" value={sort} onChange={(event) => filter(setSort, event.target.value)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select></label>
      {(query || status || paymentStatus || dateFrom || dateTo || sort !== "newest") && <button className="admin-reset-filters" onClick={() => { setQuery(""); setStatus(""); setPaymentStatus(""); setDateFrom(""); setDateTo(""); setSort("newest"); setPage(1); }}><X size={15}/> Xóa bộ lọc</button>}
    </div>
    {(state.error || error) && <p role="alert" className="admin-error">{state.error || error}</p>}
    {loading && <div className="admin-loading-line" role="status">Đang tải dữ liệu…</div>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Trạng thái</th><th>Thanh toán</th><th>Tổng tiền</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>{(data?.items || []).map((order) => <tr key={order.id}><td><button className="admin-order-link" onClick={() => inspect(order.id)}>{order.orderNumber}</button><small>COD · #{order.id}</small></td><td><strong>{order.shippingAddress.fullName}</strong><small>{order.customerEmail || order.shippingAddress.phone}</small></td><td><AdminStatusBadge status={order.status}/></td><td><AdminStatusBadge status={order.paymentStatus}/></td><td className="admin-price-cell">{formatPrice(order.totalAmount)}</td><td>{new Date(order.createdAt).toLocaleDateString("vi-VN")}<small>{new Date(order.createdAt).toLocaleTimeString("vi-VN")}</small></td><td><button className="admin-detail-button" onClick={() => inspect(order.id)}><Eye size={16}/> Chi tiết</button></td></tr>)}</tbody></table>{!loading && !data?.items.length && <div className="admin-empty">Không có đơn hàng phù hợp. Hãy thử đổi bộ lọc.</div>}</div>
    <AdminPagination showPageSize={false} pagination={data?.pagination} limit={limit} onLimitChange={(size) => { setLimit(size); setPage(1); }} onPageChange={setPage} loading={loading}/>
    {selected && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setSelected(null); }}><section className="admin-editor-modal admin-order-modal" role="dialog" aria-modal="true" aria-labelledby="admin-order-title">
      <header><div><small>CHI TIẾT ĐƠN HÀNG</small><h2 id="admin-order-title">{selected.orderNumber}</h2><AdminStatusBadge status={selected.status}/></div><button className="admin-icon-button" disabled={busy} onClick={() => setSelected(null)} aria-label="Đóng chi tiết đơn hàng"><X size={18}/></button></header>
      {error && <p role="alert" className="admin-error">{error}</p>}
      <div className="admin-order-summary"><div><MapPin size={19}/><h3>Thông tin giao hàng</h3><strong>{selected.shippingAddress.fullName}</strong><p>{selected.shippingAddress.phone} · {selected.customerEmail}</p><p>{selected.shippingAddress.address}, {selected.shippingAddress.city}</p></div><div><Package size={19}/><h3>Thanh toán</h3><AdminStatusBadge status={selected.paymentStatus}/><p>Thanh toán khi nhận hàng (COD)</p><strong className="admin-order-total">{formatPrice(selected.totalAmount)}</strong></div></div>
      <h3>Sản phẩm trong đơn</h3><div className="admin-order-items">{selected.items.map((item) => <div key={item.id}><ProductImage src={item.image} alt={item.name} loading="lazy"/><span><strong>{item.name}</strong><small>Item #{item.id} · {item.sku} · {item.variantName}</small><small>{formatPrice(item.unitPrice)} × {item.quantity}</small></span><strong>{formatPrice(item.lineTotal)}</strong></div>)}</div>
      <h3 className="admin-order-history-title"><Clock size={18}/> Lịch sử xử lý</h3><ol className="admin-order-timeline">{selected.statusHistory.map((event) => <li key={event.id}><AdminStatusBadge status={event.toStatus}/><time>{new Date(event.createdAt).toLocaleString("vi-VN")}</time><p>{event.note}</p></li>)}</ol>
      {canWrite && !!transitions[selected.status]?.length && <footer className="admin-order-actions">{transitions[selected.status].map((next) => <button className={next === "CANCELLED" ? "admin-danger-button" : "admin-primary-button"} disabled={busy} key={next} onClick={() => change(next)}>{busy ? "Đang cập nhật…" : actions[next]}</button>)}</footer>}
    </section></div>}
  </section>;
}
