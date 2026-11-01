import { useRef, useState } from "react";
import { opsRequest } from "./operationsApi";
export default function AdminBulkActions({ ids, references, onComplete, onClear }) {
  const [action, setAction] = useState("STATUS"),
    [status, setStatus] = useState("INACTIVE"),
    [categoryId, setCategoryId] = useState(""),
    [brandId, setBrandId] = useState(""),
    [price, setPrice] = useState(""),
    [priceMode, setMode] = useState("SET"),
    [includeVariants, setVariants] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(null);
  const run = async () => {
    if (!confirm(`Cập nhật ${ids.length} sản phẩm đã chọn?`)) return;
    setBusy(true);
    setError("");
    try {
      const content = {
        ids,
        action,
        ...(action === "STATUS"
          ? { status }
          : action === "CATEGORY"
            ? { categoryId }
            : action === "BRAND"
              ? { brandId }
              : { price, priceMode, includeVariants }),
      };
      const fingerprint = JSON.stringify(content);
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { fingerprint, key: crypto.randomUUID() };
      await opsRequest("products/bulk", {
        method: "POST",
        body: { ...content, key: pending.current.key },
      });
      pending.current = null;
      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!ids.length) return null;
  return (
    <div className="admin-bulk-bar">
      <strong>Đã chọn {ids.length} sản phẩm</strong>
      <label>
        Thao tác
        <select value={action} disabled={busy} onChange={(e) => setAction(e.target.value)}>
          <option value="STATUS">Đổi trạng thái</option>
          <option value="CATEGORY">Đổi danh mục</option>
          <option value="BRAND">Đổi thương hiệu</option>
          <option value="PRICE">Cập nhật giá</option>
        </select>
      </label>
      {action === "STATUS" ? (
        <select
          aria-label="Trạng thái hàng loạt"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="INACTIVE">Tạm ẩn</option>
          <option value="ACTIVE">Đang bán</option>
          <option value="ARCHIVED">Lưu trữ</option>
        </select>
      ) : action === "CATEGORY" ? (
        <select
          aria-label="Danh mục hàng loạt"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Chọn danh mục</option>
          {references.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : action === "BRAND" ? (
        <select
          aria-label="Thương hiệu hàng loạt"
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
        >
          <option value="">Chọn thương hiệu</option>
          {references.brands.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <>
          <select
            aria-label="Cách cập nhật giá"
            value={priceMode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="SET">Đặt giá (₫)</option>
            <option value="INCREASE_PERCENT">Tăng (%)</option>
            <option value="DECREASE_PERCENT">Giảm (%)</option>
          </select>
          <input
            aria-label="Giá trị cập nhật"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={priceMode === "SET" ? "Giá bán mới" : "0–100%"}
          />
          <label>
            <input
              type="checkbox"
              checked={includeVariants}
              onChange={(e) => setVariants(e.target.checked)}
            />{" "}
            Áp dụng cả SKU
          </label>
        </>
      )}
      <button className="admin-primary-button" disabled={busy} onClick={() => void run()}>
        {busy ? "Đang cập nhật…" : "Áp dụng"}
      </button>
      <button disabled={busy} onClick={onClear}>
        Bỏ chọn
      </button>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
