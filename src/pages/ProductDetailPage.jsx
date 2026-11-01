import { useState } from "react";
import { ArrowRight, Heart, Minus, Plus, Scale } from "lucide-react";
import ProductImage from "../components/common/ProductImage";
import { formatPrice } from "../utils/formatCurrency";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import { Empty } from "../components/store/PageElements";
import ProductGrid from "../components/store/ProductGrid";
import FeatureProductShelf from "../components/home/FeatureProductShelf";
import { productGallery } from "../domain/catalog";
import { compareMoney } from "../domain/cart";

export default function ProductDetailPage({
  navigate,
  t,
  language,
  categories,
  products,
  viewedProducts = [],
  product,
  catalogLoading,
  catalogError,
  favorites,
  toggleFavorite,
  compareIds,
  toggleCompare,
  addToCart,
  buyNow,
}) {
  const cardProps = {
    language,
    t,
    favorites,
    toggleFavorite,
    addToCart,
    navigate,
    compareIds,
    toggleCompare,
  };
  const lang = language === "vi";
  const [detailImage, setDetailImage] = useState(null);
  const [quantityState, setQuantityState] = useState({ key: null, quantity: 1 });
  const activeVariants = product?.variants?.filter((variant) => variant.status === "ACTIVE") || [];
  const [selectedVariantId, setSelectedVariantId] = useState(activeVariants[0]?.id || "");
  const selectedVariant =
    activeVariants.find((variant) => variant.id === selectedVariantId) || activeVariants[0];
  const variantKey = `${product?.id || ""}:${selectedVariant?.id || "default"}`;
  const detailQuantity = quantityState.key === variantKey ? quantityState.quantity : 1;
  const setDetailQuantity = (value) =>
    setQuantityState({
      key: variantKey,
      quantity: typeof value === "function" ? value(detailQuantity) : value,
    });
  const displayedProduct =
    product && selectedVariant
      ? {
          ...product,
          variantId: selectedVariant.id,
          sku: selectedVariant.sku,
          price: selectedVariant.price ?? product.price,
          oldPrice: selectedVariant.compareAtPrice ?? product.oldPrice,
          availableQuantity: selectedVariant.availableQuantity,
          inStock: selectedVariant.inStock,
          stockStatus: selectedVariant.stockStatus || "UNKNOWN",
          attributes: { ...product.attributes, ...selectedVariant.attributes },
          image:
            selectedVariant.images?.[0]?.url ||
            product.baseImage ||
            (selectedVariant.id === product.defaultVariantId ? product.image : ""),
          images: [
            ...(product.imageRecords || [])
              .filter((image) => !image.variantId)
              .map((image) => image.url),
            ...(selectedVariant.images || []).map((image) => image.url),
          ],
        }
      : product;
  const productAttributes = displayedProduct?.attributes || {};
  const technicalSpecifications = productAttributes.specifications && typeof productAttributes.specifications === "object"
    ? Object.entries(productAttributes.specifications)
    : [];
  const isIllustration = productAttributes.dataset === "development-illustration";
  const allCategories = categories.flatMap((category) => [category, ...(category.children || [])]);
  const cards = (items) => <ProductGrid {...cardProps} items={items} />;

  if (!product)
    return (
      <section className="store-page">
        <PageTitle
          title={
            catalogLoading
              ? tx("Loading product", "Đang tải sản phẩm", lang)
              : tx("Product not found", "Không tìm thấy sản phẩm", lang)
          }
        />
        {catalogError && (
          <p className="catalog-feedback" role="status">
            {tx(
              "The catalog service is unavailable. Please try again.",
              "Danh mục đang tạm thời không khả dụng. Vui lòng thử lại.",
              lang,
            )}
          </p>
        )}
        {catalogLoading ? (
          <div className="catalog-product-skeleton" aria-hidden="true" />
        ) : (
          <Empty
            title={tx("We couldn't find that product", "Không tìm thấy sản phẩm này", lang)}
            text={tx(
              "It may have moved or is no longer available.",
              "Sản phẩm có thể đã được chuyển hoặc không còn kinh doanh.",
              lang,
            )}
            go={navigate}
            lang={lang}
          />
        )}
      </section>
    );
  const gallery = productGallery(displayedProduct);
  const recommendations = products
    .filter((x) => x.id !== product.id && x.category === product.category)
    .slice(0, 4);
  const compatibleAccessories = products
    .filter(
      (item) => item.category === "accessories" && item.compatibleWith?.includes(product.category),
    )
    .slice(0, 4);
  const recentlyViewed = viewedProducts
    .filter((item) => String(item.id) !== String(product.id))
    .slice(0, 4);
  const specs = [
    [tx("Brand", "Thương hiệu", lang), product.brand],
    [
      tx("Category", "Danh mục", lang),
      allCategories.find((c) => c.id === product.category)?.[language] ||
        allCategories.find((c) => c.id === product.category)?.name || product.category,
    ],
    [
      tx("Availability", "Tình trạng", lang),
      displayedProduct.stockStatus === "IN_STOCK"
        ? `${tx("In stock", "Còn hàng", lang)} · ${displayedProduct.availableQuantity}`
        : displayedProduct.stockStatus === "OUT_OF_STOCK"
          ? tx("Out of stock", "Hết hàng", lang)
          : tx("Availability cannot be confirmed", "Chưa xác nhận được tồn kho", lang),
    ],
    [tx("Warranty", "Bảo hành", lang), productAttributes.warranty || tx("Not specified", "Chưa có thông tin", lang)],
  ];
  return (
    <section className="store-page product-detail-page">
      <div className="store-breadcrumb">
        <a href="/">{tx("Home", "Trang chủ", lang)}</a> /{" "}
        <a href="/products">{tx("Products", "Sản phẩm", lang)}</a> / {product.name}
      </div>
      <div className="route-detail">
        <div className="detail-gallery">
          <div className="detail-gallery-main">
            <ProductImage
              src={
                detailImage?.variantKey === variantKey ? detailImage.src : displayedProduct.image
              }
              alt={displayedProduct.name}
            />
            {product.badge && (
              <span className={`product-badge badge-${product.badge}`}>
                {product.badge === "sale"
                  ? tx("SALE", "GIẢM GIÁ", lang)
                  : product.badge === "new"
                    ? tx("NEW", "MỚI VỀ", lang)
                    : product.badge === "bestseller"
                      ? tx("BESTSELLER", "BÁN CHẠY", lang)
                      : tx("POPULAR", "ĐƯỢC YÊU THÍCH", lang)}
              </span>
            )}
          </div>
          <div className="detail-thumbnails">
            {gallery.map((src, i) => (
              <button
                className={
                  (detailImage?.variantKey === variantKey
                    ? detailImage.src
                    : displayedProduct.image) === src
                    ? "is-selected"
                    : ""
                }
                key={`${src}-${i}`}
                onClick={() => setDetailImage({ variantKey, src })}
                aria-label={`${tx("View image", "Xem ảnh", lang)} ${i + 1}`}
              >
                <ProductImage src={src} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="route-detail-info">
          <span className="product-brand">{product.brand}</span>
          <h1>{product.name}</h1>
          <p className="route-price">
            {formatPrice(displayedProduct.price)}{" "}
            {displayedProduct.oldPrice &&
              compareMoney(displayedProduct.oldPrice, displayedProduct.price) > 0 && (
                <>
                  <del>{formatPrice(displayedProduct.oldPrice)}</del>
                  <span className="detail-discount">
                    -
                    {Number(
                      ((BigInt(displayedProduct.oldPrice) - BigInt(displayedProduct.price)) *
                        100n) /
                        BigInt(displayedProduct.oldPrice),
                    )}
                    %
                  </span>
                </>
              )}
          </p>
          <p className="detail-lead">{product.description}</p>
          {isIllustration && (
            <p className="catalog-illustration-note" role="note">
              {tx(
                "Development catalog illustration — not an official product or manufacturer specification.",
                "Dữ liệu và ảnh minh họa cho môi trường phát triển, không phải thông tin sản phẩm chính thức.",
                lang,
              )}
            </p>
          )}
          <p className="stock-note" role="status">
            {displayedProduct.stockStatus === "IN_STOCK"
              ? `${tx("In stock", "Còn hàng", lang)} · ${displayedProduct.availableQuantity} ${tx("available", "có thể mua", lang)}. ${tx("Availability is informational and may change before checkout.", "Tồn kho chỉ mang tính tham khảo và có thể thay đổi trước khi thanh toán.", lang)}`
              : displayedProduct.stockStatus === "OUT_OF_STOCK"
                ? tx("Currently out of stock.", "Sản phẩm hiện đã hết hàng.", lang)
                : tx(
                    "Availability cannot be confirmed right now.",
                    "Hiện chưa xác nhận được tồn kho.",
                    lang,
                  )}
          </p>
          {activeVariants.length > 1 && (
            <label className="detail-variant-select">
              {tx("Variant", "Phiên bản", lang)}
              <select
                value={selectedVariant?.id || ""}
                onChange={(event) => {
                  setSelectedVariantId(event.target.value);
                }}
              >
                {activeVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {displayedProduct.sku && <p className="detail-sku">SKU: {displayedProduct.sku}</p>}
          <div className="detail-points">
            {isIllustration ? (
              <>
                <span>✓ {tx("Illustrative listing", "Sản phẩm minh họa", lang)}</span>
                <span>✓ {tx("Specifications require verification", "Thông số cần đối chiếu", lang)}</span>
                <span>✓ {tx("Local development data", "Dữ liệu phát triển cục bộ", lang)}</span>
              </>
            ) : (
              <>
                <span>✓ {tx("Authentic products", "Sản phẩm chính hãng", lang)}</span>
                <span>✓ {tx("Official warranty", "Bảo hành đầy đủ", lang)}</span>
                <span>✓ {tx("Free shipping over 1,000,000₫", "Miễn phí giao hàng đơn từ 1.000.000₫", lang)}</span>
              </>
            )}
          </div>
          <div className="detail-buy-row">
            <div className="quantity-control">
              <button
                onClick={() => setDetailQuantity((q) => Math.max(1, q - 1))}
                aria-label={tx("Decrease quantity", "Giảm số lượng", lang)}
              >
                <Minus size={14} />
              </button>
              <span>{detailQuantity}</span>
              <button
                disabled={
                  displayedProduct.stockStatus !== "IN_STOCK" ||
                  detailQuantity >= displayedProduct.availableQuantity
                }
                onClick={() => setDetailQuantity((q) => q + 1)}
                aria-label={tx("Increase quantity", "Tăng số lượng", lang)}
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              className="primary-button"
              disabled={
                displayedProduct.stockStatus !== "IN_STOCK" ||
                detailQuantity > displayedProduct.availableQuantity
              }
              onClick={() => addToCart(displayedProduct, detailQuantity)}
            >
              {tx("Add to cart", "Thêm vào giỏ", lang)}
            </button>
            <button
              className="outline-button"
              onClick={() => toggleFavorite(product.id)}
              aria-label={tx("Toggle favorite", "Thêm hoặc bỏ yêu thích", lang)}
            >
              <Heart size={18} fill={favorites.includes(product.id) ? "currentColor" : "none"} />
            </button>
            <button
              className={`outline-button ${compareIds.includes(product.id) ? "is-compared" : ""}`}
              onClick={() => toggleCompare(product.id)}
              aria-label={tx("Compare product", "So sánh sản phẩm", lang)}
            >
              <Scale size={18} />
            </button>
          </div>
          <button
            className="buy-now-button"
            disabled={
              displayedProduct.stockStatus !== "IN_STOCK" ||
              detailQuantity > displayedProduct.availableQuantity
            }
            onClick={() => {
              buyNow(displayedProduct, detailQuantity);
            }}
          >
            {tx("Buy now", "Mua ngay", lang)} <ArrowRight size={16} />
          </button>
          <div className="delivery-note">
            {tx(
              "Carefully packed · Delivery nationwide · Easy support",
              "Đóng gói cẩn thận · Giao hàng toàn quốc · Hỗ trợ tận tâm",
              lang,
            )}
          </div>
        </div>
      </div>
      <div className="detail-content-grid">
        <section className="detail-information">
          <h2>{tx("Description", "Mô tả sản phẩm", lang)}</h2>
          <p>{product.description}</p>
          {Object.entries(productAttributes).some(([name, value]) => !["specifications", "dataset", "categoryLabel", "warranty", "note", "seedKey", "seedOrdinal"].includes(name) && typeof value !== "object") && (
            <>
              <h2>{tx("Product attributes", "Thuộc tính sản phẩm", lang)}</h2>
              <ul>
                {Object.entries(productAttributes)
                  .filter(([name, value]) => !["specifications", "dataset", "categoryLabel", "warranty", "note", "seedKey", "seedOrdinal"].includes(name) && typeof value !== "object")
                  .map(([name, value]) => <li key={name}>{name}: {String(value)}</li>)}
              </ul>
            </>
          )}
        </section>
        <aside className="specification-panel">
          <h2>{tx("Specifications", "Thông số sản phẩm", lang)}</h2>
          {specs.map(([label, value]) => (
            <div className="specification-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          {technicalSpecifications.map(([label, value]) => (
            <div className="specification-row" key={label}>
              <span>{label}</span>
              <strong>{String(value)}</strong>
            </div>
          ))}
        </aside>
      </div>
      <section className="detail-recommendations">
        <PageTitle
          title={tx("You may also like", "Có thể bạn cũng thích", lang)}
          desc={tx(
            "More picks selected for your setup",
            "Thêm lựa chọn phù hợp cho góc setup của bạn",
            lang,
          )}
        />
        {cards(recommendations)}
      </section>
      {compatibleAccessories.length > 0 && (
        <section className="detail-recommendations compatible-accessories">
          <PageTitle
            title={tx("Accessories that work well with it", "Phụ kiện hợp với sản phẩm này", lang)}
            desc={tx(
              "A few thoughtful additions for your setup",
              "Gợi ý thêm phụ kiện phù hợp cho góc setup",
              lang,
            )}
          />
          {cards(compatibleAccessories)}
        </section>
      )}
      <FeatureProductShelf
        products={recentlyViewed}
        title={lang ? "Sản phẩm bạn đã xem gần đây" : "Recently viewed products"}
        language={language}
        t={t}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        addToCart={addToCart}
        compareIds={compareIds}
        toggleCompare={toggleCompare}
        onViewProduct={(item) => navigate(`/products/${item.id}`)}
      />
    </section>
  );
}
