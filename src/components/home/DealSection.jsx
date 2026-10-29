import { ArrowRight, Heart, Scale, ShoppingCart, Sparkles } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";

export default function DealSection({
  products,
  t,
  setSortBy,
  setActiveCategory,
  language,
  addToCart,
  favorites,
  toggleFavorite,
  compareIds,
  toggleCompare,
  onViewProduct,
}) {
  return (
    <section className="deal-feature unified-section">
      <div className="deal-feature-copy">
        <span className="deal-label">
          <Sparkles size={14} /> TECHNEST DEALS
        </span>
        <h2>{t.dealTitle}</h2>
        <p>{t.dealDesc}</p>
        <a
          href="#products"
          className="deal-button"
          onClick={() => {
            setSortBy("priceLow");
            setActiveCategory("all");
          }}
        >
          {t.exploreMore} <ArrowRight size={17} />
        </a>
      </div>
      <div className="deal-products">
        {[products[3], products[7], products[4]].map((product) => (
          <div className="deal-product" key={`deal-${product.id}`}>
            <button
              type="button"
              className="deal-product-image"
              onClick={() => onViewProduct(product)}
              aria-label={product.name}
            >
              <ProductImage src={product.image} alt={product.name} loading="lazy" />
            </button>
            <span>
              <button className="deal-product-title" onClick={() => onViewProduct(product)}>
                {product.name}
              </button>
            </span>
            <strong>{formatPrice(product.price)}</strong>
            {product.stock <= 5 && (
              <small className="deal-stock-note">
                {language === "vi"
                  ? `Sắp hết · còn ${product.stock}`
                  : `Low stock · ${product.stock} left`}
              </small>
            )}
            <div className="deal-product-actions">
              <button
                type="button"
                className={favorites.includes(product.id) ? "is-active" : ""}
                onClick={() => toggleFavorite(product.id)}
                aria-label={language === "vi" ? "Yêu thích" : "Favorite"}
              >
                <Heart size={15} />
              </button>
              <button
                type="button"
                className={compareIds.includes(product.id) ? "is-active" : ""}
                onClick={() => toggleCompare(product.id)}
                aria-label={language === "vi" ? "So sánh" : "Compare"}
              >
                <Scale size={15} />
              </button>
              <button
                type="button"
                onClick={() => addToCart(product)}
                aria-label={language === "vi" ? "Thêm vào giỏ" : "Add to cart"}
              >
                <ShoppingCart size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
