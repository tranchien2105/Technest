import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import ProductCard from "./ProductCard";
import HomeProductRail from "./HomeProductRail";
import ProductImage from "../common/ProductImage";
import { useBanners } from "../../hooks/useBanners";

const categories = [
  { id: "keyboards", vi: "Bàn phím", en: "Keyboards" },
  { id: "mice", vi: "Chuột", en: "Mice" },
  { id: "monitors", vi: "Màn hình", en: "Monitors" },
  { id: "accessories", vi: "Phụ kiện", en: "Accessories" },
  { id: "audio", vi: "Tai nghe", en: "Headphones" },
];

export default function HomeCampaignBanners({
  products = [],
  language,
  t,
  favorites,
  toggleFavorite,
  addToCart,
  compareIds,
  toggleCompare,
  onViewProduct,
  bannerPreview,
  onSelectPlacement,
  selectedPlacement,
  previewStatuses = {},
  cms,
}) {
  const [activeCategory, setActiveCategory] = useState("keyboards");
  const [activeBrand, setActiveBrand] = useState("all");
  const selectedCategory = categories.some((category) => category.id === activeCategory)
    ? activeCategory
    : categories[0]?.id || "keyboards";
  const categoryProducts = products.filter((product) => product.category === selectedCategory);
  const brands = [...new Set(categoryProducts.map((product) => product.brand).filter(Boolean))];
  const visibleProducts = categoryProducts.filter(
    (product) => activeBrand === "all" || product.brand === activeBrand,
  );
  const posterResult = useBanners("HOME_SETUP_STUDIO", { enabled: !bannerPreview });
  const posters = bannerPreview?.HOME_SETUP_STUDIO || posterResult.items;
  const [activePoster, setActivePoster] = useState(0);
  const posterIndex = posters.length ? activePoster % posters.length : 0;
  const poster = posters[posterIndex];

  useEffect(() => {
    if (posters.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => setActivePoster((index) => (index + 1) % posters.length), 6000);
    return () => window.clearInterval(timer);
  }, [posters.length]);

  const chooseCategory = (category) => {
    setActiveCategory(category);
    setActiveBrand("all");
  };

  return (
    <section className="home-campaigns unified-section" aria-label="Technest product campaigns">
      {poster ? (
        <a
          className={`home-campaign-poster ${onSelectPlacement ? "banner-edit-target" : ""} ${selectedPlacement === "HOME_SETUP_STUDIO" ? "is-banner-selected" : ""}`}
          href={onSelectPlacement ? undefined : poster.link}
          data-banner-placement="HOME_SETUP_STUDIO"
          onClick={onSelectPlacement ? (event) => { event.preventDefault(); onSelectPlacement("HOME_SETUP_STUDIO"); } : undefined}
        >
          {onSelectPlacement && <button className="banner-edit-hitarea" type="button" onClick={() => onSelectPlacement("HOME_SETUP_STUDIO")} aria-label="Chỉnh sửa banner Setup Studio" />}
          <ProductImage key={poster.id} src={poster.imageUrl} alt={poster.title} loading="lazy" />
          <span className="home-campaign-poster-shade" />
          {previewStatuses.HOME_SETUP_STUDIO?.[posterIndex] && <span className="banner-preview-state">{previewStatuses.HOME_SETUP_STUDIO[posterIndex]}</span>}
          <span className="home-campaign-poster-copy">
            <small><Sparkles size={14} /> TECHNEST SETUP STUDIO</small>
            <strong>{poster.title}</strong>
            {poster.subtitle && <span>{poster.subtitle}</span>}
            <em>{poster.buttonText || (language === "vi" ? "Khám phá ngay" : "Explore now")} <ArrowRight size={16} /></em>
          </span>
          {posters.length > 1 && <span className="home-campaign-poster-count">{posterIndex + 1}/{posters.length}</span>}
        </a>
      ) : onSelectPlacement ? (
        <button className={`home-campaign-poster home-campaign-poster-empty banner-edit-target ${selectedPlacement === "HOME_SETUP_STUDIO" ? "is-banner-selected" : ""}`} type="button" data-banner-placement="HOME_SETUP_STUDIO" onClick={() => onSelectPlacement("HOME_SETUP_STUDIO")}>
          <span>+ Chọn banner Setup Studio</span>
        </button>
      ) : posterResult.loading ? (
        <div className="home-campaign-poster home-campaign-poster-empty" aria-busy="true">Đang tải banner…</div>
      ) : null}

      <div className="home-campaign-shop">
        <div className="home-campaign-tabs" role="tablist" aria-label="Danh mục sản phẩm">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === category.id}
              className={selectedCategory === category.id ? "is-active" : ""}
              onClick={() => chooseCategory(category.id)}
            >
              {category[language]}
            </button>
          ))}
        </div>

        <div className="home-campaign-brands" aria-label={language === "vi" ? "Lọc theo thương hiệu" : "Filter by brand"}>
          <button
            type="button"
            className={activeBrand === "all" ? "is-active" : ""}
            onClick={() => setActiveBrand("all")}
          >
            {language === "vi" ? "Tất cả" : "All brands"}
          </button>
          {brands.slice(0, 8).map((brand) => (
            <button
              key={brand}
              type="button"
              className={activeBrand === brand ? "is-active" : ""}
              onClick={() => setActiveBrand(brand)}
            >
              {brand}
            </button>
          ))}
          <a href={`/products?category=${selectedCategory}`}>
            {language === "vi" ? "Xem tất cả" : "View all"} <ArrowRight size={14} />
          </a>
        </div>

        {visibleProducts.length > 0 ? (
          <HomeProductRail
            className="home-campaign-products"
            language={language}
            label={language === "vi" ? "Sản phẩm theo danh mục" : "Category products"}
          >
            {visibleProducts.slice(0, cms?.limit || 10).map((product) => (
              <ProductCard
                key={`campaign-${product.id}`}
                product={product}
                language={language}
                t={t}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                addToCart={addToCart}
                compareIds={compareIds}
                toggleCompare={toggleCompare}
                onViewProduct={onViewProduct}
              />
            ))}
          </HomeProductRail>
        ) : (
          <div className="home-campaign-empty" role="status">
            {language === "vi"
              ? "Sản phẩm trong danh mục này sẽ sớm được cập nhật."
              : "Products in this category will be available soon."}
          </div>
        )}
      </div>
    </section>
  );
}
