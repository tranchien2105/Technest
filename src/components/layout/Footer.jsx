import { ArrowRight } from "lucide-react";

export default function Footer({ t, language, notify }) {
  return (
    <footer className="site-footer" id="footer">
      <div className="footer-main">
        <div className="footer-brand-column">
          <a className="brand" href="/#home">
            <span className="brand-mark" aria-hidden="true">
              <span>T</span>
              <i>N</i>
            </span>
            <span className="brand-name">
              Technest<span className="brand-dot">.</span>
            </span>
            <span className="brand-tagline">Better Tools. Brighter Days.</span>
          </a>
          <p>{t.footerDesc}</p>
          <p className="footer-product-range">
            {language === "vi"
              ? "Bàn phím · Chuột · Màn hình · Âm thanh · Phụ kiện"
              : "Keyboards · Mice · Monitors · Audio · Accessories"}
          </p>
          <div className="footer-socials">
            <a href="/#products" aria-label="ig — Instagram">
              ig
            </a>
            <a href="/#products" aria-label="f — Facebook">
              f
            </a>
            <a href="/#products" aria-label="Youtube">
              ▶
            </a>
          </div>
        </div>
        <div className="footer-column">
          <h3>{t.customerCare}</h3>
          <a href="#footer">{t.contact}</a>
          <a href="#footer">{t.guide}</a>
          <a href="#footer">{t.shippingPolicy}</a>
          <a href="#footer">{t.returns}</a>
          <a href="/account/orders">{language === "vi" ? "Tra cứu đơn hàng" : "Track an order"}</a>
        </div>
        <div className="footer-column">
          <h3>{t.about}</h3>
          <a href="/#products">{t.featured}</a>
          <a href="/#home">{t.home}</a>
          <a href="/products?sort=newest">{language === "vi" ? "Sản phẩm mới" : "New arrivals"}</a>
          <a href="/categories/keyboards">{language === "vi" ? "Bàn phím" : "Keyboards"}</a>
          <a href="/categories/mice">{language === "vi" ? "Chuột" : "Mice"}</a>
          <a href="/categories/monitors">{language === "vi" ? "Màn hình" : "Monitors"}</a>
        </div>
        <div className="footer-newsletter">
          <h3>{t.newsletter}</h3>
          <p>{t.newsletterDesc}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              notify(language === "vi" ? "Cảm ơn bạn đã đăng ký!" : "Thanks for subscribing!");
              event.currentTarget.reset();
            }}
          >
            <input type="email" placeholder={t.email} required aria-label={t.email} />
            <button type="submit" aria-label={t.subscribe}>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 TECHNEST</span>
        <span>{t.copyright}</span>
        <a className="footer-back-top" href="/#home">
          {language === "vi" ? "LÊN ĐẦU TRANG" : "BACK TO TOP"} <span aria-hidden="true">↑</span>
        </a>
      </div>
    </footer>
  );
}
