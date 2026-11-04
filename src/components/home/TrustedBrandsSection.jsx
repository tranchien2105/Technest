import { useEffect, useState } from "react";
import { apiGet } from "../../api/apiClient";
import { selectHomepageBrands } from "../../domain/homepageSelection";
import { ArrowRight, ArrowUpRight } from "lucide-react";



export default function TrustedBrandsSection({ t, language, cms, brands = [] }) {
  const vi = language === "vi";
  const ids = (cms?.brandSlugs || []).join(",");
  const [manual, setManual] = useState({ key: "", items: [] });
  useEffect(() => {
    if (!ids) return undefined;
    const controller = new AbortController();
    apiGet(`/brands?ids=${encodeURIComponent(ids)}&limit=24`, { signal: controller.signal }).then((items) => setManual({ key: ids, items })).catch(() => {});
    return () => controller.abort();
  }, [ids]);
  const source = ids ? (manual.key === ids ? manual.items : []) : brands;
  const visible = selectHomepageBrands(source, cms);
  if (!visible.length) return null;

  return (
    <section className="trusted-brands unified-section" aria-labelledby="trusted-brands-title">
      <div className="trusted-brands-heading">
        <div>
          <span className="section-kicker">{cms?.eyebrow ?? (vi ? "THƯƠNG HIỆU CÔNG NGHỆ" : "TECH BRANDS")}</span>
          <h2 id="trusted-brands-title">{cms?.title ?? t.trustedBrands}</h2>
          <p>
            {cms?.description ?? (vi
              ? "Khám phá thương hiệu đang có sản phẩm tại Technest."
              : "Explore brands available at Technest.")}
          </p>
        </div>
        <a className="trusted-brands-view-all" href={cms?.ctaUrl ?? "/products"}>
          {cms?.ctaLabel ?? t.viewAll} <ArrowRight size={16} />
        </a>
      </div>
      <div className="trusted-brand-list">
        {visible.map((brand) => (
          <a
            className={`trusted-brand trusted-brand-${brand.id}`}
            href={`/brands/${encodeURIComponent(brand.id)}`}
            key={brand.id}
          >
            <span>{brand.name}</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
