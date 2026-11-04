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
    <section className="store-page success-page">
      <div className="success-content">
        <div className="success-mark"><CheckCircle2 size={34} strokeWidth={2.3} /></div>
        <span className="success-eyebrow">TECHNEST · {tx("ORDER CONFIRMATION", "XÁC NHẬN ĐƠN HÀNG", lang)}</span>
        <PageTitle
          title={
            order
              ? tx("Order received", "Đặt hàng thành công", lang)
              : tx("Order details unavailable", "Không tìm thấy thông tin đơn hàng", lang)
          }
          desc={
            order
              ? tx("Your order has been recorded. We’ll keep you updated on its progress.", "Đơn hàng đã được ghi nhận. TechNest sẽ cập nhật tình trạng đơn cho bạn.", lang)
              : tx(
                  "We couldn't load this order from your account.",
                  "Chưa tải được đơn hàng từ tài khoản hiện tại.",
                  lang,
                )
          }
        />
      {order && (
        <div className="order-summary success-order-summary">
          <div className="success-order-heading">
            <div>
              <span>{tx("ORDER NUMBER", "MÃ ĐƠN HÀNG", lang)}</span>
              <strong>{order.orderNumber || `TN-${String(order.id).padStart(8, "0")}`}</strong>
            </div>
            <span className="success-order-status"><i />{tx("Order placed", "Đã tiếp nhận", lang)}</span>
          </div>
          <div className="success-order-items">
            {order.items.map((x) => (
              <div className="success-order-item" key={x.id}>
                <span className="success-item-quantity">{x.quantity}×</span>
                <span className="success-item-name">{x.name}</span>
                <strong>{formatPrice(multiplyMoney(x.price, x.quantity))}</strong>
              </div>
            ))}
          </div>
          <div className="success-shipping">
            <span>{tx("DELIVERY ADDRESS", "ĐỊA CHỈ NHẬN HÀNG", lang)}</span>
            <strong>{order.customer.name}</strong>
            <p>{order.customer.address}, {order.customer.city}</p>
          </div>
          <div className="success-total">
            <span>{tx("Total paid on delivery", "Tổng thanh toán khi nhận hàng", lang)}</span>
            <strong>{formatPrice(order.total)}</strong>
          </div>
        </div>
      )}
        <div className="success-actions">
          {order && (
            <button
              className="outline-button order-success-track"
              type="button"
              onClick={() => navigate(`/account/orders/${encodeURIComponent(order.id)}`)}
            >
              {tx("Track this order", "Theo dõi đơn hàng", lang)} <ArrowRight size={17} />
            </button>
          )}
          <button className="primary-button" onClick={() => navigate("/products")}>
            {tx("Continue shopping", "Tiếp tục mua sắm", lang)} <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
