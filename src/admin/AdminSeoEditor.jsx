import { useEffect, useState } from "react";
import { privateRequest } from "../api/privateClient";
const defaults = { title: "", description: "", socialImage: "", canonicalPath: "", noindex: false };
export default function AdminSeoEditor({ kind, id, disabled = false }) {
  const [value, setValue] = useState(defaults),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(true),
    [ready, setReady] = useState(false);
  const path = kind === "pages" ? `/admin/settings/seo/${id}` : `/admin/${kind}/${id}/seo`;
  useEffect(() => {
    const controller = new AbortController();
    privateRequest(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setValue(result || defaults);
          setReady(true);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [path]);
  const change = (key, next) => setValue((current) => ({ ...current, [key]: next }));
  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      await privateRequest(path, { method: "PATCH", body: value });
      setMessage("Đã lưu cấu hình SEO.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="admin-editor-wide">
      <summary>SEO — tiêu đề, mô tả và chia sẻ</summary>
      <fieldset
        disabled={disabled || busy || !ready}
        className="admin-editor-fields"
        style={{ border: 0, padding: "16px 0" }}
      >
        <label>
          SEO title
          <input
            maxLength={160}
            value={value.title}
            onChange={(e) => change("title", e.target.value)}
            placeholder="Tự động dùng tên nội dung nếu bỏ trống"
          />
        </label>
        <label>
          Ảnh chia sẻ
          <input
            value={value.socialImage}
            onChange={(e) => change("socialImage", e.target.value)}
            placeholder="Đường dẫn ảnh hoặc URL HTTPS"
          />
        </label>
        <label className="admin-editor-wide">
          Meta description
          <textarea
            maxLength={500}
            rows={3}
            value={value.description}
            onChange={(e) => change("description", e.target.value)}
          />
        </label>
        <label className="admin-editor-wide">
          Canonical override
          <input
            value={value.canonicalPath}
            onChange={(e) => change("canonicalPath", e.target.value)}
            placeholder="Chỉ điền khi có nội dung trùng, ví dụ /products/ten-san-pham"
          />
          <small>
            Canonical tự động được khuyến nghị. Override sẽ đánh dấu URL hiện tại noindex.
          </small>
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.noindex}
            onChange={(e) => change("noindex", e.target.checked)}
          />{" "}
          Không index nội dung này
        </label>
        <button type="button" className="admin-primary-button" onClick={save}>
          Lưu SEO
        </button>
      </fieldset>
      {busy && <p role="status">Đang xử lý SEO…</p>}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
