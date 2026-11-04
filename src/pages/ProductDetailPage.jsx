import "../components/product/ProductDetail.css";
import { productUrl as getProductUrl } from "../routing/productUrl";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Flame, Heart, Minus, Plus, Scale, ShoppingCart, Star } from "lucide-react";
import ProductImage from "../components/common/ProductImage";
import { formatPrice } from "../utils/formatCurrency";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import { Empty } from "../components/store/PageElements";
import ProductGrid from "../components/store/ProductGrid";
import FeatureProductShelf from "../components/home/FeatureProductShelf";
import { productGallery } from "../domain/catalog";
import { compareMoney } from "../domain/cart";
import { flashSalesApi } from "../api/flashSalesClient";
import { apiEventSource } from "../api/apiClient";
import { findVariantFlashDeal } from "../domain/flashSale";

export default function ProductDetailPage({
  route,
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
  const [flashDeal, setFlashDeal] = useState(null);
  const [flashClockOffset, setFlashClockOffset] = useState(0);
  const [flashTick, setFlashTick] = useState(0);
  const [quantityState, setQuantityState] = useState({ key: null, quantity: 1 });
  const purchaseBarRef = useRef(null);
  useEffect(() => {
    if (!product?.id) return undefined;
    document.body.classList.add("has-detail-purchase-bar");
    const updateHeight = () => {
      const height = purchaseBarRef.current?.getBoundingClientRect().height;
      if (height) document.body.style.setProperty("--detail-purchase-bar-height", `${Math.ceil(height)}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (purchaseBarRef.current) observer.observe(purchaseBarRef.current);
    return () => {
      observer.disconnect();
      document.body.classList.remove("has-detail-purchase-bar");
      document.body.style.removeProperty("--detail-purchase-bar-height");
    };
  }, [product?.id]);
  const activeVariants = product?.variants?.filter((variant) => variant.status === "ACTIVE") || [];
  const variantUrl = new URL(route || "/", "http://technest.local");
  const selectedVariantId = variantUrl.searchParams.get("variant") || activeVariants[0]?.id || "";
  const setSelectedVariantId = (id) => {
    if (id === activeVariants[0]?.id) variantUrl.searchParams.delete("variant");
    else variantUrl.searchParams.set("variant",id);
    navigate(variantUrl.pathname + variantUrl.search + variantUrl.hash, false, {replace:true});
  };
  const selectedVariant =
    activeVariants.find((variant) => variant.id === selectedVariantId) || activeVariants[0];
  useEffect(() => {
    if (!selectedVariant?.id) return;
    const controller = new AbortController();
    let active = true;
    let requestVersion = 0;
    const load = () => {
      const version = ++requestVersion;
      return flashSalesApi.list({ signal: controller.signal }).then(({ campaigns, serverNow }) => {
        if (!active || version !== requestVersion) return;
        const receivedAt = Date.now();
        const serverTime = Date.parse(serverNow);
        setFlashTick(receivedAt);
        setFlashClockOffset(serverTime - receivedAt);
        setFlashDeal(findVariantFlashDeal(campaigns, selectedVariant.id, serverTime, selectedVariant.price ?? product.price));
      }).catch(() => { if (active && version === requestVersion) setFlashDeal(null); });
    };
    void load();
    const timer = window.setInterval(load, 15_000);
    const clock = window.setInterval(() => setFlashTick(Date.now()), 1000);
    const events = apiEventSource("/flash-sales/events");
    ["flash-sale:campaign-started", "flash-sale:campaign-ended", "flash-sale:item-updated", "flash-sale:campaign-updated"].forEach((name) => events.addEventListener(name, load));
    events.onopen = load;
    return () => { active = false; controller.abort(); clearInterval(timer); clearInterval(clock); events.close(); };
  }, [selectedVariant?.id, selectedVariant?.price, product?.price]);
  const variantKey = `${product?.id || ""}:${selectedVariant?.id || "default"}`;
  const detailQuantity = quantityState.key === variantKey ? quantityState.quantity : 1;
  const setDetailQuantity = (value) =>
    setQuantityState({
      key: variantKey,
      quantity: typeof value === "function" ? value(detailQuantity) : value,
    });
  const baseDisplayedProduct =
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
  const activeFlashDeal = flashDeal?.variantId === String(selectedVariant?.id) && Date.parse(flashDeal.endsAt) > flashTick + flashClockOffset ? flashDeal : null;
  const flashPurchaseLimit = activeFlashDeal && baseDisplayedProduct
    ? Math.min(baseDisplayedProduct.availableQuantity ?? activeFlashDeal.stockAvailable, activeFlashDeal.availableQuantity, activeFlashDeal.perCustomerLimit)
    : 0;
  const displayedProduct = activeFlashDeal && baseDisplayedProduct ? { ...baseDisplayedProduct, price: activeFlashDeal.flashPrice, oldPrice: activeFlashDeal.originalPrice, flashSalePrice: activeFlashDeal.flashPrice, flashSaleItemId: activeFlashDeal.id, flashSaleAvailableQuantity: flashPurchaseLimit, availableQuantity: flashPurchaseLimit, stockStatus: flashPurchaseLimit > 0 ? "IN_STOCK" : "OUT_OF_STOCK" } : baseDisplayedProduct;
  const flashRemaining = activeFlashDeal ? Math.max(0, new Date(activeFlashDeal.endsAt).getTime() - (flashTick + flashClockOffset)) : 0;
  const flashCountdown = `${String(Math.floor(flashRemaining / 3_600_000)).padStart(2,"0")}:${String(Math.floor(flashRemaining % 3_600_000 / 60_000)).padStart(2,"0")}:${String(Math.floor(flashRemaining % 60_000 / 1000)).padStart(2,"0")}`;
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
          {Number(product.rating) > 0 && (
            <div className="detail-rating" aria-label={`Đánh giá ${product.rating} trên 5`}>
              <Star size={15} fill="currentColor" />
              <strong>{Number(product.rating).toFixed(1)}</strong>
              {product.reviews && <span>{product.reviews} đánh giá</span>}
            </div>
          )}
          {activeFlashDeal ? (
            <>
              <section className="detail-flash-offer" aria-label="Ưu đãi Flash Sale">
                <div className="detail-flash-price">
                  <strong>{formatPrice(activeFlashDeal.flashPrice)}</strong>
                  <div>
                    <del>{formatPrice(activeFlashDeal.originalPrice)}</del>
                    <span>
                      -{Number(
                        ((BigInt(activeFlashDeal.originalPrice) - BigInt(activeFlashDeal.flashPrice)) * 100n) /
                          BigInt(activeFlashDeal.originalPrice),
                      )}%
                    </span>
                  </div>
                </div>
                <div className="detail-flash-strip">
                  <strong><Flame size={17} fill="currentColor"/> Flash Sale</strong>
                  <span className="detail-flash-countdown" aria-label={`Kết thúc sau ${flashCountdown}`}>
                    {flashCountdown.split(":").map((part, index) => <span key={`${part}-${index}`}>{part}</span>)}
                  </span>
                  <span className="detail-flash-quota"><Flame size={15} fill="currentColor"/> Còn {activeFlashDeal.availableQuantity}/{activeFlashDeal.quota} suất</span>
                </div>
                <p>Giới hạn {activeFlashDeal.perCustomerLimit} sản phẩm mỗi khách</p>
              </section>
              <ul className="detail-flash-terms">
                <li>Không áp dụng chung với khuyến mãi khác.</li>
                <li>Khuyến mãi chưa bao gồm phí giao hàng.</li>
                <li>Ưu đãi có thể kết thúc sớm khi hết suất.</li>
              </ul>
            </>
          ) : (
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
          )}
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
          {!activeFlashDeal && <p className="stock-note" role="status">
            {displayedProduct.stockStatus === "IN_STOCK"
              ? `${tx("In stock", "Còn hàng", lang)} · ${displayedProduct.availableQuantity} ${tx("available", "có thể mua", lang)}. ${tx("Availability is informational and may change before checkout.", "Tồn kho chỉ mang tính tham khảo và có thể thay đổi trước khi thanh toán.", lang)}`
              : displayedProduct.stockStatus === "OUT_OF_STOCK"
                ? tx("Currently out of stock.", "Sản phẩm hiện đã hết hàng.", lang)
                : tx(
                    "Availability cannot be confirmed right now.",
                    "Hiện chưa xác nhận được tồn kho.",
                    lang,
                  )}
          </p>}
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
              className={`outline-button ${favorites.includes(product.id) ? "is-favorite" : ""}`}
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
          headingLevel={2}
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
            headingLevel={2}
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
        onViewProduct={(item) => navigate(getProductUrl(item))}
      />
      <div ref={purchaseBarRef} className="detail-purchase-bar" role="region" aria-label={tx("Product purchase", "Mua sản phẩm", lang)}>
        <div className="detail-purchase-bar-inner">
          <div className="detail-purchase-product">
            <ProductImage src={displayedProduct.image} alt="" />
            <div><strong>{product.name}</strong><span>{selectedVariant?.name || displayedProduct.sku} · {tx("Quantity", "Số lượng", lang)}: {detailQuantity}</span></div>
          </div>
          <div className="detail-purchase-actions">
          <div className="detail-purchase-total">
            <span>{tx("Subtotal", "Tạm tính", lang)}</span>
            <strong>{formatPrice(BigInt(displayedProduct.price) * BigInt(detailQuantity))}</strong>
          </div>
          <button type="button" className="detail-purchase-cart" disabled={displayedProduct.stockStatus !== "IN_STOCK" || detailQuantity > displayedProduct.availableQuantity} onClick={() => addToCart(displayedProduct, detailQuantity)}>
            <ShoppingCart size={20}/><span>{tx("Add to cart", "Thêm vào giỏ", lang)}</span>
          </button>
          <button type="button" className="detail-purchase-buy" disabled={displayedProduct.stockStatus !== "IN_STOCK" || detailQuantity > displayedProduct.availableQuantity} onClick={() => buyNow(displayedProduct, detailQuantity)}>
            {tx("Buy now", "Mua ngay", lang)}<ArrowRight size={17}/>
          </button>
          </div>
        </div>
      </div>
    </section>
  );
}
