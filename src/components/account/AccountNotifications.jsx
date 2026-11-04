import { useCallback, useEffect, useState } from "react";
import { Bell, Check, ChevronLeft, ChevronRight, CircleAlert, PackageCheck, ShieldCheck, Tag } from "lucide-react";
import { notificationsApi } from "../../api/notificationsClient";
import { useNotifications } from "../../hooks/notificationsContext";

const filters = [["", "Tất cả"], ["ORDERS", "Đơn hàng"], ["PROMOTIONS", "Khuyến mãi"], ["ACCOUNT", "Tài khoản & Bảo mật"], ["SYSTEM", "Hệ thống"]];
const icons = { ORDER_STATUS_UPDATED: PackageCheck, ORDER_CANCELLED: CircleAlert, ORDER_DELIVERED: PackageCheck, PROMOTION_AVAILABLE: Tag, PROMOTION_EXPIRING: Tag, PAYMENT_SUCCEEDED: Check, PAYMENT_FAILED: CircleAlert, ACCOUNT_UPDATED: ShieldCheck, ACCOUNT_LOCKED: ShieldCheck, SECURITY_ALERT: ShieldCheck, SYSTEM_ANNOUNCEMENT: Bell };

export default function AccountNotifications({ language = "vi", navigate }) {
  const isVietnamese = language === "vi";
  const { revision, refreshUnreadCount } = useNotifications();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pagination: null });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (signal) => {
    try {
      const [list, count] = await Promise.all([
        notificationsApi.list({ page, limit: 15, ...(category ? { category } : {}) }, { signal }),
        notificationsApi.unreadCount({ signal }),
      ]);
      if (signal?.aborted) return;
      setResult(list); setUnreadCount(count?.unreadCount ?? 0); setError("");
    } catch (cause) {
      if (cause?.name !== "AbortError") setError(cause.message || "Không thể tải thông báo.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [page, category]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, revision]);

  const markRead = async (id) => {
    const previousResult = result;
    const previousUnreadCount = unreadCount;
    const markedAt = new Date().toISOString();
    setResult((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, readAt: markedAt } : item) }));
    setUnreadCount((count) => Math.max(0, count - 1));
    setSaving(true);
    try { await notificationsApi.markRead(id); await refreshUnreadCount(); }
    catch (cause) {
      setResult(previousResult);
      setUnreadCount(previousUnreadCount);
      setError(cause.message || "Không thể cập nhật thông báo.");
    }
    finally { setSaving(false); }
  };
  const markAllRead = async () => {
    const previousResult = result;
    const previousUnreadCount = unreadCount;
    const markedAt = new Date().toISOString();
    setResult((current) => ({ ...current, items: current.items.map((item) => item.readAt ? item : { ...item, readAt: markedAt }) }));
    setUnreadCount(0);
    setSaving(true);
    try { await notificationsApi.markAllRead(); await refreshUnreadCount(); }
    catch (cause) {
      setResult(previousResult);
      setUnreadCount(previousUnreadCount);
      setError(cause.message || "Không thể cập nhật thông báo.");
    }
    finally { setSaving(false); }
  };
  const openNotification = async (notification) => {
    if (!notification.readAt) void markRead(notification.id);
    if (notification.targetUrl?.startsWith("/") && !notification.targetUrl.startsWith("//")) navigate?.(notification.targetUrl, true);
  };

  return <section className="account-notifications" aria-labelledby="notifications-heading">
    <header className="account-notifications-heading">
      <div><span className="section-kicker">TECHNEST</span><h2 id="notifications-heading">Thông báo</h2><p>Bạn có {unreadCount} thông báo chưa đọc</p></div>
      <button type="button" className="account-notifications-read-all" disabled={!unreadCount || saving} onClick={markAllRead}><Check size={15} /> Đánh dấu tất cả đã đọc</button>
    </header>
    <div className="account-notifications-filters" role="tablist" aria-label="Lọc thông báo">
      {filters.map(([value, label]) => <button type="button" role="tab" aria-selected={category === value} className={category === value ? "is-active" : ""} key={value || "all"} onClick={() => { setCategory(value); setPage(1); }}>{label}</button>)}
    </div>
    {error && <p className="catalog-feedback" role="alert">{error}</p>}
    {loading ? <div className="account-notifications-state" role="status">Đang tải thông báo…</div> : result.items.length === 0 ? <div className="account-notifications-state"><Bell size={25} /><strong>Chưa có thông báo</strong><span>Thông báo mới sẽ xuất hiện tại đây.</span></div> : <div className="account-notifications-list">
      {result.items.map((notification) => {
        const Icon = icons[notification.type] || Bell;
        return <article className={`account-notification-row ${notification.readAt ? "" : "is-unread"}`} key={notification.id}>
          <span className="account-notification-icon"><Icon size={19} /></span>
          <button className="account-notification-content" type="button" onClick={() => void openNotification(notification)}>
            <span className="account-notification-title">{notification.title}{!notification.readAt && <i aria-label="Chưa đọc" />}</span>
            <span>{notification.message}</span>
            <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString(isVietnamese ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</time>
          </button>
          {!notification.readAt && <button type="button" className="account-notification-mark" aria-label="Đánh dấu đã đọc" disabled={saving} onClick={() => void markRead(notification.id)}><Check size={16} /></button>}
        </article>;
      })}
    </div>}
    {result.pagination?.totalPages > 1 && <footer className="account-notifications-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} aria-label="Trang trước"><ChevronLeft size={17} /></button><span>Trang {page} / {result.pagination.totalPages}</span><button type="button" disabled={page >= result.pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} aria-label="Trang sau"><ChevronRight size={17} /></button></footer>}
  </section>;
}
