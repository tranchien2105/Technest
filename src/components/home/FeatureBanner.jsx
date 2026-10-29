import { ArrowRight } from "lucide-react";
import ProductImage from "../common/ProductImage";

export default function FeatureBanner({ t }) {
  return (
    <section className="feature-banner unified-section">
      <div className="feature-banner-copy">
        <span className="section-kicker">{t.promotionTag}</span>
        <h2>{t.promotionTitle}</h2>
        <p>{t.promotionDesc}</p>
        <a href="#products" className="primary-button">
          {t.exploreMore} <ArrowRight size={17} />
        </a>
      </div>
      <div className="feature-banner-image">
        <ProductImage
          src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1100&q=85"
          alt="Organized workspace"
          loading="lazy"
        />
      </div>
    </section>
  );
}
