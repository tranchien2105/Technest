import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import ProductImage from "../common/ProductImage";
import { useBanners } from "../../hooks/useBanners";

export default function HeroSection({ language, t, bannerPreview, onSelectPlacement, selectedPlacement, previewStatuses = {} }) {
  const mainResult = useBanners("HOME_HERO", { enabled: !bannerPreview });
  const topResult = useBanners("HOME_HERO_RIGHT_TOP", { enabled: !bannerPreview });
  const bottomResult = useBanners("HOME_HERO_RIGHT_BOTTOM", { enabled: !bannerPreview });
  const heroBanners = bannerPreview?.HOME_HERO || mainResult.items;
  const topBanners = bannerPreview?.HOME_HERO_RIGHT_TOP || topResult.items;
  const bottomBanners = bannerPreview?.HOME_HERO_RIGHT_BOTTOM || bottomResult.items;
  const [activeSide, setActiveSide] = useState({ top: 0, bottom: 0 });
  const rightTop = topBanners.length ? topBanners[activeSide.top % topBanners.length] : null;
  const rightBottom = bottomBanners.length ? bottomBanners[activeSide.bottom % bottomBanners.length] : null;
  const loading = bannerPreview ? false : mainResult.loading;
  const error = bannerPreview ? "" : mainResult.error;
  const [activeSlide, setActiveSlide] = useState(0);
  const slideIndex = heroBanners.length ? activeSlide % heroBanners.length : 0;
  const slide = heroBanners[slideIndex];

  useEffect(() => {
    if (heroBanners.length < 2) return undefined;
    const timer = setInterval(() => {
      setActiveSlide((index) => (index + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroBanners.length]);

  useEffect(() => {
    if ((topBanners.length < 2 && bottomBanners.length < 2) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => {
      setActiveSide((current) => ({
        top: topBanners.length > 1 ? (current.top + 1) % topBanners.length : current.top,
        bottom: bottomBanners.length > 1 ? (current.bottom + 1) % bottomBanners.length : current.bottom,
      }));
    }, 6000);
    return () => clearInterval(timer);
  }, [topBanners.length, bottomBanners.length]);

  if (loading) {
    return <div className="hero-layout" aria-busy="true" aria-label="Đang tải banner"><div className="hero-main hero-loading" /></div>;
  }

  if (!slide && bannerPreview) {
    return <section className="hero-layout" id="home">
      <div className={`hero-main banner-edit-target ${selectedPlacement === "HOME_HERO" ? "is-banner-selected" : ""}`} data-banner-placement="HOME_HERO"><button className="banner-edit-hitarea" type="button" onClick={() => onSelectPlacement?.("HOME_HERO")} aria-label="Chỉnh sửa Hero Main Slider"/><div className="hero-promo-empty">Chưa gán banner cho Hero Slider</div></div>
      <div className="hero-side">{["HOME_HERO_RIGHT_TOP", "HOME_HERO_RIGHT_BOTTOM"].map((key) => <article key={key} className={`hero-promo-card banner-edit-target ${selectedPlacement === key ? "is-banner-selected" : ""}`} data-banner-placement={key}><button className="banner-edit-hitarea" type="button" onClick={() => onSelectPlacement?.(key)} aria-label={`Chỉnh sửa ${key}`}/><div className="hero-promo-empty">Chưa gán banner</div></article>)}</div>
    </section>;
  }

  if (!slide) {
    return (
      <p className="catalog-feedback" role="status">
        {error
          ? language === "vi"
            ? "Không thể tải banner trang chủ. Vui lòng thử tải lại trang."
            : "Homepage banners could not be loaded. Please refresh the page."
          : language === "vi"
            ? "Chưa có banner trang chủ đang hoạt động."
            : "There are no active homepage banners."}
      </p>
    );
  }

  return (
    <section className="hero-layout" id="home">
      <div className={`hero-main ${onSelectPlacement ? "banner-edit-target" : ""} ${selectedPlacement === "HOME_HERO" ? "is-banner-selected" : ""}`} data-banner-placement="HOME_HERO">
        {onSelectPlacement && <button className="banner-edit-hitarea" type="button" onClick={() => onSelectPlacement("HOME_HERO")} aria-label="Chỉnh sửa Hero Main Slider" />}
        <ProductImage
          key={slide.id}
          className="hero-main-image"
          src={slide.imageUrl}
          alt={slide.title}
        />
        {previewStatuses.HOME_HERO?.[slideIndex] && <span className="banner-preview-state">{previewStatuses.HOME_HERO[slideIndex]}</span>}
        <div className="hero-image-wash" />
        <div className="hero-copy">
          <span className="eyebrow-pill">TECHNEST</span>
          <h1 key={`title-${slide.id}`}>{slide.title}</h1>
          {slide.subtitle && <p key={`desc-${slide.id}`}>{slide.subtitle}</p>}
          <a href={onSelectPlacement ? undefined : slide.link} onClick={onSelectPlacement ? (event) => { event.preventDefault(); onSelectPlacement("HOME_HERO"); } : undefined} className="primary-button">
            {slide.buttonText || (language === "vi" ? "Khám phá ngay" : "Explore now")} <ArrowRight size={18} />
          </a>
        </div>
        {heroBanners.length > 1 && <div className="hero-pagination" aria-label="Banner slides">
          {heroBanners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              className={index === slideIndex ? "active" : ""}
              aria-label={`${language === "vi" ? "Chuyển đến banner" : "Go to banner"} ${index + 1}`}
              aria-pressed={index === slideIndex}
              onClick={() => setActiveSlide(index)}
            />
          ))}
        </div>}
      </div>
      <div className="hero-side">
        {[{ key: "HOME_HERO_RIGHT_TOP", banner: rightTop, className: "keyboard-promo" }, { key: "HOME_HERO_RIGHT_BOTTOM", banner: rightBottom, className: "audio-promo" }].map(({ key, banner, className }) => (
          <article key={key} className={`hero-promo-card ${className} ${onSelectPlacement ? "banner-edit-target" : ""} ${selectedPlacement === key ? "is-banner-selected" : ""}`} data-banner-placement={key}>
            {onSelectPlacement && <button className="banner-edit-hitarea" type="button" onClick={() => onSelectPlacement(key)} aria-label={`Chỉnh sửa ${key}`} />}
            {banner ? <>
              <div>
                <span className="promo-kicker">{language === "vi" ? "ƯU ĐÃI TECHNEST" : "TECHNEST PICKS"}</span>
                <h2>{banner.title}</h2>
                {banner.subtitle && <p>{banner.subtitle}</p>}
                <a href={onSelectPlacement ? undefined : banner.link} onClick={onSelectPlacement ? (event) => { event.preventDefault(); onSelectPlacement(key); } : undefined}>{banner.buttonText || t.shopNow} <ArrowRight size={15} /></a>
              </div>
              <ProductImage src={banner.imageUrl} alt={banner.title} />
        {previewStatuses[key]?.[(key.endsWith("TOP") ? activeSide.top : activeSide.bottom) % Math.max(previewStatuses[key]?.length || 1, 1)] && <span className="banner-preview-state">{previewStatuses[key][(key.endsWith("TOP") ? activeSide.top : activeSide.bottom) % Math.max(previewStatuses[key]?.length || 1, 1)]}</span>}
            </> : <div className="hero-promo-empty">Chưa có banner ở vị trí này</div>}
          </article>
        ))}
      </div>
      {error && <p className="catalog-feedback" role="status">Không thể tải banner trang chủ. Vui lòng thử tải lại trang.</p>}
    </section>
  );
}
