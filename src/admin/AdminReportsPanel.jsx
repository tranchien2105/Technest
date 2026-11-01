import { useEffect, useState } from "react";
import { opsRequest, downloadExcel } from "./operationsApi";
import { formatPrice } from "../utils/formatCurrency";
export default function AdminReportsPanel() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [query, setQuery] = useState(""),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    opsRequest(`reports?${query}`, { signal: c.signal })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [query]);
  return (
    <>
      <section className="admin-panel">
        <form
          className="admin-filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setQuery(
              new URLSearchParams({
                ...(from ? { dateFrom: from } : {}),
                ...(to ? { dateTo: to } : {}),
              }).toString(),
            );
          }}
        >
          <label className="admin-filter-field">
            Từ ngày
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="admin-filter-field">
            Đến ngày
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="admin-primary-button">Xem báo cáo</button>
          <button
            type="button"
            onClick={() => downloadExcel("orders").catch((e) => setError(e.message))}
          >
            Xuất tất cả đơn hàng
          </button>
        </form>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
      </section>
      {data && (
        <>
          <section className="admin-metrics-grid">
            {[
              ["Doanh thu COD", formatPrice(data.metrics.revenue)],
              ["Tiền hoàn ghi nhận", formatPrice(data.metrics.refunds)],
              ["Doanh thu sau hoàn", formatPrice(data.metrics.netRevenue)],
              ["Đơn đã giao", data.metrics.delivered],
              ["Tổng đơn cập nhật", data.metrics.orders],
              ["Đơn hủy", data.metrics.cancelled],
            ].map(([label, value]) => (
              <article className="admin-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          <section className="admin-panel">
            <h2>Doanh thu theo ngày</h2>
            <p>{data.policy}</p>
            <div className="admin-report-bars">
              {data.daily.map((row) => (
                <div key={row.date}>
                  <span>{row.date}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(1, (Number(row.revenue) / Math.max(1, ...data.daily.map((d) => Number(d.revenue)))) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{formatPrice(row.revenue)}</strong>
                </div>
              ))}
            </div>
            {!data.daily.length && <p>Chưa có doanh thu trong kỳ.</p>}
          </section>
          <div className="admin-overview-grid">
            <section className="admin-panel">
              <h2>20 sản phẩm bán chạy</h2>
              <div className="admin-overview-list">
                {data.topProducts.map((p, i) => (
                  <article key={p.id}>
                    <strong>
                      {i + 1}. {p.name}
                    </strong>
                    <p>
                      {p.quantity} sản phẩm · {formatPrice(p.revenue)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <section className="admin-panel">
              <h2>Hàng tồn chưa bán trong kỳ</h2>
              <p>Tối đa 50 SKU, ưu tiên tồn kho cao.</p>
              <div className="admin-overview-list">
                {data.slowStock.map((p) => (
                  <article key={p.sku}>
                    <strong>{p.name}</strong>
                    <p>
                      {p.sku} · Có thể bán: {p.available}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
