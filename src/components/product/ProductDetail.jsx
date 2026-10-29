import { useState } from "react";
import {
  ArrowLeft,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";
import "./ProductDetail.css";

export default function ProductDetail({
  product,
  products,
  language,
  t,
  favorites,
  toggleFavorite,
  addToCart,
  onBack,
  onViewProduct,
}) {
  const [quantity, setQuantity] = useState(1);

  const isFavorite = favorites.includes(product.id);

  const relatedProducts = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4);

  const text =
    language === "vi"
      ? {
          breadcrumb: "Chi tiết sản phẩm",
          description: "Mô tả sản phẩm",
          specifications: "Thông tin sản phẩm",
          brand: "Thương hiệu",
          category: "Danh mục",
          rating: "Đánh giá khách hàng",
          quantity: "Số lượng",
          inStock: "Còn hàng",
          addCart: "Thêm vào giỏ hàng",
          favorite: "Thêm vào yêu thích",
          unfavorite: "Bỏ yêu thích",
          shipping: "Giao hàng toàn quốc",
          warranty: "Sản phẩm chính hãng",
          returns: "Hỗ trợ đổi trả",
          related: "Sản phẩm liên quan",
          back: "Tiếp tục mua sắm",
        }
      : {
          breadcrumb: "Product details",
          description: "Product description",
          specifications: "Product information",
          brand: "Brand",
          category: "Category",
          rating: "Customer reviews",
          quantity: "Quantity",
          inStock: "In stock",
          addCart: "Add to cart",
          favorite: "Add to wishlist",
          unfavorite: "Remove from wishlist",
          shipping: "Nationwide delivery",
          warranty: "Authentic products",
          returns: "Return support",
          related: "Related products",
          back: "Continue shopping",
        };

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  return (
    <section className="detail-page">
      <div className="detail-breadcrumb">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          {text.back}
        </button>

        <span>/</span>
        <span>{text.breadcrumb}</span>
      </div>

      <div className="detail-main">
        <div className="detail-image-panel">
          <div className="detail-image">
            <ProductImage src={product.image} alt={product.name} />
          </div>

          {product.badge && (
            <span className={`product-badge badge-${product.badge}`}>
              {product.badge === "sale"
                ? language === "vi"
                  ? "GIẢM GIÁ"
                  : "SALE"
                : product.badge === "bestseller"
                  ? language === "vi"
                    ? "BÁN CHẠY"
                    : "BESTSELLER"
                  : product.badge === "new"
                    ? language === "vi"
                      ? "MỚI VỀ"
                      : "NEW"
                    : product.badge === "hot"
                      ? language === "vi"
                        ? "PHỤ KIỆN HOT"
                        : "TRENDING"
                      : language === "vi"
                        ? "PHỔ BIẾN"
                        : "POPULAR"}
            </span>
          )}
        </div>

        <div className="detail-info">
          <span className="detail-brand">{product.brand}</span>

          <h1>{product.name}</h1>

          <div className="detail-rating">
            <Star size={17} fill="currentColor" />
            <strong>{product.rating.toFixed(1)}</strong>
            <span>
              ({product.reviews} {t.rating})
            </span>
          </div>

          <div className="detail-price">
            <strong>{formatPrice(product.price)}</strong>

            {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}

            {product.oldPrice && (
              <span className="detail-discount">
                -{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
              </span>
            )}
          </div>

          <p className="detail-description">{product.description}</p>

          <div className="detail-stock">
            <span className="stock-dot" />
            {text.inStock}
          </div>

          <div className="detail-quantity">
            <span>{text.quantity}</span>

            <div className="quantity-control">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                <Minus size={15} />
              </button>

              <span>{quantity}</span>

              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= 99}
                onClick={() => setQuantity((current) => Math.min(99, current + 1))}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          <button type="button" className="detail-add-button" onClick={handleAddToCart}>
            <ShoppingCart size={19} />
            {text.addCart}
            <span>{formatPrice(product.price * quantity)}</span>
          </button>

          <button
            type="button"
            className={`detail-favorite-button ${isFavorite ? "is-favorite" : ""}`}
            onClick={() => toggleFavorite(product.id)}
          >
            <Heart size={19} fill={isFavorite ? "currentColor" : "none"} />
            {isFavorite ? text.unfavorite : text.favorite}
          </button>

          <div className="detail-benefits">
            <div>
              <Truck size={20} />
              <span>{text.shipping}</span>
            </div>

            <div>
              <ShieldCheck size={20} />
              <span>{text.warranty}</span>
            </div>

            <div>
              <RotateCcw size={20} />
              <span>{text.returns}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-description-section">
        <span className="section-kicker">{text.specifications}</span>
        <h2>{text.description}</h2>
        <p>{product.description}</p>

        <div className="detail-meta">
          <div>
            <span>{text.brand}</span>
            <strong>{product.brand}</strong>
          </div>

          <div>
            <span>{text.category}</span>
            <strong>{product.category}</strong>
          </div>

          <div>
            <span>{text.rating}</span>
            <strong>{product.rating.toFixed(1)} / 5</strong>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="detail-related">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                {language === "vi" ? "CÓ THỂ BẠN SẼ THÍCH" : "YOU MAY ALSO LIKE"}
              </span>

              <h2>{text.related}</h2>
            </div>
          </div>

          <div className="detail-related-grid">
            {relatedProducts.map((item) => (
              <button
                type="button"
                className="detail-related-card"
                key={item.id}
                onClick={() => onViewProduct(item)}
              >
                <ProductImage src={item.image} alt={item.name} />

                <span>{item.brand}</span>
                <strong>{item.name}</strong>
                <b>{formatPrice(item.price)}</b>
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
