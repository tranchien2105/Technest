import { useEffect, useRef, useState } from "react";
import { opsRequest, downloadExcel, canAdmin } from "./operationsApi";
export default function AdminImportPanel({ user }) {
  const [jobs, setJobs] = useState([]),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(null);
  const active = useRef(true);
  const load = () =>
    opsRequest("imports")
      .then(setJobs)
      .catch((e) => setError(e.message));
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, []);
  const inspect = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const body = new FormData();
      body.append("file", file);
      setPreview(await opsRequest("imports/preview", { method: "POST", body }));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const run = async (job) => {
    if (
      !window.confirm(
        "Xác nhận nhập/cập nhật sản phẩm và tồn kho theo tệp? Các sản phẩm khác được giữ nguyên.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      let result = job;
      while (active.current && result.cursor < result.total) {
        result = await opsRequest(`imports/${job.id}/run`, { method: "POST" });
        if (active.current) setProgress(result);
      }
      if (active.current) {
        await load();
        setPreview(null);
      }
    } catch (e) {
      if (active.current) {
        setError(e.message);
        await load();
      }
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <section className="admin-panel admin-import-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Nhập & xuất Excel</h2>
          <p>
            Tải mẫu → điền dữ liệu → xem trước → xác nhận. Mỗi tệp tối đa 2.000 dòng, xử lý theo lô.
          </p>
        </div>
      </div>
      <div className="admin-row-actions">
        {["template", "products", "inventory", "orders"].filter(kind => !user || canAdmin(user,"reports") || canAdmin(user, kind === "template" ? "products" : kind)).map((kind) => (
          <button
            key={kind}
            disabled={busy}
            onClick={() => downloadExcel(kind).catch((e) => setError(e.message))}
          >
            {{template:"Tải tệp mẫu",products:"Xuất sản phẩm",inventory:"Xuất tồn kho",orders:"Xuất đơn hàng"}[kind]}
          </button>
        ))}
      </div>
      <label className="admin-upload-zone">
        <strong>Chọn tệp sản phẩm .xlsx để kiểm tra</strong>
        <input
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={(e) => {
            void inspect(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {preview && (
        <div className="admin-import-preview">
          <h3>{preview.total} dòng được kiểm tra</h3>
          {preview.errors.length ? (
            <>
              <p>Sửa các lỗi sau trong tệp rồi tải lại. Chưa có sản phẩm nào bị thay đổi.</p>
              <ul>
                {preview.errors.slice(0, 100).map((e) => (
                  <li key={e.row}>
                    Dòng {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>{preview.job.total} sản phẩm hợp lệ</p>
              <ul>
                {preview.sample.map((r, i) => (
                  <li key={i}>
                    {r.name} · {r.variants} SKU
                  </li>
                ))}
              </ul>
              <button
                className="admin-primary-button"
                disabled={busy}
                onClick={() => void run(preview.job)}
              >
                Xác nhận nhập
              </button>
            </>
          )}
        </div>
      )}
      {progress && (
        <p role="status">
          Đã xử lý {progress.cursor}/{progress.total} sản phẩm ·{" "}
          {progress.status === "COMPLETED" ? "Hoàn tất" : "Đang nhập"}
        </p>
      )}
      <h3>Lịch sử nhập của bạn</h3>
      <div className="admin-overview-list">
        {jobs.map((j) => (
          <article key={j.id}>
            <strong>{j.filename}</strong>
            <span>
              {j.cursor}/{j.total} · {j.status}
            </span>
            {j.error && <p className="admin-error">{j.error}</p>}
            {j.cursor < j.total && (
              <button disabled={busy} onClick={() => void run(j)}>
                Tiếp tục nhập
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
