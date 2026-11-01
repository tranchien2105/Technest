import { ArrowRight, Heart, Scale, ShoppingCart, Sparkles } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";
import HomeProductRail from "./HomeProductRail";
import { discountPercent, isDiscounted } from "../../domain/catalog";

export default function DealSection({
  products,
  t,
  language,
  addToCart,
  favorites,
  toggleFavorite,
  compareIds,
  toggleCompare,
  onViewProduct,
  cms,
}) {
  return (
    <section className="deal-feature unified-section">
      <div className="deal-feature-copy">
        <span className="deal-label">
          <Sparkles size={14} /> {cms?.eyebrow ?? "TECHNEST DEALS"}
        </span>
        <h2>{cms?.title ?? t.dealTitle}</h2>
        <p>{cms?.description ?? t.dealDesc}</p>
        <a href={cms?.ctaUrl ?? "/products?sale=1&sort=priceLow"} className="deal-button">
          {cms?.ctaLabel ?? t.exploreMore} <ArrowRight size={17} />
        </a>
      </div>
      <HomeProductRail
        className="deal-products"
        language={language}
        label={language === "vi" ? "Danh sách sản phẩm khuyến mãi" : "Deals"}
      >
        {products.slice(0, cms?.limit || 6).map((product) => (
          <article className="deal-product" key={`deal-${product.id}`}>
            {isDiscounted(product) && (
              <span className="deal-discount-badge">
                {language === "vi" ? "GIẢM" : "SAVE"} {discountPercent(product)}%
              </span>
            )}
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
            {product.description && (
              <p className="deal-product-description">{product.description}</p>
            )}
            <div className="deal-price-row">
              <strong>{formatPrice(product.price)}</strong>
              {isDiscounted(product) && <del>{formatPrice(product.oldPrice)}</del>}
            </div>
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
                disabled={product.stockStatus !== "IN_STOCK"}
                onClick={() => addToCart(product)}
                aria-label={language === "vi" ? "Thêm vào giỏ" : "Add to cart"}
              >
                <ShoppingCart size={15} />
              </button>
            </div>
          </article>
        ))}
      </HomeProductRail>
    </section>
  );
}
