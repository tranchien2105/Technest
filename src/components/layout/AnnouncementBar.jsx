import {
  BadgeCheck,
  CreditCard,
  Headphones,
  PackageCheck,
  PackageSearch,
  Truck,
} from "lucide-react";

export default function AnnouncementBar({ shipping, language, config }) {
  const vi = language === "vi";
  if (config?.visible === false) return null;
  const shippingMessage = config?.text || shipping;
  const messages = (
    <>
      <span>
        <Truck size={15} /> {config?.href ? <a href={config.href} style={{ color: "inherit", textDecoration: "none" }}>{shippingMessage}</a> : shippingMessage}
      </span>
      <span>
        <BadgeCheck size={15} />{" "}
        {vi ? "Sản phẩm chính hãng · Bảo hành đầy đủ" : "Authentic products · Full warranty"}
      </span>
      <span>
        <Headphones size={15} /> {vi ? "Hỗ trợ khách hàng tận tâm" : "Friendly customer support"}
      </span>
      <span>
        <CreditCard size={15} /> {vi ? "Thanh toán linh hoạt" : "Flexible payment options"}
      </span>
    </>
  );
  return (
    <div className="announcement-bar">
      <div className="announcement-inner announcement-marquee">
        <div className="announcement-left">
          <div className="announcement-track">
            {[0, 1, 2, 3].map((copy) => (
              <div className="announcement-group" key={copy} aria-hidden={copy > 0} inert={copy > 0 ? true : undefined}>
                {messages}
              </div>
            ))}
          </div>
        </div>
        <nav className="announcement-fixed" aria-label={vi ? "Liên kết nhanh" : "Quick links"}>
          <a href="/account/orders">
            <PackageCheck size={14} />
            {vi ? "Tra cứu đơn hàng" : "Track order"}
          </a>
          <span aria-hidden="true">|</span>
          <a href="/products">
            <PackageSearch size={14} />
            {vi ? "Danh mục sản phẩm" : "Browse products"}
          </a>
        </nav>
      </div>
    </div>
  );
}
