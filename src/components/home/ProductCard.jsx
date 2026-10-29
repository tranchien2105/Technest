import { ArrowRight, Heart, Scale, ShoppingCart } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";

function getBadgeLabel(badge, language) {
  const labels = {
    bestseller: language === "vi" ? "BÁN CHẠY" : "BESTSELLER",
    sale: language === "vi" ? "GIẢM GIÁ" : "SALE",
    new: language === "vi" ? "MỚI VỀ" : "NEW",
    hot: language === "vi" ? "PHỤ KIỆN HOT" : "TRENDING",
    popular: language === "vi" ? "PHỔ BIẾN" : "POPULAR",
  };

  return labels[badge] ?? badge;
}

export default function ProductCard({
  product,
  language,
  t,
  favorites,
  toggleFavorite,
  addToCart,
  onViewProduct,
  compareIds = [],
  toggleCompare,
}) {
  const isFavorite = favorites.includes(product.id);
  const isCompared = compareIds.includes(product.id);

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <button
          type="button"
          className="product-image-trigger"
          onClick={() => onViewProduct?.(product)}
          aria-label={`View ${product.name}`}
        >
          <ProductImage src={product.image} alt={product.name} loading="lazy" />
        </button>

        {product.badge && (
          <span className={`product-badge badge-${product.badge}`}>
            {getBadgeLabel(product.badge, language)}
          </span>
        )}

        <button
          type="button"
          className={`favorite-button ${isFavorite ? "is-favorite" : ""}`}
          onClick={() => toggleFavorite(product.id)}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        {toggleCompare && (
          <button
            type="button"
            className={`compare-product-button ${isCompared ? "is-compared" : ""}`}
            onClick={() => toggleCompare(product.id)}
            aria-label={
              language === "vi"
                ? `${isCompared ? "Bỏ" : "Thêm"} ${product.name} ${isCompared ? "khỏi" : "vào"} danh sách so sánh`
                : `${isCompared ? "Remove" : "Add"} ${product.name} ${isCompared ? "from" : "to"} comparison`
            }
            title={language === "vi" ? "So sánh sản phẩm" : "Compare product"}
          >
            <Scale size={16} />
          </button>
        )}
        {product.stock <= 5 && (
          <span className="low-stock-badge">
            {language === "vi" ? `Chỉ còn ${product.stock}` : `Only ${product.stock} left`}
          </span>
        )}
      </div>

      <div className="product-info">
        <span className="product-brand">{product.brand}</span>

        <h3>
          <button
            type="button"
            className="product-title-button"
            onClick={() => onViewProduct?.(product)}
          >
            {product.name}
          </button>
        </h3>

        <p className="product-description">{product.description}</p>

        <div className="product-rating">
          <span className="rating-star">★</span>
          <strong>{product.rating.toFixed(1)}</strong>
          <span>
            ({product.reviews} {t.rating})
          </span>
        </div>

        <div className="product-price-row">
          <strong>{formatPrice(product.price)}</strong>
          {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
        </div>
        <button type="button" className="add-cart-button" onClick={() => addToCart(product)}>
          <ShoppingCart size={17} />
          <span>{t.addCart}</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}
