import { ArrowRight, Heart, Plus, Scale } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";
import HomeProductRail from "./HomeProductRail";
import { discountPercent, isDiscounted } from "../../domain/catalog";

function ArrivalCard({
  product,
  language,
  addToCart,
  favorites,
  toggleFavorite,
  onViewProduct,
  compareIds,
  toggleCompare,
}) {
  const isFavorite = favorites.includes(product.id);
  const discounted = isDiscounted(product);
  const discount = discountPercent(product);
  return (
    <article className="arrival-product-card">
      <div className="arrival-product-image">
        <button
          className="mini-product-image-trigger"
          onClick={() => onViewProduct(product)}
          aria-label={product.name}
        >
          <ProductImage src={product.image} alt={product.name} loading="lazy" />
        </button>
        <span className="arrival-new-badge">{language === "vi" ? "VỪA VỀ" : "NEW"}</span>
        {discounted && <span className="mini-discount-badge">-{discount}%</span>}
        <button
          className={`favorite-button ${isFavorite ? "is-favorite" : ""}`}
          onClick={() => toggleFavorite(product.id)}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        <button
          className={`mini-compare-button ${compareIds.includes(product.id) ? "is-compared" : ""}`}
          onClick={() => toggleCompare(product.id)}
          aria-label={language === "vi" ? "So sánh sản phẩm" : "Compare product"}
        >
          <Scale size={15} />
        </button>
      </div>
      <div className="arrival-product-info">
        <span className="product-brand">{product.brand}</span>
        <h3>
          <button className="mini-product-title" onClick={() => onViewProduct(product)}>
            {product.name}
          </button>
        </h3>
        {product.description && <p className="arrival-product-description">{product.description}</p>}
        <div className="arrival-product-bottom">
          <div className="arrival-product-price">
            <strong>{formatPrice(product.price)}</strong>
            {discounted && <del>{formatPrice(product.oldPrice)}</del>}
          </div>
          <button
            className="arrival-add-button"
            onClick={() => addToCart(product)}
            aria-label={language === "vi" ? "Thêm vào giỏ" : "Add to cart"}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function NewArrivalsSection({
  products,
  language,
  t,
  addToCart,
  favorites,
  toggleFavorite,
  compareIds,
  toggleCompare,
  onViewProduct,
  cms,
}) {
  return (
    <section className="home-new-section unified-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            {cms?.eyebrow ?? (language === "vi" ? "MỚI NHẤT TRONG CỬA HÀNG" : "FRESH IN STORE")}
          </span>
          <h2>{cms?.title ?? t.newArrivals}</h2>
          <p>{cms?.description ?? t.newArrivalsDesc}</p>
        </div>
        <a href={cms?.ctaUrl ?? "/products?sort=newest"} className="text-link">
          {cms?.ctaLabel ?? t.viewAll} <ArrowRight size={16} />
        </a>
      </div>
      <HomeProductRail
        className="arrival-product-rail"
        language={language}
        label={language === "vi" ? "Danh sách sản phẩm mới" : "New arrivals"}
      >
        {products.slice(0, cms?.limit || 8).map((product) => (
          <ArrivalCard
            key={`new-${product.id}`}
            product={product}
            language={language}
            addToCart={addToCart}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            compareIds={compareIds}
            toggleCompare={toggleCompare}
            onViewProduct={onViewProduct}
          />
        ))}
      </HomeProductRail>
    </section>
  );
}
