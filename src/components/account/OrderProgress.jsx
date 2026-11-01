import { BadgeCheck, Ban, Check, Circle, Package, Truck } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import { multiplyMoney } from "../../domain/cart";
import { normalizeOrderStatus, orderTimeline } from "../../domain/orderTracking";
import { tx } from "../../utils/translate";
import ProductImage from "../common/ProductImage";

const stepContent = {
  PLACED: {
    title: ["Order received", "Đã ghi nhận đơn"],
    description: ["Your order has been saved.", "Technest đã ghi nhận đơn hàng."],
    Icon: Check,
  },
  CONFIRMED: {
    title: ["Store confirmation", "Cửa hàng xác nhận"],
    description: [
      "Waiting for the store to confirm your order.",
      "Đang chờ cửa hàng xác nhận đơn hàng.",
    ],
    Icon: BadgeCheck,
  },
  PROCESSING: {
    title: ["Preparing", "Đang chuẩn bị"],
    description: ["The store is preparing your items.", "Cửa hàng đang chuẩn bị sản phẩm."],
    Icon: Package,
  },
  SHIPPED: {
    title: ["On the way", "Đang vận chuyển"],
    description: [
      "Your order has been handed to the carrier.",
      "Đơn hàng đã được bàn giao cho đơn vị vận chuyển.",
    ],
    Icon: Truck,
  },
  DELIVERED: {
    title: ["Delivered", "Đã giao thành công"],
    description: ["The order has reached its destination.", "Đơn hàng đã được giao đến nơi."],
    Icon: BadgeCheck,
  },
};

export default function OrderProgress({ order, language }) {
  const lang = language === "vi";
  const status = normalizeOrderStatus(order.status);
  const timeline = orderTimeline(status);
  const statusLabel = {
    PLACED: ["Order received", "Đã ghi nhận"],
    CONFIRMED: ["Confirmed", "Đã xác nhận"],
    PROCESSING: ["Preparing", "Đang chuẩn bị"],
    SHIPPED: ["In transit", "Đang giao hàng"],
    DELIVERED: ["Delivered", "Đã giao"],
    CANCELLED: ["Cancelled", "Đã hủy"],
  }[status];

  return (
    <div className="account-order-detail">
      <section className={`order-progress-card ${status === "CANCELLED" ? "is-cancelled" : ""}`}>
        <div className="order-progress-heading">
          <div>
            <span className="section-kicker">{tx("ORDER PROGRESS", "TIẾN ĐỘ ĐƠN HÀNG", lang)}</span>
            <h3>{tx("Track your order", "Theo dõi đơn hàng", lang)}</h3>
          </div>
          <span className="status-pill">{tx(statusLabel[0], statusLabel[1], lang)}</span>
        </div>

        {status === "CANCELLED" ? (
          <div className="order-cancelled-state">
            <span>
              <Ban size={20} />
            </span>
            <div>
              <strong>{tx("This order was cancelled", "Đơn hàng đã bị hủy", lang)}</strong>
              <p>
                {tx(
                  "Contact Technest support if you need help with this order.",
                  "Liên hệ hỗ trợ Technest nếu bạn cần trợ giúp về đơn hàng này.",
                  lang,
                )}
              </p>
            </div>
          </div>
        ) : (
          <ol className="order-timeline">
            {timeline.map(({ step, state }) => {
              const content = stepContent[step];
              const Icon = state === "complete" ? Check : content.Icon;
              return (
                <li className={`order-timeline-step is-${state}`} key={step}>
                  <span className="order-timeline-marker">
                    <Icon size={17} />
                  </span>
                  <div>
                    <strong>{tx(content.title[0], content.title[1], lang)}</strong>
                    <p>
                      {state === "complete" && step === "CONFIRMED"
                        ? tx(
                            "The store confirmed this order.",
                            "Cửa hàng đã xác nhận đơn hàng.",
                            lang,
                          )
                        : tx(content.description[0], content.description[1], lang)}
                    </p>
                    {step === "PLACED" && (
                      <time dateTime={order.createdAt}>
                        {new Date(order.createdAt).toLocaleString(lang ? "vi-VN" : "en-US")}
                      </time>
                    )}
                  </div>
                  {state === "upcoming" && <Circle className="order-upcoming-icon" size={15} />}
                </li>
              );
            })}
          </ol>
        )}
        <p className="order-local-status-note">
          {tx(
            "Order status is updated by Technest.",
            "Trạng thái đơn hàng được cập nhật từ Technest.",
            lang,
          )}
        </p>
      </section>

      <div className="order-detail-columns">
        <section className="order-detail-card">
          <div className="order-detail-card-heading">
            <Package size={17} />
            <h3>{tx("Items in this order", "Sản phẩm trong đơn", lang)}</h3>
          </div>
          <div className="order-detail-items">
            {order.items.map((item) => (
              <article className="order-detail-item" key={item.id}>
                <ProductImage src={item.image} alt={item.name} />
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {tx("Quantity", "Số lượng", lang)}: {item.quantity}
                  </span>
                </div>
                <strong>{formatPrice(multiplyMoney(item.price, item.quantity))}</strong>
              </article>
            ))}
          </div>
          <div className="order-detail-totals">
            <p>
              <span>{tx("Subtotal", "Tạm tính", lang)}</span>
              <strong>{formatPrice(order.subtotal)}</strong>
            </p>
            <p>
              <span>{tx("Shipping", "Vận chuyển", lang)}</span>
              <strong>
                {order.shipping ? formatPrice(order.shipping) : tx("Free", "Miễn phí", lang)}
              </strong>
            </p>
            <p className="order-detail-total">
              <span>{tx("Total", "Tổng cộng", lang)}</span>
              <strong>{formatPrice(order.total)}</strong>
            </p>
          </div>
        </section>

        <section className="order-detail-card order-delivery-card">
          <div className="order-detail-card-heading">
            <Truck size={17} />
            <h3>{tx("Delivery information", "Thông tin giao hàng", lang)}</h3>
          </div>
          <strong>
            {order.customer?.name || tx("Recipient not provided", "Chưa có người nhận", lang)}
          </strong>
          <p>{order.customer?.address || tx("No address saved", "Chưa có địa chỉ", lang)}</p>
          <p>{order.customer?.city || ""}</p>
          {order.customer?.phone && <p>{order.customer.phone}</p>}
        </section>
      </div>
    </div>
  );
}
