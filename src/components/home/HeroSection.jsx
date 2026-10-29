import { ArrowRight } from "lucide-react";
import ProductImage from "../common/ProductImage";

export default function HeroSection({
  heroSlides,
  activeSlide,
  setActiveSlide,
  language,
  t,
  selectCategory,
}) {
  const slide = heroSlides[activeSlide];
  return (
    <section className="hero-layout" id="home">
      <div className="hero-main">
        <ProductImage
          key={slide.image}
          className="hero-main-image"
          src={slide.image}
          alt={slide.alt[language]}
        />
        <div className="hero-image-wash" />
        <div className="hero-copy">
          <span className="eyebrow-pill">{slide.tag[language]}</span>
          <h1 key={`title-${activeSlide}`}>{slide.title[language]}</h1>
          <p key={`desc-${activeSlide}`}>{slide.desc[language]}</p>
          <a href="#products" className="primary-button">
            {t.explore} <ArrowRight size={18} />
          </a>
        </div>
        <div className="hero-pagination" aria-label="Banner slides">
          {heroSlides.map((item, index) => (
            <button
              key={item.image}
              type="button"
              className={index === activeSlide ? "active" : ""}
              aria-label={`${language === "vi" ? "Chuyển đến banner" : "Go to banner"} ${index + 1}`}
              aria-pressed={index === activeSlide}
              onClick={() => setActiveSlide(index)}
            />
          ))}
        </div>
      </div>
      <div className="hero-side">
        <article className="hero-promo-card keyboard-promo">
          <div>
            <span className="promo-kicker">
              {language === "vi" ? "BÀN PHÍM CƠ" : "MECHANICAL KEYBOARDS"}
            </span>
            <h2>{t.bestSeller}</h2>
            <p>{t.bestDesc}</p>
            <button onClick={() => selectCategory("keyboards")}>
              {t.shopNow} <ArrowRight size={15} />
            </button>
          </div>
          <ProductImage
            src="https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=500&q=85"
            alt="Mechanical keyboard"
          />
        </article>
        <article className="hero-promo-card audio-promo">
          <div>
            <span className="promo-kicker">{t.audioTitle}</span>
            <h2>{language === "vi" ? "Âm thanh đỉnh cao" : "Sound, elevated"}</h2>
            <p>{t.audioDesc}</p>
            <button onClick={() => selectCategory("audio")}>
              {t.shopNow} <ArrowRight size={15} />
            </button>
          </div>
          <ProductImage
            src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=500&q=85"
            alt="Wireless headphones"
          />
        </article>
      </div>
    </section>
  );
}
