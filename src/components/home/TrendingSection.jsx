import { ArrowRight, Heart, Plus, Scale, Sparkles } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";
import HomeProductRail from "./HomeProductRail";
import { discountPercent, isDiscounted } from "../../domain/catalog";

function MiniProductCard({
  product,
  rank,
  language,
  addToCart,
  favorites,
  toggleFavorite,
  onViewProduct,
  compareIds,
  toggleCompare,
}) {
  const price = formatPrice(product.price);
  const isFavorite = favorites.includes(product.id);
  const discounted = isDiscounted(product);
  const discount = discountPercent(product);
  return (
    <article className="mini-product-card trending-product-card">
      <div className="mini-product-image">
        <button
          className="mini-product-image-trigger"
          onClick={() => onViewProduct(product)}
          aria-label={product.name}
        >
          <ProductImage src={product.image} alt={product.name} loading="lazy" />
        </button>
        <span className="trending-rank" aria-label={`Rank ${rank}`}>
          {String(rank).padStart(2, "0")}
        </span>
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
      <div className="mini-product-info">
        <span className="product-brand">{product.brand}</span>
        <h3>
          <button className="mini-product-title" onClick={() => onViewProduct(product)}>
            {product.name}
          </button>
        </h3>
        {product.description && <p className="mini-product-description">{product.description}</p>}
        <div className="mini-product-bottom">
          <div className="mini-product-price">
            <strong>{price}</strong>
            {discounted && <del>{formatPrice(product.oldPrice)}</del>}
          </div>
          <button
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

export default function TrendingSection({
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
    <section className="home-trending-section unified-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            {cms?.eyebrow ?? (language === "vi" ? "ĐƯỢC CỘNG ĐỒNG LỰA CHỌN" : "COMMUNITY FAVORITES")}
          </span>
          <h2>
            {cms?.title ?? t.trending} <Sparkles size={22} className="heading-sparkle" />
          </h2>
          <p>{cms?.description ?? t.trendingDesc}</p>
        </div>
        <a href={cms?.ctaUrl ?? "/products"} className="text-link">
          {cms?.ctaLabel ?? t.viewAll} <ArrowRight size={16} />
        </a>
      </div>
      <HomeProductRail
        className="mini-product-grid"
        language={language}
        label={language === "vi" ? "Danh sách sản phẩm thịnh hành" : "Trending products"}
      >
        {products.slice(0, cms?.limit || 8).map((product, index) => (
          <MiniProductCard
            key={`trending-${product.id}`}
            product={product}
            rank={index + 1}
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
