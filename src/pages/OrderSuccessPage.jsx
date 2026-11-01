import { useEffect, useState } from "react";
import { ordersApi } from "../api/ordersClient";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { formatPrice } from "../utils/formatCurrency";
import { multiplyMoney } from "../domain/cart";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";

export default function OrderSuccessPage({ route, navigate, language }) {
  const { pathname: path } = new URL(route, "http://technest.local");
  const lang = language === "vi";

  const [order, setOrder] = useState(null);
  const id = path.split("/").pop();
  useEffect(() => { let active = true; ordersApi.detail(id).then((value) => { if (active) setOrder(value); }).catch(() => {}); return () => { active = false; }; }, [id]);
  return (
    <section className="store-page narrow-page success-page">
      <CheckCircle2 size={52} />
      <PageTitle
        title={
          order
            ? tx("Order received", "Đã ghi nhận đơn hàng", lang)
            : tx("Order details unavailable", "Không tìm thấy thông tin đơn hàng", lang)
        }
        desc={
          order
            ? `${tx("Order", "Đơn hàng", lang)} ${order.orderNumber || `TN-${String(order.id).padStart(8, "0")}`} ${tx("has been placed successfully.", "đã được ghi nhận.", lang)}`
            : tx(
                "We couldn't load this order from your account.",
                "Chưa tải được đơn hàng từ tài khoản hiện tại.",
                lang,
              )
        }
      />
      {order && (
        <div className="order-summary">
          {order.items.map((x) => (
            <p key={x.id}>
              <span>
                {x.name} × {x.quantity}
              </span>
              <strong>{formatPrice(multiplyMoney(x.price, x.quantity))}</strong>
            </p>
          ))}
          <p>
            <span>{tx("Shipping to", "Giao đến", lang)}</span>
            <strong>
              {order.customer.name}, {order.customer.address}, {order.customer.city}
            </strong>
          </p>
          <p className="summary-total">
            <span>{tx("Total", "Tổng cộng", lang)}</span>
            <strong>{formatPrice(order.total)}</strong>
          </p>
        </div>
      )}
      {order && (
        <button
          className="outline-button order-success-track"
          type="button"
          onClick={() => navigate(`/account/orders/${encodeURIComponent(order.id)}`)}
        >
          {tx("Track this order", "Theo dõi đơn hàng", lang)} <ArrowRight size={16} />
        </button>
      )}
      <button className="primary-button" onClick={() => navigate("/products")}>
        {tx("Continue shopping", "Tiếp tục mua sắm", lang)} <ArrowRight size={16} />
      </button>
    </section>
  );
}
