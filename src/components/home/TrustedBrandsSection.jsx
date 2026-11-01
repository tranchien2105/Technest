import { ArrowRight, ArrowUpRight } from "lucide-react";

const brands = ["KEYCHRON", "LOGITECH", "SONY", "TECHNEST SELECT", "JBL", "RAZER"];

export default function TrustedBrandsSection({ t, language, cms }) {
  const vi = language === "vi";

  return (
    <section className="trusted-brands unified-section" aria-labelledby="trusted-brands-title">
      <div className="trusted-brands-heading">
        <div>
          <span className="section-kicker">{cms?.eyebrow ?? (vi ? "THƯƠNG HIỆU CÔNG NGHỆ" : "TECH BRANDS")}</span>
          <h2 id="trusted-brands-title">{cms?.title ?? t.trustedBrands}</h2>
          <p>
            {cms?.description ?? (vi
              ? "Khám phá những cái tên được yêu thích tại Technest."
              : "Explore customer-favorite names at Technest.")}
          </p>
        </div>
        <a className="trusted-brands-view-all" href={cms?.ctaUrl ?? "/products"}>
          {cms?.ctaLabel ?? t.viewAll} <ArrowRight size={16} />
        </a>
      </div>
      <div className="trusted-brand-list">
        {brands.map((brand) => (
          <a
            className={`trusted-brand trusted-brand-${brand.toLowerCase().replaceAll(" ", "-")}`}
            href={`/products?brand=${encodeURIComponent(brand)}`}
            key={brand}
          >
            <span>{brand}</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
