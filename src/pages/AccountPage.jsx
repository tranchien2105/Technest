import AfterSalesRequests from "../components/account/AfterSalesRequests";
import { addMoney } from "../domain/cart";
import { watchOrders } from "../api/orderEvents";
import { ordersApi, orderView } from "../api/ordersClient";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  ChevronRight,
  CircleUserRound,
  Clock3,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { formatPrice } from "../utils/formatCurrency";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import { accountApi } from "../api/accountClient";
import { normalizeOrderStatus } from "../domain/orderTracking";
import OrderProgress from "../components/account/OrderProgress";
import AccountNotifications from "../components/account/AccountNotifications";

function orderStatusLabel(order, lang) {
  const status = normalizeOrderStatus(order.status);
  const labels = {
    PLACED: ["Order received", "Đã ghi nhận"],
    CONFIRMED: ["Confirmed", "Đã xác nhận"],
    PROCESSING: ["Preparing", "Đang chuẩn bị"],
    SHIPPED: ["In transit", "Đang giao"],
    DELIVERED: ["Delivered", "Đã giao"],
    CANCELLED: ["Cancelled", "Đã hủy"],
  };
  return tx(labels[status][0], labels[status][1], lang);
}

function orderStatusClass(order) {
  return `status-pill status-${normalizeOrderStatus(order.status).toLowerCase()}`;
}

function historyStatusLabel(status, lang) {
  const labels = {
    PENDING: ["Order received", "Đã ghi nhận"],
    PLACED: ["Order received", "Đã ghi nhận"],
    CONFIRMED: ["Confirmed", "Đã xác nhận"],
    PROCESSING: ["Preparing", "Đang chuẩn bị"],
    SHIPPED: ["Shipped", "Đã bàn giao cho đơn vị vận chuyển"],
    DELIVERED: ["Delivered", "Đã giao"],
    CANCELLED: ["Cancelled", "Đã hủy"],
  };
  const [english, vietnamese] = labels[status] || [status, status];
  return tx(english, vietnamese, lang);
}

export default function AccountPage({ route, language, authUser, onLogout, navigate }) {
  const { pathname: path } = new URL(route, "http://technest.local");
  const lang = language === "vi";
  const [orders, setOrders] = useState([]);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [detail, setDetail] = useState(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedSubsection, setLoadedSubsection] = useState("");
  const [profileData, setProfileData] = useState({ fullName: authUser?.fullName || "", email: authUser?.email || "", phone: "" });
  const [addresses, setAddresses] = useState([]);
  const [sessions, setSessions] = useState([]);

  const subsection = path.split("/")[2] || "";
  const orderId = subsection === "orders" ? path.split("/")[3] : null;
  const selectedOrder = detail?.id === orderId ? detail : null;
  const accountName = authUser?.fullName || profileData.fullName || (lang ? "Khách hàng Technest" : "Technest Customer");
  const initials =
    accountName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "TN";
  const totalSpent = orders.reduce((sum, order) => addMoney(sum, order.total || "0"), "0");

  useEffect(() => {
    let active = true;
    if (["profile", "addresses", "security"].includes(subsection)) {
      const load = subsection === "profile" ? accountApi.profile().then((data) => active && setProfileData(data))
        : subsection === "addresses" ? accountApi.addresses().then((data) => active && setAddresses(Array.isArray(data) ? data : []))
          : Promise.all([accountApi.sessions(), accountApi.profile()]).then(([data, profile]) => {
            if (active) { setSessions(Array.isArray(data) ? data : []); setProfileData(profile); }
          });
      load.then(() => { if (active) { setApiError(""); setLoadedSubsection(subsection); } })
        .catch((error) => { if (active) { setApiError(error.message); setLoadedSubsection(subsection); } });
    } else if (subsection === "") {
      accountApi.addresses().then((data) => active && setAddresses(Array.isArray(data) ? data : [])).catch(() => {});
    }
    return () => { active = false; };
  }, [subsection]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await ordersApi.list(page, { ...(orderQuery ? { q: orderQuery } : {}), ...(orderStatus ? { status: orderStatus } : {}) });
        const selected = orderId ? await ordersApi.detail(orderId) : null;
        if (active) { setOrders(result.items.map(orderView)); setPagination(result.pagination); setDetail(selected); setApiError(""); }
      } catch (error) { if (active) setApiError(error.message); }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [orderId, page, revision, orderQuery, orderStatus, authUser?.id]);

  useEffect(() => watchOrders(false, () => setRevision((value) => value + 1)), [authUser?.id]);

  const runAction = async (action, successMessage) => {
    setApiError(""); setNotice(""); setLoading(true);
    try { await action(); setNotice(successMessage); }
    catch (error) { setApiError(error.message); }
    finally { setLoading(false); }
  };
  const sectionLoading = loading || (["profile", "addresses", "security"].includes(subsection) && loadedSubsection !== subsection);
  return (
    <section className="store-page">
      <PageTitle
        title={tx("My account", "Tài khoản của tôi", lang)}
        desc={tx(
          "Manage your profile, addresses and orders",
          "Quản lý hồ sơ, địa chỉ và đơn hàng",
          lang,
        )}
      />
      <div className="account-layout">
        <nav className="account-nav">
          <a
            href="/account"
            className={!subsection ? "is-active" : ""}
            aria-current={!subsection ? "page" : undefined}
          >
            {tx("Overview", "Tổng quan", lang)}
          </a>
          <a
            href="/account/orders"
            className={subsection === "orders" ? "is-active" : ""}
            aria-current={subsection === "orders" ? "page" : undefined}
          >
            {tx("Orders", "Đơn hàng", lang)}
          </a>
          <a href="/account/notifications" className={subsection === "notifications" ? "is-active" : ""} aria-current={subsection === "notifications" ? "page" : undefined}>
            {tx("Notifications", "Thông báo", lang)}
          </a>
          <a
            href="/account/profile"
            className={subsection === "profile" ? "is-active" : ""}
            aria-current={subsection === "profile" ? "page" : undefined}
          >
            {tx("Profile", "Hồ sơ", lang)}
          </a>
          <a
            href="/account/addresses"
            className={subsection === "addresses" ? "is-active" : ""}
            aria-current={subsection === "addresses" ? "page" : undefined}
          >
            {tx("Addresses", "Địa chỉ", lang)}
          </a>
          <a href="/account/security" className={subsection === "security" ? "is-active" : ""} aria-current={subsection === "security" ? "page" : undefined}>
            {tx("Security", "Bảo mật", lang)}
          </a>
        </nav>
        <div className="account-panel">
          {apiError && <p className="catalog-feedback" role="alert">{apiError}</p>}
          {sectionLoading && <p className="catalog-feedback" role="status">{tx("Loading account information…", "Đang tải thông tin tài khoản…", lang)}</p>}
          {subsection === "notifications" ? (
            <AccountNotifications key={authUser?.id} language={language} navigate={navigate} />
          ) : subsection === "orders" ? (
            <>
              <div className="account-section-heading">
                <div>
                  <span className="section-kicker">TECHNEST</span>
                  <h2>
                    {orderId
                      ? tx("Order details", "Chi tiết đơn hàng", lang)
                      : tx("Order history", "Lịch sử đơn hàng", lang)}
                  </h2>
                </div>
                {orderId ? (
                  <button
                    type="button"
                    className="text-link account-back-orders"
                    onClick={() => navigate("/account/orders")}
                  >
                    <ArrowLeft size={15} /> {tx("All orders", "Tất cả đơn hàng", lang)}
                  </button>
                ) : (
                  <span className="account-count">
                    {orders.length} {tx("orders", "đơn hàng", lang)}
                  </span>
                )}
              </div>
              {!orderId && <div className="account-order-toolbar">
                <div className="account-order-filters">
                  <input aria-label="Tìm mã đơn" placeholder="Tìm mã đơn" value={orderQuery} onChange={(event) => { setOrderQuery(event.target.value); setPage(1); }}/>
                  <select aria-label="Lọc trạng thái đơn" value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setPage(1); }}>
                    <option value="">Tất cả trạng thái</option>
                    {["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
                {pagination && <div className="account-order-pagination">
                  <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Trang trước">←</button>
                  <span>Trang {pagination.page} / {pagination.totalPages || 1}</span>
                  <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Trang sau">→</button>
                </div>}
              </div>}
              {orderId ? (
                selectedOrder ? (
                  <>
                    <div className="order-detail-titlebar">
                      <div>
                        <span className="section-kicker">
                          {tx("ORDER NUMBER", "MÃ ĐƠN HÀNG", lang)}
                        </span>
                        <h3>{selectedOrder.orderNumber || `TN-${String(selectedOrder.id).padStart(8, "0")}`}</h3>
                        <p>
                          {tx("Placed on", "Đặt lúc", lang)}{" "}
                          {new Date(selectedOrder.createdAt).toLocaleString(
                            lang ? "vi-VN" : "en-US",
                          )}
                        </p>
                      </div>
                      <span className={orderStatusClass(selectedOrder)}>{orderStatusLabel(selectedOrder, lang)}</span>
                    </div>
                    <OrderProgress order={selectedOrder} language={language} />
                    <AfterSalesRequests order={selectedOrder}/>

                    {selectedOrder.statusHistory?.length > 0 && <section className="order-history-card">
                      <div className="order-detail-card-heading">
                        <Clock3 size={18} />
                        <h3>{tx("Status history", "Lịch sử cập nhật", lang)}</h3>
                      </div>
                      <ol className="order-history-list">
                        {selectedOrder.statusHistory.map((event) => <li className="order-history-item" key={event.id}>
                          <span className="order-history-marker" aria-hidden="true" />
                          <div className="order-history-content">
                            <strong>{historyStatusLabel(event.toStatus, lang)}</strong>
                            <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString(lang ? "vi-VN" : "en-US")}</time>
                            {event.note && <p>{event.note}</p>}
                          </div>
                        </li>)}
                      </ol>
                    </section>}
                    {["PENDING", "CONFIRMED", "PROCESSING"].includes(selectedOrder.status) && <button disabled={loading} onClick={() => runAction(async () => { await ordersApi.cancel(selectedOrder.id); setRevision((value) => value + 1); }, "Đã hủy đơn hàng")}>Hủy đơn hàng</button>}
                  </>
                ) : (
                  <div className="account-order-not-found">
                    <Box size={26} />
                    <strong>{tx("Order not found", "Không tìm thấy đơn hàng", lang)}</strong>
                    <p>
                      {tx(
                        "This order is unavailable for your account.",
                        "Không tìm thấy đơn hàng trong tài khoản hiện tại.",
                        lang,
                      )}
                    </p>
                  </div>
                )
              ) : orders.length ? (
                orders.map((o) => (
                  <button
                    className="order-row order-row-button"
                    key={o.id}
                    type="button"
                    onClick={() => navigate(`/account/orders/${encodeURIComponent(o.id)}`)}
                    aria-label={`${tx("View order", "Xem đơn hàng", lang)} ${o.orderNumber || o.id}`}
                  >
                    <strong>{o.orderNumber || `TN-${String(o.id).padStart(8, "0")}`}</strong>
                    <span>
                      {new Date(o.createdAt).toLocaleDateString(lang ? "vi-VN" : "en-US")}
                    </span>
                    <span className={orderStatusClass(o)}>{orderStatusLabel(o, lang)}</span>
                    <strong>{formatPrice(o.total)}</strong>
                    <span className="order-row-action">
                      {tx("Track", "Theo dõi", lang)} <ChevronRight size={15} />
                    </span>
                  </button>
                ))
              ) : (
                <p>
                  {tx(
                    "No orders yet. Your orders will appear here.",
                    "Bạn chưa có đơn hàng nào.",
                    lang,
                  )}
                </p>
              )}
            </>
          ) : subsection === "profile" ? (
            <form
              className="store-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                void runAction(async () => { const result = await accountApi.updateProfile({ fullName: data.fullName, phone: data.phone || null }); setProfileData(result); }, tx("Profile updated.", "Đã cập nhật hồ sơ.", lang));
              }}
            >
              <h2>{tx("Profile information", "Thông tin cá nhân", lang)}</h2>
              <label>
                {tx("Name", "Họ tên", lang)}
                <input name="fullName" value={profileData.fullName || ""} onChange={(event) => setProfileData((current) => ({ ...current, fullName: event.target.value }))} required maxLength={200} />
              </label>
              <label>
                {tx("Email", "Email", lang)}
                <input type="email" name="email" value={profileData.email || authUser?.email || ""} readOnly />
              </label>
              <label>
                {tx("Phone", "Số điện thoại", lang)}
                <input name="phone" value={profileData.phone || ""} onChange={(event) => setProfileData((current) => ({ ...current, phone: event.target.value }))} pattern="\+?[0-9 ()-]{7,30}" />
              </label>
              <button className="primary-button" disabled={loading}>{tx("Save profile", "Lưu hồ sơ", lang)}</button>
              {notice && <p>{notice}</p>}
            </form>
          ) : subsection === "addresses" ? (
            <form
              className="store-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const raw = Object.fromEntries(new FormData(form));
                void runAction(async () => { await accountApi.createAddress({ recipientName: raw.recipientName, phone: raw.phone, addressLine: raw.addressLine, city: raw.city, district: raw.district || null, ward: raw.ward || null, label: raw.label || null, isDefault: raw.isDefault === "on" }); setAddresses(await accountApi.addresses()); form.reset(); }, tx("Address saved.", "Đã lưu địa chỉ.", lang));
              }}
            >
              <h2>{tx("Addresses", "Địa chỉ", lang)}</h2>
              {addresses.map((address) => (
                <div className="address-row" key={address.id}>
                  <strong>{address.recipientName}</strong> · {address.phone}<br />
                  {address.addressLine}, {address.ward ? `${address.ward}, ` : ""}{address.district ? `${address.district}, ` : ""}{address.city}
                  {address.isDefault && <strong> · {tx("Default", "Mặc định", lang)}</strong>}
                  {!address.isDefault && <button type="button" className="text-link" onClick={() => void runAction(async () => { await accountApi.setDefaultAddress(address.id); setAddresses(await accountApi.addresses()); }, tx("Default address updated.", "Đã cập nhật địa chỉ mặc định.", lang))}>{tx("Set as default", "Đặt mặc định", lang)}</button>}
                  <button type="button" className="text-link" onClick={() => { if (window.confirm(tx("Delete this address?", "Xóa địa chỉ này?", lang))) void runAction(async () => { await accountApi.deleteAddress(address.id); setAddresses(await accountApi.addresses()); }, tx("Address deleted.", "Đã xóa địa chỉ.", lang)); }}>{tx("Delete", "Xóa", lang)}</button>
                </div>
              ))}
              <label>
                {tx("Recipient", "Người nhận", lang)}
                <input name="recipientName" required maxLength={200} />
              </label>
              <label>{tx("Phone", "Số điện thoại", lang)}<input name="phone" required pattern="\+?[0-9 ()-]{7,30}" /></label>
              <label>
                {tx("Street address", "Địa chỉ đường phố", lang)}
                <input name="addressLine" required maxLength={1000} />
              </label>
              <label>{tx("District", "Quận / huyện", lang)}<input name="district" maxLength={120} /></label>
              <label>{tx("Ward", "Phường / xã", lang)}<input name="ward" maxLength={120} /></label>
              <label>{tx("City / province", "Tỉnh / thành phố", lang)}<input name="city" required maxLength={120} /></label>
              <label>{tx("Label", "Nhãn địa chỉ", lang)}<input name="label" placeholder={tx("Home, Office…", "Nhà riêng, Công ty…", lang)} /></label>
              <label className="account-address-default"><input type="checkbox" name="isDefault" /> {tx("Set as default address", "Đặt làm địa chỉ mặc định", lang)}</label>
              <button className="primary-button" disabled={loading}>{tx("Add address", "Thêm địa chỉ", lang)}</button>
              {notice && <p>{notice}</p>}
            </form>
          ) : subsection === "security" ? (
            <div className="store-form">
              <h2>{tx("Account security", "Bảo mật tài khoản", lang)}</h2>
              <form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); void runAction(async () => { await accountApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword }); form.reset(); await onLogout(); }, tx("Password updated. Please sign in again.", "Đã đổi mật khẩu. Vui lòng đăng nhập lại.", lang)); }}>
                <label>{tx("Current password", "Mật khẩu hiện tại", lang)}<input type="password" name="currentPassword" autoComplete="current-password" required /></label>
                <label>{tx("New password (12+ characters, upper/lowercase and number)", "Mật khẩu mới (ít nhất 12 ký tự, có chữ hoa, chữ thường và số)", lang)}<input type="password" name="newPassword" autoComplete="new-password" minLength={12} required /></label>
                <button className="primary-button" disabled={loading}>{tx("Change password", "Đổi mật khẩu", lang)}</button>
              </form>
              <h3>{tx("Signed-in sessions", "Phiên đăng nhập", lang)}</h3>
              {sessions.map((session) => <div className="address-row" key={session.id}><strong>{tx("Session", "Phiên", lang)} #{session.id}</strong><p>{tx("Signed in", "Đăng nhập lúc", lang)}: {new Date(session.createdAt).toLocaleString(lang ? "vi-VN" : "en-US")}</p><p>{tx("Expires", "Hết hạn", lang)}: {new Date(session.expiresAt).toLocaleString(lang ? "vi-VN" : "en-US")}</p>{session.revokedAt ? <span>{tx("Revoked", "Đã thu hồi", lang)}</span> : <button type="button" className="text-link" onClick={() => void runAction(async () => { await accountApi.revokeSession(session.id); setSessions(await accountApi.sessions()); }, tx("Session revoked.", "Đã thu hồi phiên.", lang))}>{tx("Revoke", "Thu hồi", lang)}</button>}</div>)}
              {!sessions.length && <p>{tx("No active sessions found.", "Không có phiên đăng nhập nào.", lang)}</p>}
              {notice && <p>{notice}</p>}
            </div>
          ) : (
            <div className="account-dashboard">
              <section className="account-welcome">
                <div className="account-avatar" aria-hidden="true">
                  {initials}
                </div>
                <div className="account-welcome-copy">
                  <span className="section-kicker">
                    {tx("YOUR TECHNEST ACCOUNT", "TÀI KHOẢN TECHNEST CỦA BẠN", lang)}
                  </span>
                  <h2>
                    {tx("Welcome back", "Xin chào trở lại", lang)}, {accountName}
                  </h2>
                  <p>{authUser?.email || profileData.email}</p>
                </div>
                <span className="account-active-status">
                  <i />
                  {tx("Account active", "Tài khoản hoạt động", lang)}
                </span>
              </section>

              <div className="account-stats">
                <article className="account-stat-card">
                  <span className="account-stat-icon">
                    <Box size={18} />
                  </span>
                  <span className="account-stat-label">
                    {tx("Orders placed", "Đơn hàng", lang)}
                  </span>
                  <strong>{orders.length}</strong>
                  <small>{tx("Your order history", "Lịch sử mua hàng", lang)}</small>
                </article>
                <article className="account-stat-card">
                  <span className="account-stat-icon">
                    <CircleUserRound size={18} />
                  </span>
                  <span className="account-stat-label">
                    {tx("Total spent", "Tổng chi tiêu", lang)}
                  </span>
                  <strong>{formatPrice(totalSpent)}</strong>
                  <small>{tx("Across your orders", "Từ các đơn hàng", lang)}</small>
                </article>
                <article className="account-stat-card">
                  <span className="account-stat-icon">
                    <MapPin size={18} />
                  </span>
                  <span className="account-stat-label">
                    {tx("Saved addresses", "Địa chỉ đã lưu", lang)}
                  </span>
                  <strong>{addresses.length}</strong>
                  <small>{tx("For a quicker checkout", "Giúp thanh toán nhanh hơn", lang)}</small>
                </article>
              </div>

              <div className="account-dashboard-grid">
                <section className="account-dashboard-card">
                  <div className="account-section-heading">
                    <div>
                      <span className="section-kicker">TECHNEST</span>
                      <h2>{tx("Recent orders", "Đơn hàng gần đây", lang)}</h2>
                    </div>
                    <a className="text-link" href="/account/orders">
                      {tx("See all", "Xem tất cả", lang)} <ArrowRight size={14} />
                    </a>
                  </div>
                  {orders.length ? (
                    <div className="account-recent-orders">
                      {[...orders].slice(0, 3).map((order) => (
                        <button
                          className="account-recent-order account-recent-order-button"
                          key={order.id}
                          type="button"
                          onClick={() =>
                            navigate(`/account/orders/${encodeURIComponent(order.id)}`)
                          }
                        >
                          <span className="account-order-icon">
                            <Box size={17} />
                          </span>
                          <div className="account-order-info">
                            <strong>{order.orderNumber || `TN-${String(order.id).padStart(8, "0")}`}</strong>
                            <span>
                              {new Date(order.createdAt).toLocaleDateString(
                                lang ? "vi-VN" : "en-US",
                              )}
                            </span>
                          </div>
                          <span className="status-pill">{orderStatusLabel(order, lang)}</span>
                          <strong className="account-order-total">
                            {formatPrice(order.total)}
                          </strong>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="account-empty-orders">
                      <Box size={25} />
                      <strong>
                        {tx(
                          "Your next favorite is waiting",
                          "Đơn hàng đầu tiên đang chờ bạn",
                          lang,
                        )}
                      </strong>
                      <p>
                        {tx(
                          "Once you place an order, you can track it here.",
                          "Đơn hàng của bạn sẽ xuất hiện tại đây sau khi thanh toán.",
                          lang,
                        )}
                      </p>
                      <a className="text-link" href="/products">
                        {tx("Explore products", "Khám phá sản phẩm", lang)} <ArrowRight size={14} />
                      </a>
                    </div>
                  )}
                </section>

                <section className="account-dashboard-card account-quick-links">
                  <span className="section-kicker">
                    {tx("QUICK ACCESS", "TRUY CẬP NHANH", lang)}
                  </span>
                  <h2>{tx("Manage your account", "Quản lý tài khoản", lang)}</h2>
                  <a href="/account/profile">
                    <span className="quick-link-icon">
                      <CircleUserRound size={17} />
                    </span>
                    <span>
                      <strong>{tx("Personal details", "Thông tin cá nhân", lang)}</strong>
                      <small>{tx("Update your profile", "Cập nhật hồ sơ", lang)}</small>
                    </span>
                    <ArrowRight size={15} />
                  </a>
                  <a href="/account/addresses">
                    <span className="quick-link-icon">
                      <MapPin size={17} />
                    </span>
                    <span>
                      <strong>{tx("Delivery addresses", "Địa chỉ giao hàng", lang)}</strong>
                      <small>{tx("Manage saved addresses", "Quản lý địa chỉ đã lưu", lang)}</small>
                    </span>
                    <ArrowRight size={15} />
                  </a>
                  <div className="account-security-note">
                    <ShieldCheck size={18} />
                    <span>
                      {tx(
                        "Your account is protected with secure sign-in.",
                        "Tài khoản được bảo vệ bằng đăng nhập an toàn.",
                        lang,
                      )}
                    </span>
                  </div>
                  <button className="text-link account-signout" type="button" onClick={onLogout}>
                    {tx("Sign out", "Đăng xuất", lang)}
                  </button>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
