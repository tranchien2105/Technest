import { productUrl } from "../../routing/productUrl";
import { ArrowRight, Heart, Scale, ShoppingCart } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";
import { compareMoney } from "../../domain/cart";
import { discountPercent, isDiscounted } from "../../domain/catalog";

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
  priority = false,
}) {
  const isFavorite = favorites.includes(product.id);
  const isCompared = compareIds.includes(product.id);
  const unavailable = product.stockStatus !== "IN_STOCK";
  const discounted = isDiscounted(product);

  const viewProduct = (event) => {
    if (
      !onViewProduct ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    onViewProduct(product);
  };
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <a
          href={productUrl(product)}
          draggable={false}
          className="product-image-trigger"
          onClick={viewProduct}
          aria-label={`View ${product.name}`}
        >
          <ProductImage
            src={product.image}
            alt={product.name}
            width="400"
            height="300"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
          />
        </a>

        {product.badge && (
          <span className={`product-badge badge-${product.badge}`}>
            {product.badge === "sale" && discounted
              ? `${language === "vi" ? "GIẢM" : "SAVE"} ${discountPercent(product)}%`
              : getBadgeLabel(product.badge, language)}
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
      </div>

      <div className="product-info">
        <span className="product-brand">{product.brand}</span>

        <h3>
          <a href={productUrl(product)} className="product-title-button" onClick={viewProduct}>
            {product.name}
          </a>
        </h3>

        <div className="product-price-row">
          <strong>{formatPrice(product.price)}</strong>
          {product.oldPrice && compareMoney(product.oldPrice, product.price) > 0 && (
            <del>{formatPrice(product.oldPrice)}</del>
          )}
          {discounted && <span className="price-discount-badge">-{discountPercent(product)}%</span>}
        </div>
        <p className="product-description">{product.description}</p>
        <button
          type="button"
          className="add-cart-button"
          disabled={unavailable}
          onClick={() => addToCart(product)}
        >
          <ShoppingCart size={17} />
          <span>
            {unavailable
              ? language === "vi"
                ? product.stockStatus === "OUT_OF_STOCK"
                  ? "Hết hàng"
                  : "Chưa xác nhận tồn kho"
                : product.stockStatus === "OUT_OF_STOCK"
                  ? "Out of stock"
                  : "Stock unconfirmed"
              : t.addCart}
          </span>
          <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}
