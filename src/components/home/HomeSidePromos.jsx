import { ArrowRight, Headphones, Keyboard } from "lucide-react";
import ProductImage from "../common/ProductImage";

export default function HomeSidePromos({ language }) {
  const vi = language === "vi";
  return (
    <>
      <aside
        className="home-side-promos home-side-promos-left"
        aria-label={vi ? "Ưu đãi góc làm việc" : "Workspace promotion"}
      >
        <a className="home-side-promo home-side-promo-work" href="/products?category=keyboards">
          <span className="home-side-promo-kicker">
            <Keyboard size={14} /> TECHNEST WORKSPACE
          </span>
          <ProductImage
            src="https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=600&q=85"
            alt={vi ? "Bàn phím cơ cho góc làm việc" : "Mechanical keyboard for a workspace"}
            loading="lazy"
          />
          <strong>{vi ? "Nâng cấp góc làm việc" : "Refresh your workspace"}</strong>
          <span className="home-side-promo-copy">
            {vi ? "Gõ êm hơn, tập trung hơn mỗi ngày." : "Type comfortably and focus every day."}
          </span>
          <span className="home-side-promo-link">
            {vi ? "Khám phá bàn phím" : "Explore keyboards"} <ArrowRight size={14} />
          </span>
        </a>
      </aside>
      <aside
        className="home-side-promos home-side-promos-right"
        aria-label={vi ? "Ưu đãi âm thanh" : "Audio promotion"}
      >
        <a className="home-side-promo home-side-promo-audio" href="/products?category=audio">
          <span className="home-side-promo-kicker">
            <Headphones size={14} /> TECHNEST AUDIO
          </span>
          <ProductImage
            src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=85"
            alt={vi ? "Tai nghe không dây" : "Wireless headphones"}
            loading="lazy"
          />
          <strong>{vi ? "Âm thanh theo nhịp riêng" : "Sound your way"}</strong>
          <span className="home-side-promo-copy">
            {vi ? "Tìm chiếc tai nghe hợp với bạn." : "Find headphones that fit your day."}
          </span>
          <span className="home-side-promo-link">
            {vi ? "Xem sản phẩm" : "Shop audio"} <ArrowRight size={14} />
          </span>
        </a>
      </aside>
    </>
  );
}
