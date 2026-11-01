import { ArrowRight } from "lucide-react";
import ProductImage from "../common/ProductImage";

export default function FeatureBanner({ t, cms, cmsEditable = false, onCmsSelect }) {
  return (
    <section className={`feature-banner unified-section ${cmsEditable ? "is-cms-editable" : ""}`}>
      {cmsEditable && <button className="feature-banner-edit-action" type="button" onClick={() => onCmsSelect?.("feature-banner")}>Chỉnh sửa banner này</button>}
      <div className="feature-banner-copy">
        <span className="section-kicker">{cms?.eyebrow ?? t.promotionTag}</span>
        <h2>{cms?.title ?? t.promotionTitle}</h2>
        <p>{cms?.description ?? t.promotionDesc}</p>
        <a href={cms?.ctaUrl ?? "#products"} className="primary-button">
          {cms?.ctaLabel ?? t.exploreMore} <ArrowRight size={17} />
        </a>
      </div>
      <div className="feature-banner-image">
        <ProductImage
          src={cms?.imageUrl || "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1100&q=85"}
          alt="Organized workspace"
          loading="lazy"
        />
      </div>
    </section>
  );
}
