import { useEffect, useState } from "react";
import { privateRequest } from "../../api/privateClient";
const labels = {
  REQUESTED: "Chờ tiếp nhận",
  APPROVED: "Đã duyệt",
  RECEIVED: "Đã nhận hàng",
  RESOLVED: "Đã xử lý",
  REJECTED: "Từ chối",
};
export default function AfterSalesRequests({ order }) {
  const [items, setItems] = useState([]),
    [draft, setDraft] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    privateRequest(`/account/after-sales?limit=500&q=${encodeURIComponent(order.orderNumber || "")}`)
      .then((d) => {
        if (active) setItems(d.items.filter((i) => String(i.orderId) === String(order.id)));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [order.id, order.orderNumber, version]);
  if (order.status !== "DELIVERED") return null;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await privateRequest("/account/after-sales", {
        method: "POST",
        body: { ...draft, orderId: order.id },
      });
      setDraft(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="order-detail-card after-sales-customer">
      <h3>Đổi trả & bảo hành</h3>
      <p>Cần hỗ trợ với sản phẩm đã nhận? Gửi yêu cầu để Technest kiểm tra.</p>
      {error && <p role="alert">{error}</p>}
      {!draft ? (
        <button
          className="secondary-button"
          onClick={() =>
            setDraft({ itemId: order.items[0].id, type: "WARRANTY", quantity: 1, reason: "" })
          }
        >
          Gửi yêu cầu hỗ trợ
        </button>
      ) : (
        <form onSubmit={submit}>
          <label>
            Sản phẩm
            <select
              value={draft.itemId}
              onChange={(e) => setDraft({ ...draft, itemId: e.target.value, quantity: 1 })}
            >
              {order.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {i.sku}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loại yêu cầu
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            >
              <option value="WARRANTY">Bảo hành</option>
              <option value="RETURN">Đổi trả</option>
            </select>
          </label>
          <label>
            Số lượng
            <input
              type="number"
              min={1}
              max={order.items.find((i) => i.id === draft.itemId)?.quantity || 1}
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })}
              required
            />
          </label>
          <label>
            Mô tả tình trạng
            <textarea
              required
              minLength={10}
              maxLength={2000}
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
          </label>
          <div>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Hủy
            </button>
            <button className="primary-button" disabled={busy}>
              {busy ? "Đang gửi…" : "Gửi yêu cầu"}
            </button>
          </div>
        </form>
      )}
      <div>
        {items.map((i) => (
          <article key={i.id}>
            <strong>
              {i.productName} · {i.type === "RETURN" ? "Đổi trả" : "Bảo hành"}
            </strong>
            <p>
              {labels[i.status]} · Số lượng {i.quantity}
            </p>
            <small>{i.reason}</small>
            {i.adminNote && <p>Phản hồi: {i.adminNote}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
