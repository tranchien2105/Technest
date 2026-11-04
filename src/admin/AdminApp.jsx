import AdminOperationsPanel from "./AdminOperationsPanel";
import AdminBannerManagement from "./banners/AdminBannerManagement";
import AdminReportsPanel from "./AdminReportsPanel";
import AdminImportPanel from "./AdminImportPanel";
import { canAdmin } from "./operationsApi";
import { formatPrice } from "../utils/formatCurrency";
import OrdersPanel from "./OrdersPanel";
import AdminPagination, { AdminPageSize } from "./AdminPagination";
import AdminStatusBadge from "./AdminStatusBadge";
import ProductImage from "../components/common/ProductImage";
import { useAdminPageSize, useDebouncedValue } from "./useAdminList";
import { useEffect, useMemo, useState } from "react";
import { Activity, Boxes, ChevronRight, CircleDollarSign, ClipboardList, LayoutDashboard, Menu, Package, Search, Settings, ShieldAlert, ShoppingBag, Users, Warehouse, X } from "lucide-react";
import { adminApi } from "../api/adminClient";
import { logout, clearAuth } from "../api/authClient";
import AdminLogin from "./AdminLogin";
import AdminCatalogPanel from "./AdminCatalogPanel";
import AdminCustomersPanel from "./AdminCustomersPanel";
import AdminSettingsPanel from "./AdminSettingsPanel";
import AdminHomepageCms from "./AdminHomepageCms";
import AdminFlashSalesPanel from "./AdminFlashSalesPanel";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";
import "./admin.css";

const sections = [
  ["/admin", "Tổng quan", LayoutDashboard],
  ["/admin/products", "Sản phẩm", Package],
  ["/admin/categories", "Danh mục", Boxes],
  ["/admin/brands", "Thương hiệu", Activity],
  ["/admin/inventory", "Tồn kho", Warehouse],
  ["/admin/orders", "Đơn hàng", ShoppingBag],
  ["/admin/flash-sales", "Flash Sale", Activity],
  ["/admin/customers", "Khách hàng", Users],
  ["/admin/imports", "Nhập / xuất Excel", ClipboardList],
  ["/admin/homepage", "Trang chủ · Visual CMS", LayoutDashboard],
  ["/admin/banners", "Banner quảng cáo", Activity],
  ["/admin/vouchers", "Mã giảm giá", CircleDollarSign],
  ["/admin/reports", "Báo cáo nâng cao", LayoutDashboard],
  ["/admin/staff", "Nhân viên & phân quyền", Users],
  ["/admin/after-sales", "Đổi trả & bảo hành", Package],
  ["/admin/emails", "Email đơn hàng", ClipboardList],
  ["/admin/audit", "Nhật ký thao tác", Activity],
  ["/admin/settings", "Cài đặt cửa hàng", Settings],
];

function usePageData(path, query, refreshVersion, authorized) {
  const [state, setState] = useState({ key: "", error: "", data: null });
  const key = `${path}|${query}|${refreshVersion}|${authorized}`;
  useEffect(() => {
    if (!authorized) return;
    const controller = new AbortController();
    const request = path === "/admin" ? adminApi.overview({ signal: controller.signal })
      : path === "/admin/inventory" ? adminApi.inventory(query, { signal: controller.signal })
        : path === "/admin/customers" ? adminApi.customers(query, { signal: controller.signal })
          : Promise.resolve(null);
    request.then((data) => { if (!controller.signal.aborted) setState({ key, path, error: "", data }); })
      .catch((error) => { if (!controller.signal.aborted) setState({ key, path, error: error.message, data: null }); });
    return () => controller.abort();
  }, [path, query, refreshVersion, key, authorized]);
  return { ...state, data: state.path === path ? state.data : null, loading: state.key !== key };
}

function Metric({ icon: Icon, label, value, note, unavailable }) {
  return <article className={`admin-metric ${unavailable ? "is-unavailable" : ""}`}><span className="admin-metric-icon"><Icon size={19}/></span><span className="admin-metric-label">{label}</span><strong>{unavailable ? "Chưa khả dụng" : value}</strong><small>{note}</small></article>;
}

export default function AdminApp({ path, authUser, authReady, navigate, onLogout, onAuthenticate, storePreviewProps }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useAdminPageSize("inventory");
  const [stockFilter, setStockFilter] = useState("");
  const [variantStatus, setVariantStatus] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const [toast, setToast] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [stockHistory, setStockHistory] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearch) query.set("q", debouncedSearch);
    if (stockFilter) query.set("stock", stockFilter);
    if (variantStatus) query.set("status", variantStatus);
    return query.toString();
  }, [page, limit, debouncedSearch, stockFilter, variantStatus]);
  const scopes = { "/admin": "dashboard", "/admin/categories": "catalog", "/admin/brands": "catalog", "/admin/imports": "products", "/admin/homepage": "homepage", "/admin/flash-sales": "flash-sales" };
  const scope = scopes[path] || path.split("/")[2];
  const permitted = canAdmin(authUser, scope);
  const canWrite = canAdmin(authUser, scope, true);
  const query = path === "/admin/inventory" ? params : "";
  const { loading, error, data } = usePageData(path, query, refreshVersion, permitted && ["/admin", "/admin/inventory"].includes(path));

  if (!authReady) return <div className="admin-gate">Đang xác minh phiên đăng nhập…</div>;
  if (!authUser) return <AdminLogin path={path} navigate={navigate} onAuthenticate={onAuthenticate} />;
  if (!["ADMIN", "STAFF"].includes(authUser.role)) return <div className="admin-gate"><ShieldAlert size={30}/><h1>Tài khoản chưa có quyền quản trị</h1><p>Bạn đang đăng nhập bằng {authUser.email}. Phiên này vẫn dùng chung với khu vực tài khoản khách hàng; cần cấp quyền ADMIN cho tài khoản này để mở trang quản trị.</p><button onClick={() => navigate("/")}>Về cửa hàng</button></div>;

  const title = sections.find(([href]) => href === path)?.[1] || "Quản trị";
  const logoutAdmin = async () => { try { await logout(); } finally { clearAuth(); onLogout(); } };
  const runStockAction = async (row, mode) => {
    const input = window.prompt(mode === "inbound" ? "Số lượng nhập thêm:" : "Tồn kho mới (on-hand):");
    if (input === null) return;
    const quantity = Number(input);
    if (!Number.isSafeInteger(quantity) || quantity < (mode === "inbound" ? 1 : 0)) { setToast("Số lượng không hợp lệ."); return; }
    if (mode === "adjust" && !window.confirm(`Xác nhận điều chỉnh tồn kho ${row.sku} thành ${quantity}?`)) return;
    try {
      const idempotencyKey = crypto.randomUUID();
      await (mode === "inbound" ? adminApi.inbound(row.variantId, { quantity, idempotencyKey }) : adminApi.adjust(row.variantId, { newQuantity: quantity, idempotencyKey }));
      setToast("Đã cập nhật tồn kho."); window.setTimeout(() => setToast(""), 3000);
      // Refresh the current inventory listing through its query key.
      setRefreshVersion((version) => version + 1);
    } catch (actionError) { setToast(actionError.message); }
  };
  const showStockHistory = async (row, historyPage = 1, historyLimit = 50) => {
    setHistoryError(""); setStockHistory({ row, loading: true, data: null, page: historyPage, limit: historyLimit });
    try {
      const data = await adminApi.movements(row.variantId, historyPage, historyLimit);
      setStockHistory({ row, loading: false, data, page: historyPage, limit: historyLimit });
    } catch (failure) { setHistoryError(failure.message); setStockHistory({ row, loading: false, data: null, page: historyPage, limit: historyLimit }); }
  };

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`}>
      <div className="admin-brand"><span className="admin-brand-mark"><span>T</span><span>N</span></span><strong>Technest</strong><small>ADMIN</small><button className="admin-icon-button admin-sidebar-close" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}><X size={19}/></button></div>
      <span className="admin-nav-label">QUẢN LÝ CỬA HÀNG</span>
      <nav>{sections.filter(([href]) => canAdmin(authUser, scopes[href] || href.split("/")[2])).map(([href, label, Icon]) => <a key={href} href={href} className={path === href ? "is-active" : ""} onClick={() => setMobileOpen(false)}><Icon size={18}/><span>{label}</span>{path === href && <ChevronRight size={15}/>}</a>)}</nav>
      <div className="admin-sidebar-bottom"><span>Đang đăng nhập</span><strong>{authUser.fullName || authUser.email}</strong><button onClick={logoutAdmin}>Đăng xuất</button><a href="/">← Quay lại cửa hàng</a></div>
    </aside>
    {mobileOpen && <button className="admin-overlay" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}/>}
    <main className="admin-main">
      <header className="admin-topbar"><button className="admin-icon-button admin-mobile-menu" aria-label="Mở menu" onClick={() => setMobileOpen(true)}><Menu size={21}/></button><div className="admin-breadcrumb">Technest <ChevronRight size={14}/> <strong>{title}</strong></div><div className="admin-top-user"><span>{(authUser.fullName || authUser.email).slice(0, 1).toUpperCase()}</span><div><strong>{authUser.fullName || "Quản trị viên"}</strong><small>{authUser.role}</small></div></div></header>
      <div className="admin-content"><div className="admin-page-heading"><div><span className="admin-eyebrow">TECHNEST CONTROL CENTER</span><h1>{title}</h1><p>{path === "/admin" ? "Theo dõi tình hình vận hành từ dữ liệu hiện có." : `Quản lý ${title.toLowerCase()} bằng dữ liệu từ hệ thống.`}</p></div></div>

      {!permitted ? <div className="admin-panel"><h2>Bạn chưa được cấp quyền cho mục này.</h2><p>Chọn một mục được cấp quyền trong menu quản trị.</p></div> : path === "/admin/homepage" ? <AdminHomepageCms canWrite={authUser.role === "ADMIN"} previewProps={storePreviewProps}/> : path === "/admin/flash-sales" ? <AdminFlashSalesPanel canWrite={canWrite}/> : scope === "banners" ? <AdminBannerManagement canWrite={canWrite} previewProps={storePreviewProps}/> : ["vouchers","staff","audit","emails","after-sales"].includes(scope) ? <AdminOperationsPanel key={scope} kind={scope} canWrite={canWrite}/> : path === "/admin/reports" ? <AdminReportsPanel/> : path === "/admin/imports" ? canWrite ? <AdminImportPanel user={authUser}/> : <div className="admin-panel">Bạn cần quyền thay đổi sản phẩm để nhập dữ liệu.</div> : path === "/admin/inventory" ? <Inventory canWrite={canWrite} data={data} loading={loading} error={error} onAction={runStockAction} onHistory={showStockHistory}
        search={search} onSearch={(value) => { setSearch(value); setPage(1); }} stockFilter={stockFilter} onStockFilter={(value) => { setStockFilter(value); setPage(1); }}
        status={variantStatus} onStatus={(value) => { setVariantStatus(value); setPage(1); }}
        limit={limit} onLimitChange={(value) => { setLimit(value); setPage(1); }} setPage={setPage}/>
        : path === "/admin" ? (loading ? <AdminLoadingSkeleton variant="dashboard" label="Đang tải tổng quan…" /> : error ? <div className="admin-state admin-error"><strong>Không tải được dữ liệu</strong><p>{error}</p><button onClick={() => setRefreshVersion((value) => value + 1)}>Thử lại</button></div> : <Overview data={data} navigate={navigate}/>)
        : path === "/admin/customers" ? <AdminCustomersPanel canWrite={canWrite}/> : path === "/admin/products" ? <AdminCatalogPanel canWrite={canWrite} key={path} kind="products"/> : path === "/admin/categories" ? <AdminCatalogPanel canWrite={canWrite} key={path} kind="categories"/> : path === "/admin/brands" ? <AdminCatalogPanel canWrite={canWrite} key={path} kind="brands"/> : path === "/admin/orders" ? <OrdersPanel canWrite={canWrite}/> : path === "/admin/settings" ? <AdminSettingsPanel canWrite={canWrite}/> : <Unavailable/>}

      {toast && <div className="admin-toast" role="status">{toast}<button onClick={() => setToast("")}>Đóng</button></div>}
      {stockHistory && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStockHistory(null); }}><section className="admin-editor-modal admin-history-modal" role="dialog" aria-modal="true" aria-labelledby="stock-history-title"><header><div><small>LỊCH SỬ TỒN KHO</small><h2 id="stock-history-title">{stockHistory.row.sku} · {stockHistory.row.productName}</h2></div><button className="admin-icon-button" onClick={() => setStockHistory(null)} aria-label="Đóng"><X size={18}/></button></header>{stockHistory.loading ? <p>Đang tải lịch sử…</p> : historyError ? <p className="admin-error">{historyError}</p> : !(stockHistory.data?.items || []).length ? <p>Chưa có biến động tồn kho.</p> : <div className="admin-history-list">{stockHistory.data.items.map((movement) => <article key={movement.id}><span className={`admin-movement-type type-${movement.type.toLowerCase()}`}>{movement.type}</span><strong>{movement.quantity > 0 && movement.type !== "ADJUSTMENT" ? "+" : ""}{movement.quantity}</strong><small>{new Date(movement.createdAt).toLocaleString("vi-VN")}</small><span>{movement.referenceType || "Thao tác quản trị"} {movement.referenceId || ""}</span></article>)}</div>}<AdminPagination pagination={stockHistory.data?.pagination} limit={stockHistory.limit} onLimitChange={(size) => void showStockHistory(stockHistory.row, 1, size)} onPageChange={(page) => void showStockHistory(stockHistory.row, page, stockHistory.limit)} loading={stockHistory.loading}/></section></div>}
    </div></main>
  </div>;
}

function Overview({ data, navigate }) {
  if (!data) return null;
  const m = data.metrics;
  return <>
    <section className="admin-metrics-grid">
      <Metric icon={CircleDollarSign} label="Doanh thu" value={formatPrice(m.revenue)} note="COD đã giao và thanh toán"/>
      <Metric icon={ShoppingBag} label="Tổng đơn hàng" value={m.orders} note="Tổng số đơn đã tiếp nhận"/>
      <Metric icon={ClipboardList} label="Đơn chờ xử lý" value={m.pendingOrders} note="Đang chờ xác nhận"/>
      <Metric icon={Users} label="Khách hàng hoạt động" value={m.activeCustomers.toLocaleString("vi-VN")} note="Tài khoản CUSTOMER đang hoạt động"/>
      <Metric icon={Package} label="Sản phẩm hoạt động" value={m.activeProducts.toLocaleString("vi-VN")} note={`${m.totalProducts} sản phẩm tổng cộng`}/>
      <Metric icon={Warehouse} label="Sản phẩm tồn thấp" value={m.lowStockProducts.toLocaleString("vi-VN")} note="Ngưỡng đang áp dụng: còn ≤ 5"/>
    </section>
    <div className="admin-overview-grid"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Tổng quan danh mục</h2><p>Quy mô hàng hóa đang quản lý</p></div></div><div className="admin-mini-stats"><div><span>Danh mục</span><strong>{m.categories}</strong></div><div><span>Thương hiệu</span><strong>{m.brands}</strong></div><div><span>Tổng sản phẩm</span><strong>{m.totalProducts}</strong></div></div></section><section className="admin-panel admin-notice"><ShieldAlert size={21}/><div><h2>Quản lý đơn hàng</h2><p>{data.revenuePolicy}</p><button onClick={() => navigate("/admin/orders")}>Mở quản lý đơn hàng <ChevronRight size={15}/></button></div></section></div>
    <section className="admin-panel admin-next-step"><h2>Thao tác nhanh</h2><div><button onClick={() => navigate("/admin/inventory")}>Kiểm tra tồn kho <ChevronRight size={15}/></button><button onClick={() => navigate("/admin/customers")}>Danh sách khách hàng <ChevronRight size={15}/></button><button onClick={() => navigate("/admin/products")}>Quản lý sản phẩm <ChevronRight size={15}/></button></div></section>
    <section className="admin-panel admin-revenue-panel"><div className="admin-panel-heading"><div><h2>Doanh thu 7 ngày gần nhất</h2><p>Đơn giao thành công và đã thanh toán</p></div><strong>{formatPrice(data.revenueSeries.reduce((total, item) => total + Number(item.amount), 0))}</strong></div><div className="admin-revenue-chart">{data.revenueSeries.map((item) => { const max = Math.max(...data.revenueSeries.map((point) => Number(point.amount)), 1); return <div key={item.date}><span title={formatPrice(item.amount)} style={{ height: `${Math.max(Number(item.amount) / max * 100, 3)}%` }}/><small>{item.date.slice(5)}</small></div>; })}</div></section>
    <div className="admin-overview-grid admin-detail-overview"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Đơn hàng mới nhất</h2><p>8 đơn gần nhất</p></div></div><div className="admin-overview-list">{data.recentOrders.map((order) => <div key={order.id}><span><strong>{order.orderNumber}</strong><small>{order.customer} · {new Date(order.createdAt).toLocaleDateString("vi-VN")}</small></span><AdminStatusBadge status={order.status}/><strong>{formatPrice(order.totalAmount)}</strong></div>)}</div></section><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Sản phẩm bán chạy</h2><p>Theo số lượng trong đơn 7 ngày qua</p></div></div>{data.topSellingProducts.length ? <div className="admin-top-products">{data.topSellingProducts.map((product, index) => <div key={product.id}><b>{index + 1}</b><ProductImage src={product.image} alt={product.name} loading="lazy"/><span><strong>{product.name}</strong><small>{product.quantity} sản phẩm</small></span><strong>{formatPrice(product.revenue)}</strong></div>)}</div> : <div className="admin-empty">Chưa có sản phẩm trong đơn hàng gần đây.</div>}</section></div>
  </>;
}

function Inventory({ canWrite = true, data, loading, error, onAction, onHistory, setPage, search, onSearch, stockFilter, onStockFilter, status, onStatus, limit, onLimitChange }) {
  const items = data?.items || []; const pagination = data?.pagination;
  return <section className="admin-panel admin-table-panel" aria-busy={loading}>
    <div className="admin-panel-heading"><div><h2>Phiên bản & tồn kho</h2><p>Số lượng có thể bán = tồn thực tế − hàng đã giữ cho đơn hàng.</p></div><div className="admin-heading-actions"><span className="admin-count">{(pagination?.total || 0).toLocaleString("vi-VN")} SKU</span><AdminPageSize limit={limit} onChange={onLimitChange}/></div></div>
    <div className="admin-filter-bar">
      <label className="admin-filter-field admin-filter-search"><span>Tìm kiếm</span><span className="admin-search"><Search size={18}/><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Tên sản phẩm hoặc mã SKU…" aria-label="Tìm tồn kho"/></span></label>
      <label className="admin-filter-field"><span>Tình trạng kho</span><select aria-label="Tình trạng kho" value={stockFilter} onChange={(event) => onStockFilter(event.target.value)}><option value="">Tất cả tồn kho</option><option value="in">Còn hàng</option><option value="low">Sắp hết (1–5)</option><option value="out">Hết hàng</option></select></label>
      <label className="admin-filter-field"><span>Trạng thái phiên bản</span><select aria-label="Trạng thái phiên bản" value={status} onChange={(event) => onStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang bán</option><option value="INACTIVE">Tạm ẩn</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>
      {(search || stockFilter || status) && <button className="admin-reset-filters" onClick={() => { onSearch(""); onStockFilter(""); onStatus(""); }}><X size={15}/> Xóa bộ lọc</button>}
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}{loading && <div className="admin-loading-line" role="status">Đang tải dữ liệu…</div>}
    {!items.length && !loading ? <div className="admin-empty">Không có tồn kho phù hợp. Hãy thử đổi bộ lọc.</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Sản phẩm / SKU</th><th>Tồn thực tế</th><th>Đã giữ</th><th>Có thể bán</th><th>Trạng thái</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>{items.map((row) => <tr key={row.variantId}><td><strong>{row.productName}</strong><small>{row.sku} · {row.variantName}</small></td><td>{row.onHand}</td><td>{row.reserved}</td><td><span className={`admin-stock ${row.lowStock ? "is-low" : ""}`}>{row.available}</span></td><td><AdminStatusBadge status={row.status}/></td><td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : "—"}</td><td><div className="admin-row-actions"><button onClick={() => onHistory(row)}>Lịch sử</button>{canWrite && <><button onClick={() => onAction(row, "inbound")}>Nhập kho</button><button onClick={() => onAction(row, "adjust")}>Điều chỉnh</button></>}</div></td></tr>)}</tbody></table></div>}
    <AdminPagination showPageSize={false} pagination={pagination} limit={limit} onLimitChange={onLimitChange} onPageChange={setPage} loading={loading}/>
  </section>;
}

function Unavailable() {
  return <section className="admin-panel admin-unavailable"><ShieldAlert size={24}/><h2>Không tìm thấy mục quản trị</h2><p>Đường dẫn này chưa có trong menu Admin.</p></section>;
}
