import { ArrowRight, Heart, Plus, Scale, Sparkles } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";

function MiniProductCard({
  product,
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
  return (
    <article className="mini-product-card">
      <div className="mini-product-image">
        <button
          className="mini-product-image-trigger"
          onClick={() => onViewProduct(product)}
          aria-label={product.name}
        >
          <ProductImage src={product.image} alt={product.name} loading="lazy" />
        </button>
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
        {product.stock <= 5 && (
          <span className="mini-stock-badge">
            {language === "vi" ? `Còn ${product.stock}` : `${product.stock} left`}
          </span>
        )}
      </div>
      <div className="mini-product-info">
        <span className="product-brand">{product.brand}</span>
        <h3>
          <button className="mini-product-title" onClick={() => onViewProduct(product)}>
            {product.name}
          </button>
        </h3>
        <div className="mini-product-bottom">
          <strong>{price}</strong>
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
  setActiveCategory,
  setSearch,
  addToCart,
  favorites,
  toggleFavorite,
  compareIds,
  toggleCompare,
  onViewProduct,
}) {
  return (
    <section className="home-trending-section unified-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            {language === "vi" ? "ĐƯỢC CỘNG ĐỒNG LỰA CHỌN" : "COMMUNITY FAVORITES"}
          </span>
          <h2>
            {t.trending} <Sparkles size={22} className="heading-sparkle" />
          </h2>
          <p>{t.trendingDesc}</p>
        </div>
        <a
          href="#products"
          className="text-link"
          onClick={() => {
            setActiveCategory("all");
            setSearch("");
          }}
        >
          {t.viewAll} <ArrowRight size={16} />
        </a>
      </div>
      <div className="mini-product-grid">
        {[products[2], products[0], products[1], products[5]].map((product) => (
          <MiniProductCard
            key={`trending-${product.id}`}
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
      </div>
    </section>
  );
}
