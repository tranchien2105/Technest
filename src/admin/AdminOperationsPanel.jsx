import { useEffect, useState } from "react";
import { Plus, X, Save, Image, Ticket, Mail, Users, History, RotateCcw } from "lucide-react";
import { opsRequest, uploadImages } from "./operationsApi";
import AdminPagination from "./AdminPagination";
import { useAdminPageSize, useDebouncedValue } from "./useAdminList";
import { formatPrice } from "../utils/formatCurrency";
import ProductImage from "../components/common/ProductImage";
import CurrencyInput from "../components/common/CurrencyInput";
import PasswordInput from "../components/common/PasswordInput";
const names = {
  banners: "Banner quảng cáo",
  vouchers: "Mã giảm giá",
  staff: "Nhân viên",
  audit: "Nhật ký thao tác",
  emails: "Email đơn hàng",
  "after-sales": "Đổi trả & bảo hành",
};
const icons = {
  banners: Image,
  vouchers: Ticket,
  staff: Users,
  audit: History,
  emails: Mail,
  "after-sales": RotateCcw,
};
const statusNames = {
  ACTIVE: "Đang bật",
  INACTIVE: "Đang tắt",
  BLOCKED: "Đã khóa",
  PENDING: "Chờ gửi",
  PROCESSING: "Đang gửi",
  SENT: "Đã gửi",
  FAILED: "Thất bại",
  REQUESTED: "Mới tiếp nhận",
  APPROVED: "Đã duyệt",
  RECEIVED: "Đã nhận hàng",
  RESOLVED: "Đã xử lý",
  REJECTED: "Từ chối",
  SUCCESS: "Thành công",
};
const scopes = {
  dashboard: "Tổng quan",
  products: "Sản phẩm & ảnh",
  catalog: "Danh mục / thương hiệu",
  inventory: "Tồn kho",
  orders: "Đơn hàng",
  "flash-sales": "Flash Sale",
  customers: "Khách hàng",
  settings: "Cài đặt",
  banners: "Banner",
  vouchers: "Mã giảm giá",
  reports: "Báo cáo / xuất Excel",
  "after-sales": "Đổi trả & bảo hành",
  emails: "Email",
  audit: "Nhật ký",
};
const dateInput = (v) =>
  v
    ? new Date(new Date(v).getTime() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const dateText = (v) => (v ? new Date(v).toLocaleString("vi-VN") : "—");
const placementNames = { HOME_HERO: "Hero Slider chính", HOME_HERO_RIGHT_TOP: "Hero bên phải · Trên", HOME_HERO_RIGHT_BOTTOM: "Hero bên phải · Dưới", HOME_PROMO: "Ưu đãi giữa trang", HOME_BOTTOM: "Banner cuối trang", HOME_SETUP_STUDIO: "Setup Studio · Banner dọc" };
const fresh = (kind) =>
  kind === "banners"
    ? {
        title: "",
        subtitle: "",
        imageUrl: "",
        link: "/products",
        buttonText: "Khám phá ngay",
        position: "HOME_PROMO",
        sortOrder: 0,
        active: true,
        startsAt: null,
        endsAt: null,
      }
    : kind === "vouchers"
      ? {
          code: "",
          name: "",
          type: "FIXED",
          value: "",
          minSubtotal: "0",
          maxDiscount: null,
          usageLimit: 100,
          perUserLimit: 1,
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          active: true,
        }
      : kind === "staff"
        ? { email: "", fullName: "", password: "", status: "ACTIVE", permissions: [] }
        : { orderId: "", itemId: "", type: "RETURN", quantity: 1, reason: "" };
export default function AdminOperationsPanel({ kind, canWrite = true }) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [type, setType] = useState(""),
    [page, setPage] = useState(1),
    [limit, setLimit] = useAdminPageSize(kind),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState(null),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const search = useDebouncedValue(q);
  useEffect(() => {
    const c = new AbortController();
    const params = new URLSearchParams({
      page,
      limit,
      ...(search ? { q: search } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    });
    opsRequest(`${kind}?${params}`, { signal: c.signal })
      .then((d) => {
        if (!c.signal.aborted) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => c.abort();
  }, [kind, page, limit, search, status, type, version]);
  useEffect(() => {
    if (kind !== "banners") return undefined;
    const locate = (event) => { setType(event.detail?.position || "UNASSIGNED"); setPage(1); };
    const createBanner = () => { setError(""); setEditor(fresh(kind)); };
    window.addEventListener("technest:banner-location", locate);
    window.addEventListener("technest:banner-create", createBanner);
    const editBanner = (event) => { if (event.detail?.id) setEditor(event.detail); };
    window.addEventListener("technest:banner-edit", editBanner);
    return () => { window.removeEventListener("technest:banner-location", locate); window.removeEventListener("technest:banner-create", createBanner); window.removeEventListener("technest:banner-edit", editBanner); };
  }, [kind]);
  useEffect(() => {
    if (!editor) return;
    const close = (event) => { if (event.key === "Escape" && !busy) setEditor(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [editor, busy]);
  const change = (key, value) => setEditor((e) => ({ ...e, [key]: value }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { ...editor };
      if (kind === "banners" && !payload.position) payload.position = null;
      delete payload.id;
      delete payload._current;
      delete payload._type;
      if (kind === "vouchers" && !payload.maxDiscount) payload.maxDiscount = null;
      if (kind === "after-sales" && payload.resolution !== "REFUND") payload.refundAmount = "0";
      if (kind === "staff" && !payload.password) delete payload.password;
      const id = editor.id;
      await opsRequest(`${kind}${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        body: payload,
      });
      setEditor(null);
      setVersion((v) => v + 1);
      if (kind === "banners") window.dispatchEvent(new Event("technest:banners-changed"));
      setMessage("Đã lưu thay đổi.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const edit = (row) => {
    const keys = Object.keys(fresh(kind));
    setEditor(
      Object.fromEntries([["id", row.id], ...keys.map((k) => [k, k === "password" ? "" : row[k]])]),
    );
  };
  const retry = async (row) => {
    if (!window.confirm(`Gửi lại email đến ${row.recipientEmail}?`)) return;
    setBusy(true);
    setError("");
    try {
      await opsRequest(`emails/${row.id}/retry`, { method: "POST" });
      setMessage("Đã đưa email vào hàng đợi gửi lại.");
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const statuses =
    kind === "emails"
      ? ["PENDING", "PROCESSING", "SENT", "FAILED"]
      : kind === "after-sales"
        ? ["REQUESTED", "APPROVED", "RECEIVED", "RESOLVED", "REJECTED"]
        : kind === "audit"
          ? ["SUCCESS", "FAILED"]
          : kind === "staff"
            ? ["ACTIVE", "BLOCKED"]
            : ["ACTIVE", "INACTIVE"];
  const Icon = icons[kind];
  const field = (key, label, opts = {}) => {
    const inputProps = { ...opts };
    const currency = Boolean(inputProps.currency);
    delete inputProps.currency;
    if (currency) delete inputProps.pattern;
    const value = editor[key] ?? "";
    const onValueChange = (nextValue) =>
      change(key, inputProps.type === "number" ? Number(nextValue) : nextValue);
    const Input = inputProps.type === "password" ? PasswordInput : null;
    return (
      <label key={key}>
        {label}
        {currency ? (
          <CurrencyInput {...inputProps} value={value} onValueChange={onValueChange} />
        ) : Input ? (
          <Input {...inputProps} value={value} onChange={(event) => onValueChange(event.target.value)} />
        ) : (
          <input {...inputProps} value={value} onChange={(event) => onValueChange(event.target.value)} />
        )}
      </label>
    );
  };
  return (
    <section className="admin-panel admin-operations">
      <div className="admin-panel-heading">
        <div>
          <h2>
            <Icon size={20} /> {names[kind]}
          </h2>
          <p>
            {kind === "emails"
              ? "Theo dõi hàng đợi, số lần gửi và lỗi. Gửi lại tạo lượt gửi mới và giữ nguyên lịch sử."
              : kind === "audit"
                ? "Ghi nhận thao tác thay đổi dữ liệu và kết quả xử lý."
                : kind === "after-sales"
                  ? "Tiếp nhận → duyệt → nhận hàng → xử lý. Hoàn tiền được ghi nhận thủ công."
                  : "Quản lý nội dung và dữ liệu đang được sử dụng trong cửa hàng."}
          </p>
        </div>
        {canWrite && !["audit", "emails"].includes(kind) && (
          <button
            className="admin-primary-button"
            onClick={() => {
              setError("");
              setEditor(fresh(kind));
            }}
          >
            <Plus size={16} /> Thêm mới
          </button>
        )}
      </div>
      <div className="admin-filter-bar">
        <label className="admin-filter-field admin-filter-search">
          <span>Tìm kiếm</span>
          <input
            placeholder="Tìm theo tên, mã hoặc email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="admin-filter-field">
          <span>Trạng thái</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusNames[s]}
              </option>
            ))}
          </select>
        </label>
        {["banners", "after-sales"].includes(kind) && (
          <label className="admin-filter-field">
            <span>{kind === "banners" ? "Vị trí" : "Loại yêu cầu"}</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {(kind === "banners"
                ? [
                    ["HOME_HERO", "Đầu trang"],
                    ["HOME_HERO_RIGHT_TOP", "Hero bên phải · Trên"],
                    ["HOME_HERO_RIGHT_BOTTOM", "Hero bên phải · Dưới"],
                    ["HOME_PROMO", "Giữa trang"],
                    ["HOME_BOTTOM", "Cuối trang"],
                    ["HOME_SETUP_STUDIO", "Setup Studio · Banner dọc"],
                    ["UNASSIGNED", "Chưa sử dụng"],
                  ]
                : [
                    ["RETURN", "Đổi trả"],
                    ["WARRANTY", "Bảo hành"],
                  ]
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="admin-success">
          {message}
        </p>
      )}
      {loading && <p>Đang tải…</p>}
      <div className="admin-ops-list">
        {data?.items.map((row) => (
          <article className="admin-ops-row" key={row.id}>
            {kind === "banners" ? (
              <>
                <ProductImage src={row.imageUrl} alt={row.title} />
                <div className="admin-ops-main">
                  <strong>{row.title}</strong>
                  <p>{row.subtitle}</p>
                  <small>
                    {placementNames[row.position] || "Chưa sử dụng"}{" "}
                    · Thứ tự {row.sortOrder} · {row.link}
                  </small>
                  <small>
                    {dateText(row.startsAt)} → {dateText(row.endsAt)} ·{" "}
                    {row.active ? "Đang bật" : "Đang tắt"}
                  </small>
                </div>
                <div className="admin-row-actions">
                  <button onClick={() => window.dispatchEvent(new CustomEvent("technest:banner-location", { detail: { id: row.id, position: row.position } }))}>Xem vị trí</button>
                  {canWrite && <>
                    <button onClick={() => edit(row)}>Chỉnh sửa</button>
                    <button
                      disabled={busy}
                      onClick={async () => {
                        if (!confirm("Xóa banner này?")) return;
                        try {
                          await opsRequest(`banners/${row.id}`, { method: "DELETE" });
                          setVersion((v) => v + 1);
                          window.dispatchEvent(new Event("technest:banners-changed"));
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Xóa
                    </button>
                  </>}
                </div>
              </>
            ) : kind === "vouchers" ? (
              <>
                <div className="admin-code-mark">
                  <Ticket size={24} />
                </div>
                <div className="admin-ops-main">
                  <strong>
                    {row.code} · {row.name}
                  </strong>
                  <p>
                    Giảm {row.type === "PERCENT" ? `${row.value}%` : formatPrice(row.value)}
                    {row.maxDiscount ? ` · tối đa ${formatPrice(row.maxDiscount)}` : ""} · Đơn từ{" "}
                    {formatPrice(row.minSubtotal)}
                  </p>
                  <small>
                    {row.usedCount}/{row.usageLimit} lượt · {row.perUserLimit} lượt/người ·{" "}
                    {row.active ? "Đang bật" : "Đã tắt"}
                  </small>
                  <small>
                    {dateText(row.startsAt)} → {dateText(row.endsAt)}
                  </small>
                </div>
                {canWrite && <button onClick={() => edit(row)}>Chỉnh sửa</button>}
              </>
            ) : kind === "staff" ? (
              <>
                <div className="admin-code-mark">
                  <Users size={24} />
                </div>
                <div className="admin-ops-main">
                  <strong>{row.fullName}</strong>
                  <p>
                    {row.email} · {statusNames[row.status]}
                  </p>
                  <div className="admin-permission-tags">
                    {row.permissions.map((p) => (
                      <span key={p}>
                        {scopes[p.split(":")[0]]} · {p.endsWith(":write") ? "Sửa" : "Xem"}
                      </span>
                    ))}
                  </div>
                </div>
                {canWrite && <button onClick={() => edit(row)}>Phân quyền / sửa</button>}
              </>
            ) : kind === "emails" ? (
              <>
                <div className="admin-code-mark">
                  <Mail size={24} />
                </div>
                <div className="admin-ops-main">
                  <strong>
                    {row.orderNumber || `Đơn #${row.orderId}`} · {row.recipientEmail}
                  </strong>
                  <p>
                    {({ORDER_PLACED:"Tạo đơn",ORDER_CONFIRMED:"Xác nhận đơn",ORDER_PROCESSING:"Chuẩn bị hàng",ORDER_SHIPPED:"Giao hàng",ORDER_DELIVERED:"Đã giao",ORDER_CANCELLED:"Hủy đơn"}[row.eventType] || row.eventType)} · {statusNames[row.status]} ·{" "}
                    {row.attempts} lần thử{row.retryOfId ? ` · Gửi lại từ #${row.retryOfId}` : ""}
                  </p>
                  <small>
                    {dateText(row.createdAt)}
                    {row.sentAt ? ` · Gửi lúc ${dateText(row.sentAt)}` : ""}
                  </small>
                  {row.lastError && <p className="admin-error">{row.lastError}</p>}
                </div>
                {canWrite && ["SENT", "FAILED"].includes(row.status) && (
                  <button disabled={busy} onClick={() => void retry(row)}>
                    Gửi lại
                  </button>
                )}
              </>
            ) : kind === "audit" ? (
              <>
                <div className="admin-code-mark">
                  <History size={24} />
                </div>
                <div className="admin-ops-main">
                  <strong>
                    {row.actorEmail || "Hệ thống"} · {row.action}
                  </strong>
                  <p>{row.resource}</p>
                  <small>
                    {dateText(row.createdAt)} ·{" "}
                    {row.statusCode === null
                      ? "Đang xử lý"
                      : `${row.statusCode < 400 ? "Thành công" : "Thất bại"} (${row.statusCode})`}
                  </small>
                  <div className="admin-permission-tags">
                    {Object.entries(row.details || {}).map(([k, v]) => (
                      <span key={k}>
                        {k}: {Array.isArray(v) ? v.join(", ") : String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <ProductImage src={row.image} alt={row.productName} />
                <div className="admin-ops-main">
                  <strong>
                    {row.orderNumber} · {row.productName}
                  </strong>
                  <p>
                    {row.customer} · {row.email}
                  </p>
                  <p>
                    {row.type === "RETURN" ? "Đổi trả" : "Bảo hành"} · SL {row.quantity} ·{" "}
                    {statusNames[row.status]}
                  </p>
                  <small>{row.reason}</small>
                  {row.adminNote && <small>Ghi chú: {row.adminNote}</small>}
                  {Number(row.refundAmount) > 0 && (
                    <small>Tiền hoàn đã ghi nhận: {formatPrice(row.refundAmount)}</small>
                  )}
                  {row.restockedAt && <small>Đã nhập lại kho</small>}
                </div>
                {canWrite && !["RESOLVED", "REJECTED"].includes(row.status) && (
                  <button
                    onClick={() =>
                      setEditor({
                        id: row.id,
                        status:
                          row.status === "REQUESTED"
                            ? "APPROVED"
                            : row.status === "APPROVED"
                              ? "RECEIVED"
                              : "RESOLVED",
                        adminNote: "",
                        resolution: null,
                        refundAmount: "0",
                        restock: false,
                        _current: row.status,
                        _type: row.type,
                      })
                    }
                  >
                    Xử lý yêu cầu
                  </button>
                )}
              </>
            )}
          </article>
        ))}
        {data?.items.length === 0 && <div className="admin-empty">Chưa có dữ liệu phù hợp.</div>}
      </div>
      <AdminPagination
        pagination={data?.pagination}
        limit={limit}
        onLimitChange={(s) => {
          setLimit(s);
          setPage(1);
        }}
        onPageChange={setPage}
        loading={loading}
      />
      {editor && (
        <div className="admin-modal-backdrop">
          <form
            className="admin-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label={names[kind]}
            onSubmit={save}
          >
            <header>
              <h2>
                {editor.id ? "Cập nhật" : "Thêm"} {names[kind].toLowerCase()}
              </h2>
              <button
                type="button"
                className="admin-icon-button"
                aria-label="Đóng"
                onClick={() => setEditor(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="admin-editor-fields">
              {kind === "banners" ? (
                <>
                  {field("title", "Tiêu đề", { required: true, maxLength: 160 })}
                  {field("buttonText", "Nút hành động", { required: true, maxLength: 60 })}
                  <label className="admin-editor-wide">
                    Mô tả
                    <textarea
                      value={editor.subtitle}
                      onChange={(e) => change("subtitle", e.target.value)}
                    />
                  </label>
                  {field("imageUrl", "Đường dẫn ảnh", { required: true })}
                  <label>
                    Tải ảnh từ máy
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={async (e) => {
                        if (!e.target.files[0]) return;
                        setBusy(true);
                        try {
                          const [img] = await uploadImages([e.target.files[0]], "banners");
                          change("imageUrl", img.url);
                        } catch (e) {
                          setError(e.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </label>
                  {editor.imageUrl && <ProductImage src={editor.imageUrl} alt={editor.title} />}
                  {field("link", "Đường dẫn khi nhấn", {
                    required: true,
                    placeholder: "/products",
                  })}
                  <label>
                    Vị trí
                    <select
                      value={editor.position || ""}
                      onChange={(e) => change("position", e.target.value)}
                    >
                      <option value="HOME_HERO">Hero Slider chính</option>
                      <option value="HOME_HERO_RIGHT_TOP">Hero bên phải · Trên</option>
                      <option value="HOME_HERO_RIGHT_BOTTOM">Hero bên phải · Dưới</option>
                      <option value="HOME_PROMO">Ưu đãi giữa trang</option>
                      <option value="HOME_BOTTOM">Banner cuối trang</option>
                      <option value="HOME_SETUP_STUDIO">Setup Studio · Banner dọc</option>
                      <option value="">Chưa sử dụng</option>
                    </select>
                  </label>
                  {field("sortOrder", "Thứ tự", { type: "number", min: 0, max: 999 })}
                  {["startsAt", "endsAt"].map((key, i) => (
                    <label key={key}>
                      {i ? "Kết thúc (không bắt buộc)" : "Bắt đầu (không bắt buộc)"}
                      <input
                        type="datetime-local"
                        value={dateInput(editor[key])}
                        onChange={(e) =>
                          change(
                            key,
                            e.target.value ? new Date(e.target.value).toISOString() : null,
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={editor.active}
                      onChange={(e) => change("active", e.target.checked)}
                    />{" "}
                    Hiển thị banner
                  </label>
                </>
              ) : kind === "vouchers" ? (
                <>
                  {field("code", "Mã giảm giá", { required: true, maxLength: 40 })}
                  {field("name", "Tên chương trình", { required: true })}
                  <label>
                    Loại giảm
                    <select value={editor.type} onChange={(e) => change("type", e.target.value)}>
                      <option value="FIXED">Giảm tiền (₫)</option>
                      <option value="PERCENT">Giảm phần trăm (%)</option>
                    </select>
                  </label>
                  {field("value", "Mức giảm", {
                    required: true,
                    currency: editor.type === "FIXED",
                    inputMode: "numeric",
                    pattern: "[0-9]+",
                  })}
                  {field("minSubtotal", "Đơn tối thiểu (₫)", {
                    required: true,
                    currency: true,
                    inputMode: "numeric",
                    pattern: "[0-9]+",
                  })}
                  {field("maxDiscount", "Giảm tối đa (₫, có thể bỏ trống)", {
                    currency: true,
                    inputMode: "numeric",
                    pattern: "[0-9]*",
                  })}
                  {field("usageLimit", "Tổng lượt sử dụng", {
                    type: "number",
                    min: 1,
                    required: true,
                  })}
                  {field("perUserLimit", "Số lượt/người", {
                    type: "number",
                    min: 1,
                    required: true,
                  })}
                  {["startsAt", "endsAt"].map((key, i) => (
                    <label key={key}>
                      {i ? "Ngày kết thúc" : "Ngày bắt đầu"}
                      <input
                        type="datetime-local"
                        required
                        value={dateInput(editor[key])}
                        onChange={(e) =>
                          change(key, e.target.value ? new Date(e.target.value).toISOString() : "")
                        }
                      />
                    </label>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={editor.active}
                      onChange={(e) => change("active", e.target.checked)}
                    />{" "}
                    Cho phép sử dụng
                  </label>
                </>
              ) : kind === "staff" ? (
                <>
                  {field("fullName", "Họ và tên", { required: true })}
                  {field("email", "Email", { type: "email", required: true })}
                  {field(
                    "password",
                    editor.id ? "Mật khẩu mới (bỏ trống để giữ nguyên)" : "Mật khẩu",
                    {
                      type: "password",
                      required: !editor.id,
                      minLength: 8,
                      autoComplete: "new-password",
                    },
                  )}
                  <label>
                    Trạng thái
                    <select
                      value={editor.status}
                      onChange={(e) => change("status", e.target.value)}
                    >
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="BLOCKED">Khóa tài khoản</option>
                    </select>
                  </label>
                  <div className="admin-editor-wide admin-permission-grid">
                    {Object.entries(scopes).map(([scope, label]) => (
                      <div key={scope}>
                        <strong>{label}</strong>
                        {[
                          "read",
                          ...(["reports", "audit", "dashboard"].includes(scope) ? [] : ["write"]),
                        ].map((action) => (
                          <label key={action}>
                            <input
                              type="checkbox"
                              checked={editor.permissions.includes(`${scope}:${action}`)}
                              onChange={(e) =>
                                change(
                                  "permissions",
                                  e.target.checked
                                    ? [...editor.permissions, `${scope}:${action}`]
                                    : editor.permissions.filter((p) => p !== `${scope}:${action}`),
                                )
                              }
                            />
                            {action === "read" ? "Xem" : "Thay đổi"}
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              ) : editor.id ? (
                <>
                  <label>
                    Trạng thái tiếp theo
                    <select
                      value={editor.status}
                      onChange={(e) => change("status", e.target.value)}
                    >
                      {(editor._current === "REQUESTED"
                        ? ["APPROVED", "REJECTED"]
                        : editor._current === "APPROVED"
                          ? ["RECEIVED", "REJECTED"]
                          : ["RESOLVED"]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {statusNames[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-editor-wide">
                    Ghi chú xử lý
                    <textarea
                      maxLength={2000}
                      value={editor.adminNote}
                      onChange={(e) => change("adminNote", e.target.value)}
                    />
                  </label>
                  {editor.status === "RESOLVED" && (
                    <>
                      <label>
                        Phương án
                        <select
                          required
                          value={editor.resolution || ""}
                          onChange={(e) => change("resolution", e.target.value)}
                        >
                          <option value="">Chọn phương án</option>
                          <option value="REFUND">Đã hoàn tiền thủ công</option>
                          <option value="REPLACEMENT">Đã đổi hàng thủ công</option>
                          <option value="REPAIRED">Đã sửa chữa</option>
                        </select>
                      </label>
                      {editor.resolution === "REFUND" &&
                        field("refundAmount", "Tiền đã hoàn (₫)", {
                          required: true,
                          currency: true,
                        })}
                      {editor._type === "RETURN" && (
                        <label>
                          <input
                            type="checkbox"
                            checked={editor.restock}
                            onChange={(e) => change("restock", e.target.checked)}
                          />{" "}
                          Hàng đạt yêu cầu, nhập lại tồn kho
                        </label>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  {field("orderId", "ID đơn hàng", { required: true, pattern: "[0-9]+" })}
                  {field("itemId", "ID dòng sản phẩm trong đơn", {
                    required: true,
                    pattern: "[0-9]+",
                  })}
                  <label>
                    Loại
                    <select value={editor.type} onChange={(e) => change("type", e.target.value)}>
                      <option value="RETURN">Đổi trả</option>
                      <option value="WARRANTY">Bảo hành</option>
                    </select>
                  </label>
                  {field("quantity", "Số lượng", {
                    type: "number",
                    min: 1,
                    max: 100,
                    required: true,
                  })}
                  <label className="admin-editor-wide">
                    Lý do
                    <textarea
                      minLength={10}
                      required
                      value={editor.reason}
                      onChange={(e) => change("reason", e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            <footer>
              <button type="button" onClick={() => setEditor(null)}>
                Hủy
              </button>
              <button className="admin-primary-button" disabled={busy}>
                <Save size={16} />
                {busy ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
