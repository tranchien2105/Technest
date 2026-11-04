import { ArrowRight, ShoppingBag } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import { tx } from "../../utils/translate";
import { compareMoney, moneyRatio, subtractMoney } from "../../domain/cart";
export function PageTitle({ eyebrow = "TECHNEST", title, desc, headingLevel = 1 }) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return (
    <div className="store-title">
      <span className="section-kicker">{eyebrow}</span>
      <Heading>{title}</Heading>
      {desc && <p>{desc}</p>}
    </div>
  );
}
export function ShippingProgress({ subtotal, language }) {
  const vi = language === "vi";
  const threshold = 1000000;
  const remaining = compareMoney(subtotal, threshold) >= 0 ? 0 : subtractMoney(threshold, subtotal);
  const progress = Math.min(100, moneyRatio(subtotal, threshold));
  return (
    <div className="shipping-progress">
      <p>
        {remaining
          ? vi
            ? `Mua thêm ${formatPrice(remaining)} để được miễn phí vận chuyển`
            : `Add ${formatPrice(remaining)} for free shipping`
          : vi
            ? "Đơn hàng đã được miễn phí vận chuyển!"
            : "Your order qualifies for free shipping!"}
      </p>
      <div className="shipping-progress-track" aria-label={`${Math.round(progress)}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
export function Empty({ title, text, go, lang }) {
  return (
    <div className="store-empty">
      <ShoppingBag size={34} />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary-button" onClick={() => go("/products")}>
        {tx("Continue shopping", "Tiếp tục mua sắm", lang)} <ArrowRight size={16} />
      </button>
    </div>
  );
}
