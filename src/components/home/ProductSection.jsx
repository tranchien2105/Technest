import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";

import ProductCard from "./ProductCard";

export default function ProductSection({
  visibleProducts,
  categories,
  language,
  activeCategory,
  setActiveCategory,
  setSearch,
  sortBy,
  setSortBy,
  favorites,
  toggleFavorite,
  addToCart,
  onViewProduct,
  compareIds,
  toggleCompare,
  t,
}) {
  const carouselRef = useRef(null);
  const dragRef = useRef(null);
  const draggedRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const homeProducts = visibleProducts.slice(0, 8);
  const pauseAfterInteraction = () => {
    pausedRef.current = true;
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 6000);
  };
  const scrollProducts = (direction) => {
    pauseAfterInteraction();
    carouselRef.current?.scrollBy({
      left: direction * carouselRef.current.clientWidth * 0.82,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      const carousel = carouselRef.current;
      if (!carousel || pausedRef.current || carousel.scrollWidth <= carousel.clientWidth + 4)
        return;
      const end = carousel.scrollWidth - carousel.clientWidth;
      if (carousel.scrollLeft >= end - 12) carousel.scrollTo({ left: 0, behavior: "smooth" });
      else carousel.scrollBy({ left: carousel.clientWidth * 0.78, behavior: "smooth" });
    }, 4600);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(resumeTimerRef.current);
    };
  }, []);
  const startDrag = (event) => {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      event.target.closest("button, a, input, select")
    )
      return;
    pauseAfterInteraction();
    dragRef.current = {
      x: event.clientX,
      scrollLeft: carouselRef.current.scrollLeft,
      moved: false,
    };
    carouselRef.current.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) > 5) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      carouselRef.current.scrollLeft = drag.scrollLeft - distance;
      carouselRef.current.classList.add("is-dragging");
    }
  };
  const stopDrag = () => {
    if (dragRef.current?.moved) draggedRef.current = true;
    dragRef.current = null;
    carouselRef.current?.classList.remove("is-dragging");
  };
  const preventDraggedClick = (event) => {
    if (!draggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    draggedRef.current = false;
  };
  const handleViewAll = () => {
    setActiveCategory("all");
    setSearch("");
  };

  return (
    <section className="product-section unified-section" id="products">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            {language === "vi" ? "ĐƯỢC CHỌN LỌC CHO BẠN" : "CURATED FOR YOU"}
          </span>

          <h2>
            {t.featured}
            <Sparkles size={22} className="heading-sparkle" />
          </h2>

          <p>{t.featuredDesc}</p>
        </div>

        <a href="/products" className="text-link" onClick={handleViewAll}>
          {t.viewAll}
          <ArrowRight size={16} />
        </a>
      </div>

      <div className="product-toolbar">
        <span>
          <span>
            <strong>{homeProducts.length}</strong>{" "}
            {language === "vi" ? "sản phẩm nổi bật" : "featured products"}
            {visibleProducts.length > homeProducts.length && (
              <span>
                {" "}
                ·{" "}
                {language === "vi"
                  ? `trong tổng số ${visibleProducts.length}`
                  : `of ${visibleProducts.length}`}
              </span>
            )}
          </span>
        </span>

        <label className="sort-select">
          <SlidersHorizontal size={16} />
          <span>{t.sort}:</span>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            aria-label={t.sort}
          >
            <option value="recommended">{t.recommended}</option>
            <option value="priceLow">{t.priceLow}</option>
            <option value="priceHigh">{t.priceHigh}</option>
            <option value="newest">{t.newest}</option>
          </select>

          <ChevronDown size={15} />
        </label>
      </div>

      {activeCategory !== "all" && (
        <div className="active-filter">
          <span>{categories.find((category) => category.id === activeCategory)?.[language]}</span>

          <button type="button" onClick={() => setActiveCategory("all")}>
            <X size={14} />
            {t.all}
          </button>
        </div>
      )}

      <div
        className="home-carousel-controls"
        aria-label={
          language === "vi" ? "Điều khiển danh sách sản phẩm" : "Product carousel controls"
        }
      >
        <button
          type="button"
          onClick={() => scrollProducts(-1)}
          aria-label={language === "vi" ? "Cuộn sang trái" : "Scroll left"}
        >
          <ChevronLeft size={19} />
        </button>
        <button
          type="button"
          onClick={() => scrollProducts(1)}
          aria-label={language === "vi" ? "Cuộn sang phải" : "Scroll right"}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <div
        className="home-product-carousel"
        ref={carouselRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClickCapture={preventDraggedClick}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onFocusCapture={() => {
          pausedRef.current = true;
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) pausedRef.current = false;
        }}
      >
        {homeProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            language={language}
            t={t}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            addToCart={addToCart}
            onViewProduct={onViewProduct}
            compareIds={compareIds}
            toggleCompare={toggleCompare}
          />
        ))}

        {homeProducts.length === 0 && (
          <div className="empty-products">
            <Search size={30} />
            <h3>{t.noResults}</h3>

            <button type="button" className="primary-button" onClick={handleViewAll}>
              {t.all}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
