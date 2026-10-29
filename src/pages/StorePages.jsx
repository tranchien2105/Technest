import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Heart,
  Minus,
  Plus,
  Scale,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import ProductCard from "../components/home/ProductCard";
import ProductImage from "../components/common/ProductImage";
import { formatPrice } from "../utils/formatCurrency";

const safeRead = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

function PageTitle({ eyebrow = "TECHNEST", title, desc }) {
  return (
    <div className="store-title">
      <span className="section-kicker">{eyebrow}</span>
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
  );
}
function tx(en, vi, lang) {
  return lang ? vi : en;
}
function ShippingProgress({ subtotal, language }) {
  const vi = language === "vi";
  const threshold = 1000000;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div className="shipping-progress">
      <p>
        {remaining
          ? vi
            ? `Mua thêm ${formatPrice(remaining)} để được miễn phí vận chuyển`
            : `Add ${formatPrice(remaining)} for free shipping`
          : vi
            ? "Đơn hàng đã được miễn phí vận chuyển!"
            : "Your order qualifies for free shipping!"}
      </p>
      <div className="shipping-progress-track" aria-label={`${Math.round(progress)}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
function Empty({ title, text, go, lang }) {
  return (
    <div className="store-empty">
      <ShoppingBag size={34} />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary-button" onClick={() => go("/products")}>
        {tx("Continue shopping", "Tiếp tục mua sắm", lang)} <ArrowRight size={16} />
      </button>
    </div>
  );
}

const VN_AREAS = {
  "Hồ Chí Minh": {
    "Quận 1": ["Bến Nghé", "Bến Thành", "Đa Kao"],
    "Quận 3": ["Phường 1", "Phường 2", "Phường 3"],
    "Bình Thạnh": ["Phường 1", "Phường 2", "Phường 25"],
    "TP. Thủ Đức": ["Thảo Điền", "An Phú", "Hiệp Bình Chánh"],
  },
  "Hà Nội": {
    "Ba Đình": ["Phúc Xá", "Trúc Bạch", "Vĩnh Phúc"],
    "Hoàn Kiếm": ["Hàng Bạc", "Hàng Bông", "Tràng Tiền"],
    "Cầu Giấy": ["Dịch Vọng", "Mai Dịch", "Nghĩa Tân"],
    "Đống Đa": ["Cát Linh", "Láng Hạ", "Ô Chợ Dừa"],
  },
  "Đà Nẵng": {
    "Hải Châu": ["Hải Châu I", "Hải Châu II", "Thạch Thang"],
    "Thanh Khê": ["An Khê", "Chính Gián", "Vĩnh Trung"],
    "Sơn Trà": ["An Hải Bắc", "An Hải Đông", "Mân Thái"],
  },
  "Cần Thơ": {
    "Ninh Kiều": ["An Hòa", "An Khánh", "Tân An"],
    "Bình Thủy": ["An Thới", "Bình Thủy", "Long Hòa"],
    "Cái Răng": ["Ba Láng", "Hưng Phú", "Lê Bình"],
  },
  "Hải Phòng": {
    "Hồng Bàng": ["Hoàng Văn Thụ", "Minh Khai", "Phan Bội Châu"],
    "Lê Chân": ["An Biên", "Cát Dài", "Trại Cau"],
    "Ngô Quyền": ["Cầu Đất", "Đằng Giang", "Lạch Tray"],
  },
};

function CheckoutForm({ cart, subtotal, submitOrder, language }) {
  const lang = language === "vi";
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const districts = province ? Object.keys(VN_AREAS[province]) : [];
  const wards = district ? VN_AREAS[province]?.[district] || [] : [];
  const shipping = subtotal >= 1000000 ? 0 : 30000;
  return (
    <form className="checkout-layout checkout-form-layout" onSubmit={submitOrder}>
      <div className="checkout-form-column">
        <section className="checkout-panel">
          <div className="checkout-section-heading">
            <span>01</span>
            <div>
              <h2>{tx("Contact information", "Thông tin liên hệ", lang)}</h2>
              <p>
                {tx(
                  "Where can we reach you about this order?",
                  "Technest sẽ liên hệ với bạn về đơn hàng này.",
                  lang,
                )}
              </p>
            </div>
          </div>
          <div className="checkout-field-grid">
            <label className="checkout-field checkout-field-full">
              {tx("Full name", "Họ và tên", lang)}
              <input
                name="name"
                required
                autoComplete="name"
                placeholder={tx("Enter your full name", "Nhập họ và tên", lang)}
              />
            </label>
            <label className="checkout-field">
              {tx("Email", "Email", lang)}
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
              />
            </label>
            <label className="checkout-field">
              {tx("Phone number", "Số điện thoại", lang)}
              <input
                type="tel"
                name="phone"
                required
                autoComplete="tel"
                placeholder="09xx xxx xxx"
              />
            </label>
          </div>
        </section>
        <section className="checkout-panel">
          <div className="checkout-section-heading">
            <span>02</span>
            <div>
              <h2>{tx("Delivery address", "Địa chỉ giao hàng", lang)}</h2>
              <p>
                {tx(
                  "Choose your province, district and ward.",
                  "Chọn tỉnh/thành, quận/huyện và phường/xã.",
                  lang,
                )}
              </p>
            </div>
          </div>
          <div className="checkout-field-grid">
            <label className="checkout-field checkout-field-full">
              {tx("Street address", "Địa chỉ cụ thể", lang)}
              <input
                name="address"
                required
                autoComplete="street-address"
                placeholder={tx(
                  "House number, street, building…",
                  "Số nhà, tên đường, tòa nhà…",
                  lang,
                )}
              />
            </label>
            <label className="checkout-field">
              {tx("Province / city", "Tỉnh / thành phố", lang)}
              <select
                name="city"
                value={province}
                required
                onChange={(event) => {
                  setProvince(event.target.value);
                  setDistrict("");
                }}
              >
                <option value="">
                  {tx("Select province / city", "Chọn tỉnh / thành phố", lang)}
                </option>
                {Object.keys(VN_AREAS).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkout-field">
              {tx("District", "Quận / huyện", lang)}
              <select
                name="district"
                value={district}
                required
                disabled={!province}
                onChange={(event) => setDistrict(event.target.value)}
              >
                <option value="">{tx("Select district", "Chọn quận / huyện", lang)}</option>
                {districts.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkout-field checkout-field-full">
              {tx("Ward", "Phường / xã", lang)}
              <select name="ward" required disabled={!district}>
                <option value="">{tx("Select ward", "Chọn phường / xã", lang)}</option>
                {wards.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className="checkout-panel">
          <div className="checkout-section-heading">
            <span>03</span>
            <div>
              <h2>{tx("Delivery and payment", "Giao hàng và thanh toán", lang)}</h2>
              <p>
                {tx(
                  "Choose how you would like to receive and pay.",
                  "Chọn cách nhận hàng và thanh toán phù hợp.",
                  lang,
                )}
              </p>
            </div>
          </div>
          <div className="checkout-choice-grid">
            <label className="checkout-choice">
              <input
                type="radio"
                name="delivery"
                value={lang ? "Giao hàng tiêu chuẩn" : "Standard delivery"}
                defaultChecked
              />
              <span>
                <strong>{tx("Standard delivery", "Giao hàng tiêu chuẩn", lang)}</strong>
                <small>{tx("2–4 business days", "Dự kiến 2–4 ngày làm việc", lang)}</small>
              </span>
              <b>{shipping ? formatPrice(shipping) : tx("Free", "Miễn phí", lang)}</b>
            </label>
            <label className="checkout-choice">
              <input
                type="radio"
                name="payment"
                value={lang ? "Thanh toán khi nhận hàng" : "Cash on delivery"}
                defaultChecked
              />
              <span>
                <strong>{tx("Cash on delivery", "Thanh toán khi nhận hàng", lang)}</strong>
                <small>
                  {tx("Pay when your order arrives", "Thanh toán khi nhận được hàng", lang)}
                </small>
              </span>
            </label>
            <label className="checkout-choice">
              <input
                type="radio"
                name="payment"
                value={lang ? "Thanh toán trực tuyến (mô phỏng)" : "Mock online payment"}
              />
              <span>
                <strong>{tx("Online payment", "Thanh toán trực tuyến", lang)}</strong>
                <small>
                  {tx(
                    "Demo option · no payment is processed",
                    "Mô phỏng · không phát sinh giao dịch",
                    lang,
                  )}
                </small>
              </span>
            </label>
          </div>
        </section>
        <button className="primary-button checkout-submit" type="submit">
          {tx("Place order", "Đặt hàng", lang)} <ArrowRight size={17} />
        </button>
      </div>
      <aside className="checkout-summary-card">
        <div className="checkout-summary-heading">
          <div>
            <span className="section-kicker">TECHNEST</span>
            <h2>{tx("Your order", "Đơn hàng của bạn", lang)}</h2>
          </div>
          <span className="checkout-item-count">
            {cart.reduce((count, item) => count + item.quantity, 0)} {tx("items", "món", lang)}
          </span>
        </div>
        <div className="checkout-summary-items">
          {cart.map((item) => (
            <div className="checkout-summary-item" key={item.id}>
              <ProductImage src={item.image} alt="" />
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} × {formatPrice(item.price)}
                </span>
              </div>
              <b>{formatPrice(item.price * item.quantity)}</b>
            </div>
          ))}
        </div>
        <div className="checkout-summary-totals">
          <p>
            <span>{tx("Subtotal", "Tạm tính", lang)}</span>
            <strong>{formatPrice(subtotal)}</strong>
          </p>
          <p>
            <span>{tx("Shipping", "Phí giao hàng", lang)}</span>
            <strong>{shipping ? formatPrice(shipping) : tx("Free", "Miễn phí", lang)}</strong>
          </p>
          <p className="checkout-grand-total">
            <span>{tx("Total", "Tổng thanh toán", lang)}</span>
            <strong>{formatPrice(subtotal + shipping)}</strong>
          </p>
        </div>
        <p className="checkout-summary-note">
          {tx(
            "Shipping is free on orders over 1,000,000₫.",
            "Miễn phí giao hàng cho đơn từ 1.000.000₫.",
            lang,
          )}
        </p>
      </aside>
    </form>
  );
}

export default function StorePages(p) {
  const {
    route,
    navigate,
    t,
    language,
    categories,
    products,
    product,
    favorites,
    toggleFavorite,
    compareIds = [],
    toggleCompare,
    addToCart,
    visibleProducts,
    activeCategory,
    setActiveCategory,
    sortBy,
    setSortBy,
    cart,
    changeQuantity,
    removeFromCart,
    setCart,
    orders,
    setOrders,
    onAuthenticate,
  } = p;
  const [path] = route.split("?");
  const [notice, setNotice] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [brand, setBrand] = useState("all");
  const [detailImage, setDetailImage] = useState(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [setupSelection, setSetupSelection] = useState({});
  const [selectedCartIds, setSelectedCartIds] = useState(() => cart.map((item) => item.id));
  const lang = language === "vi";
  const selectedCart = cart.filter((item) => selectedCartIds.includes(item.id));
  const selectedSubtotal = selectedCart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const checkoutParams = new URLSearchParams(route.split("?")[1] || "");
  const hasRequestedItems = checkoutParams.has("items");
  const requestedIds = (checkoutParams.get("items") || "").split(",").filter(Boolean).map(Number);
  const checkoutCart =
    path === "/checkout" && hasRequestedItems
      ? cart.filter((item) => requestedIds.includes(item.id))
      : cart;
  const checkoutSubtotal = checkoutCart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const filtered = useMemo(
    () =>
      visibleProducts.filter(
        (x) =>
          (!min || x.price >= Number(min)) &&
          (!max || x.price <= Number(max)) &&
          (brand === "all" || x.brand === brand),
      ),
    [visibleProducts, min, max, brand],
  );
  const filterControls = (
    <div className="store-filters">
      <label>
        {tx("Category", "Danh mục", lang)}
        <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}>
          <option value="all">{tx("All categories", "Tất cả danh mục", lang)}</option>
          {categories.slice(1).map((c) => (
            <option key={c.id} value={c.id}>
              {c[language]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {tx("Brand", "Thương hiệu", lang)}
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="all">{tx("All brands", "Tất cả thương hiệu", lang)}</option>
          {[...new Set(products.map((x) => x.brand))].map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <label>
        {tx("Min price", "Giá thấp nhất", lang)}
        <input
          type="number"
          min="0"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="₫"
        />
      </label>
      <label>
        {tx("Max price", "Giá cao nhất", lang)}
        <input
          type="number"
          min="0"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="₫"
        />
      </label>
      <label>
        {tx("Sort", "Sắp xếp", lang)}
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="recommended">{tx("Recommended", "Đề xuất", lang)}</option>
          <option value="newest">{tx("Newest", "Mới nhất", lang)}</option>
          <option value="priceLow">{tx("Price: low to high", "Giá: thấp đến cao", lang)}</option>
          <option value="priceHigh">{tx("Price: high to low", "Giá: cao đến thấp", lang)}</option>
        </select>
      </label>
      <button
        type="button"
        className="text-link"
        onClick={() => {
          setActiveCategory("all");
          setBrand("all");
          setMin("");
          setMax("");
          setSortBy("recommended");
        }}
      >
        {tx("Clear filters", "Xóa bộ lọc", lang)}
      </button>
    </div>
  );
  const cards = (items) => (
    <div className="product-grid">
      {items.map((x) => (
        <ProductCard
          key={x.id}
          product={x}
          language={language}
          t={t}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          addToCart={addToCart}
          onViewProduct={(item) => navigate(`/products/${item.id}`)}
          compareIds={compareIds}
          toggleCompare={toggleCompare}
        />
      ))}
    </div>
  );
  const submitOrder = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const shipping = checkoutSubtotal >= 1000000 ? 0 : 30000;
    const order = {
      id: `TN-${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toISOString(),
      items: checkoutCart,
      subtotal: checkoutSubtotal,
      shipping,
      total: checkoutSubtotal + shipping,
      customer: Object.fromEntries(form.entries()),
    };
    const next = [order, ...orders];
    setOrders(next);
    localStorage.setItem("technest-orders", JSON.stringify(next));
    const orderedIds = new Set(checkoutCart.map((item) => item.id));
    setCart((current) => current.filter((item) => !orderedIds.has(item.id)));
    navigate(`/order-success/${order.id}`);
  };
  const formPage = (title, action, fields, extra, onSuccess) => (
    <section className="store-page narrow-page">
      <PageTitle title={title} />
      <form
        className="store-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (onSuccess) onSuccess(e);
          else setNotice(action);
        }}
      >
        {fields}
        {extra}
        <button className="primary-button" type="submit">
          {tx("Continue", "Tiếp tục", lang)} <ArrowRight size={16} />
        </button>
        {notice && <p className="form-success">{notice}</p>}
      </form>
    </section>
  );

  if (path === "/compare") {
    const compared = products.filter((item) => compareIds.includes(item.id));
    const rows = [
      [tx("Brand", "Thương hiệu", lang), (item) => item.brand],
      [
        tx("Category", "Danh mục", lang),
        (item) => categories.find((c) => c.id === item.category)?.[language] || item.category,
      ],
      [tx("Rating", "Đánh giá", lang), (item) => `★ ${item.rating} (${item.reviews})`],
      [
        tx("Availability", "Tồn kho", lang),
        (item) =>
          item.stock <= 5
            ? tx(`Only ${item.stock} left`, `Chỉ còn ${item.stock}`, lang)
            : tx("In stock", "Còn hàng", lang),
      ],
      [tx("Highlights", "Mô tả", lang), (item) => item.description],
    ];
    return (
      <section className="store-page">
        <PageTitle
          title={tx("Compare products", "So sánh sản phẩm", lang)}
          desc={tx(
            "Choose up to three products to compare their key details.",
            "Chọn tối đa ba sản phẩm để so sánh thông tin chính.",
            lang,
          )}
        />
        {compared.length ? (
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>{tx("Product details", "Thông tin sản phẩm", lang)}</th>
                  {compared.map((item) => (
                    <th key={item.id}>
                      <button className="compare-remove" onClick={() => toggleCompare(item.id)}>
                        {tx("Remove", "Bỏ chọn", lang)} ×
                      </button>
                      <ProductImage src={item.image} alt={item.name} />
                      <a href={`/products/${item.id}`}>{item.name}</a>
                      <strong>{formatPrice(item.price)}</strong>
                      <button className="primary-button" onClick={() => addToCart(item)}>
                        {tx("Add to cart", "Thêm vào giỏ", lang)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, getValue]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    {compared.map((item) => (
                      <td key={item.id}>{getValue(item)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={tx("Nothing to compare yet", "Chưa có sản phẩm để so sánh", lang)}
            text={tx(
              "Add products from their cards, then compare them here.",
              "Chọn biểu tượng cân trên thẻ sản phẩm rồi quay lại đây để xem bảng so sánh.",
              lang,
            )}
            go={navigate}
            lang={lang}
          />
        )}
        <button className="outline-button" onClick={() => navigate("/products")}>
          {tx("Browse products", "Xem sản phẩm", lang)} <ArrowRight size={16} />
        </button>
      </section>
    );
  }
  if (path === "/products" || path === "/search") {
    const q = new URLSearchParams(route.split("?")[1] || "").get("q") || "";
    return (
      <section className="store-page">
        <div className="store-breadcrumb">
          <a href="/">{tx("Home", "Trang chủ", lang)}</a> /{" "}
          {path === "/search"
            ? `${tx("Search", "Tìm kiếm", lang)}: “${q}”`
            : tx("Products", "Sản phẩm", lang)}
        </div>
        <PageTitle
          title={
            path === "/search"
              ? `${tx("Results for", "Kết quả tìm kiếm cho", lang)} “${q}”`
              : tx("All products", "Tất cả sản phẩm", lang)
          }
          desc={`${filtered.length} ${tx("products", "sản phẩm", lang)}`}
        />
        {filterControls}
        {filtered.length ? (
          cards(filtered)
        ) : (
          <Empty
            title={tx("No matching products", "Không tìm thấy sản phẩm phù hợp", lang)}
            text={tx(
              "Try another search or clear some filters.",
              "Hãy thử từ khóa khác hoặc xóa bớt bộ lọc.",
              lang,
            )}
            go={navigate}
            lang={lang}
          />
        )}
      </section>
    );
  }
  if (product || /^\/products\//.test(path)) {
    if (!product)
      return (
        <section className="store-page">
          <PageTitle title={tx("Product not found", "Không tìm thấy sản phẩm", lang)} />
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
        </section>
      );
    const gallery = [
      product.image,
      ...products
        .filter((x) => x.category === product.category && x.id !== product.id)
        .map((x) => x.image),
    ].slice(0, 4);
    const recommendations = products
      .filter((x) => x.id !== product.id && x.category === product.category)
      .slice(0, 4);
    const compatibleAccessories = products
      .filter(
        (item) =>
          item.category === "accessories" && item.compatibleWith?.includes(product.category),
      )
      .slice(0, 4);
    const specs = [
      [tx("Brand", "Thương hiệu", lang), product.brand],
      [
        tx("Category", "Danh mục", lang),
        categories.find((c) => c.id === product.category)?.[language] || product.category,
      ],
      [
        tx("Availability", "Tình trạng", lang),
        product.stock <= 5
          ? tx(`Only ${product.stock} left`, `Chỉ còn ${product.stock} sản phẩm`, lang)
          : tx("In stock", "Còn hàng", lang),
      ],
      [
        tx("Warranty", "Bảo hành", lang),
        tx("Official manufacturer warranty", "Bảo hành chính hãng", lang),
      ],
      [
        tx("Customer rating", "Đánh giá khách hàng", lang),
        `${product.rating} / 5 (${product.reviews})`,
      ],
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
                src={detailImage?.productId === product.id ? detailImage.src : product.image}
                alt={product.name}
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
                    (detailImage?.productId === product.id ? detailImage.src : product.image) ===
                    src
                      ? "is-selected"
                      : ""
                  }
                  key={`${src}-${i}`}
                  onClick={() => setDetailImage({ productId: product.id, src })}
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
            <p className="detail-rating">
              ★ {product.rating}{" "}
              <span>
                ({product.reviews} {tx("reviews", "đánh giá", lang)})
              </span>
            </p>
            <p className="route-price">
              {formatPrice(product.price)}{" "}
              {product.oldPrice && (
                <>
                  <del>{formatPrice(product.oldPrice)}</del>
                  <span className="detail-discount">
                    -{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
                  </span>
                </>
              )}
            </p>
            <p className="detail-lead">{product.description}</p>
            <p className="stock-note">
              {product.stock <= 5
                ? tx(
                    `Only ${product.stock} left in stock`,
                    `Sắp hết hàng · Chỉ còn ${product.stock} sản phẩm`,
                    lang,
                  )
                : `✓ ${tx("In stock · Ships nationwide", "Còn hàng · Giao hàng toàn quốc", lang)}`}
            </p>
            <div className="detail-points">
              <span>✓ {tx("Authentic products", "Sản phẩm chính hãng", lang)}</span>
              <span>✓ {tx("Official warranty", "Bảo hành đầy đủ", lang)}</span>
              <span>
                ✓{" "}
                {tx("Free shipping over 1,000,000₫", "Miễn phí giao hàng đơn từ 1.000.000₫", lang)}
              </span>
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
                  onClick={() => setDetailQuantity((q) => q + 1)}
                  aria-label={tx("Increase quantity", "Tăng số lượng", lang)}
                >
                  <Plus size={14} />
                </button>
              </div>
              <button className="primary-button" onClick={() => addToCart(product, detailQuantity)}>
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
              onClick={() => {
                addToCart(product, detailQuantity);
                navigate("/checkout");
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
            <h2>{tx("Product highlights", "Điểm nổi bật", lang)}</h2>
            <p>
              {product.description}{" "}
              {tx(
                "Thoughtfully selected for a more comfortable and productive everyday setup.",
                "Được chọn lọc để góc làm việc mỗi ngày thoải mái và hiệu quả hơn.",
                lang,
              )}
            </p>
            <ul>
              <li>
                {tx(
                  "Designed for reliable everyday use",
                  "Thiết kế cho nhu cầu sử dụng hằng ngày ổn định",
                  lang,
                )}
              </li>
              <li>
                {tx(
                  "Compatible with a wide range of devices",
                  "Tương thích với nhiều thiết bị phổ biến",
                  lang,
                )}
              </li>
              <li>
                {tx(
                  "Supported by Technest customer care",
                  "Được Technest hỗ trợ sau mua hàng",
                  lang,
                )}
              </li>
            </ul>
            <h2>{tx("Description", "Mô tả sản phẩm", lang)}</h2>
            <p>
              {product.description}{" "}
              {tx(
                "A practical addition to your desk, home or travel setup.",
                "Là lựa chọn tiện dụng cho bàn làm việc, gia đình hoặc những chuyến đi.",
                lang,
              )}
            </p>
          </section>
          <aside className="specification-panel">
            <h2>{tx("Specifications", "Thông số sản phẩm", lang)}</h2>
            {specs.map(([label, value]) => (
              <div className="specification-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </aside>
        </div>
        <section className="detail-review-panel">
          <div>
            <span className="section-kicker">TECHNEST COMMUNITY</span>
            <h2>{tx("Customer reviews", "Khách hàng đánh giá", lang)}</h2>
            <p className="review-score">
              ★ {product.rating}{" "}
              <span>
                / 5 · {product.reviews} {tx("reviews", "đánh giá", lang)}
              </span>
            </p>
          </div>
          <p>
            {tx(
              "A popular choice for everyday productivity and a cleaner setup.",
              "Lựa chọn được yêu thích để làm việc hiệu quả và giữ góc setup gọn gàng.",
              lang,
            )}
          </p>
        </section>
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
              title={tx(
                "Accessories that work well with it",
                "Phụ kiện hợp với sản phẩm này",
                lang,
              )}
              desc={tx(
                "A few thoughtful additions for your setup",
                "Gợi ý thêm phụ kiện phù hợp cho góc setup",
                lang,
              )}
            />
            {cards(compatibleAccessories)}
          </section>
        )}
      </section>
    );
  }
  if (path === "/favorites")
    return (
      <section className="store-page">
        <PageTitle
          title={tx("Your favorites", "Sản phẩm yêu thích", lang)}
          desc={`${favorites.length} ${tx("saved products", "sản phẩm đã lưu", lang)}`}
        />
        {favorites.length ? (
          cards(products.filter((x) => favorites.includes(x.id)))
        ) : (
          <Empty
            title={tx("Nothing saved yet", "Chưa có sản phẩm yêu thích", lang)}
            text={tx(
              "Save products to find them here later.",
              "Lưu sản phẩm yêu thích để xem lại tại đây.",
              lang,
            )}
            go={navigate}
            lang={lang}
          />
        )}
      </section>
    );
  if (path === "/setup") {
    const setupCategories = ["monitors", "keyboards", "mice", "audio", "accessories"];
    const chosenSetup = setupCategories
      .map((category) => products.find((item) => item.id === Number(setupSelection[category])))
      .filter(Boolean);
    const setupTotal = chosenSetup.reduce((total, item) => total + item.price, 0);
    return (
      <section className="store-page setup-builder-page">
        <PageTitle
          eyebrow="TECHNEST SETUP STUDIO"
          title={tx("Build your setup", "Tạo bộ setup của bạn", lang)}
          desc={tx(
            "Pick the tools you need and see your setup come together.",
            "Chọn thiết bị bạn cần và xem tổng chi phí cho góc setup.",
            lang,
          )}
        />
        <section
          className="setup-preview-panel"
          aria-label={tx("Live setup preview", "Xem trước bộ setup", lang)}
        >
          <div className="setup-preview-heading">
            <div>
              <span className="section-kicker">{tx("LIVE PREVIEW", "XEM TRỰC TIẾP", lang)}</span>
              <h2>{tx("Your desk, your setup", "Góc bàn làm việc của bạn", lang)}</h2>
            </div>
            <span>
              {tx(
                "The preview updates as you choose products",
                "Hình minh họa thay đổi theo sản phẩm bạn chọn",
                lang,
              )}
            </span>
          </div>
          <div className="setup-scene-stage">
            <img
              className="setup-scene-image"
              src="/images/technest-setup-scene.svg"
              alt=""
              aria-hidden="true"
            />
            {chosenSetup.length ? (
              chosenSetup.map((item) => (
                <button
                  type="button"
                  className={`setup-scene-hotspot scene-hotspot-${item.category}`}
                  key={item.id}
                  onClick={() => navigate(`/products/${item.id}`)}
                  aria-label={tx(
                    `${item.name}, ${formatPrice(item.price)}. Open product details.`,
                    `${item.name}, ${formatPrice(item.price)}. Mở chi tiết sản phẩm.`,
                    lang,
                  )}
                >
                  <span className="setup-scene-tooltip">
                    <strong>{item.name}</strong>
                    <b>{formatPrice(item.price)}</b>
                    <small>{item.description}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className="setup-scene-empty">
                {tx(
                  "Select a product to highlight its place in your setup.",
                  "Chọn sản phẩm để làm sáng vị trí của món đồ trên bàn.",
                  lang,
                )}
              </div>
            )}
          </div>
          <p className="setup-preview-caption">
            {tx(
              "Hover over a highlighted item to see its details. Click to open the product page.",
              "Rê chuột lên món đang sáng để xem thông tin. Nhấn để mở trang chi tiết sản phẩm.",
              lang,
            )}
          </p>
        </section>
        <div className="setup-builder-grid">
          <div className="setup-choices">
            {setupCategories.map((category) => {
              const options = products.filter((item) => item.category === category);
              const selected = options.find((item) => item.id === Number(setupSelection[category]));
              return (
                <label className="setup-choice-card" key={category}>
                  <span className="section-kicker">
                    {categories.find((item) => item.id === category)?.[language] || category}
                  </span>
                  <select
                    value={selected?.id || ""}
                    onChange={(event) =>
                      setSetupSelection((current) => ({
                        ...current,
                        [category]: event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {tx("Skip this category", "Bỏ qua danh mục này", lang)}
                    </option>
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {formatPrice(item.price)}
                      </option>
                    ))}
                  </select>
                  {selected && (
                    <div className="setup-choice-product">
                      <ProductImage src={selected.image} alt="" />
                      <span>{selected.name}</span>
                      <strong>{formatPrice(selected.price)}</strong>
                    </div>
                  )}
                </label>
              );
            })}
          </div>
          <aside className="setup-summary-card">
            <h2>{tx("Your setup", "Bộ setup của bạn", lang)}</h2>
            {chosenSetup.length ? (
              chosenSetup.map((item) => (
                <p key={item.id}>
                  <span>{item.name}</span>
                  <strong>{formatPrice(item.price)}</strong>
                </p>
              ))
            ) : (
              <p>
                {tx(
                  "Choose a few products to get started.",
                  "Hãy chọn sản phẩm để bắt đầu ghép bộ.",
                  lang,
                )}
              </p>
            )}
            <p className="setup-total">
              <span>{tx("Estimated total", "Tổng dự kiến", lang)}</span>
              <strong>{formatPrice(setupTotal)}</strong>
            </p>
            <button
              className="primary-button"
              disabled={!chosenSetup.length}
              onClick={() => {
                chosenSetup.forEach((item) => addToCart(item));
                navigate("/cart");
              }}
            >
              {tx("Add setup to cart", "Thêm bộ setup vào giỏ", lang)} <ArrowRight size={16} />
            </button>
          </aside>
        </div>
      </section>
    );
  }
  if (path === "/cart") {
    const allSelected = cart.length > 0 && cart.every((item) => selectedCartIds.includes(item.id));
    const shipping = selectedSubtotal >= 1000000 ? 0 : 30000;
    const removeSelected = () => {
      const ids = new Set(selectedCart.map((item) => item.id));
      setCart((current) => current.filter((item) => !ids.has(item.id)));
      setSelectedCartIds((current) => current.filter((id) => !ids.has(id)));
    };
    return (
      <section className="store-page">
        <PageTitle
          title={tx("Shopping cart", "Giỏ hàng", lang)}
          desc={`${cart.reduce((n, x) => n + x.quantity, 0)} ${tx("items", "sản phẩm", lang)}`}
        />
        {cart.length ? (
          <div className="cart-page-layout">
            <div className="cart-page-items">
              <div className="cart-selection-toolbar">
                <label>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelectedCartIds(event.target.checked ? cart.map((item) => item.id) : [])
                    }
                  />
                  <span>
                    {tx("Select all", "Chọn tất cả", lang)} ({selectedCart.length}/{cart.length})
                  </span>
                </label>
                <button type="button" onClick={removeSelected} disabled={!selectedCart.length}>
                  <Trash2 size={15} />
                  {tx("Remove selected", "Xóa đã chọn", lang)}
                </button>
              </div>
              {cart.map((item) => (
                <article
                  className={`cart-page-item ${selectedCartIds.includes(item.id) ? "is-selected" : ""}`}
                  key={item.id}
                >
                  <label
                    className="cart-item-check"
                    aria-label={tx(`Select ${item.name}`, `Chọn ${item.name}`, lang)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCartIds.includes(item.id)}
                      onChange={(event) =>
                        setSelectedCartIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </label>
                  <ProductImage src={item.image} alt={item.name} />
                  <div className="cart-page-info">
                    <span className="product-brand">{item.brand}</span>
                    <h3>{item.name}</h3>
                    <strong>{formatPrice(item.price)}</strong>
                    <div className="quantity-control">
                      <button
                        onClick={() => changeQuantity(item.id, -1)}
                        aria-label={tx("Decrease quantity", "Giảm số lượng", lang)}
                      >
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => changeQuantity(item.id, 1)}
                        aria-label={tx("Increase quantity", "Tăng số lượng", lang)}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        className="cart-remove"
                        onClick={() => {
                          removeFromCart(item.id);
                          setSelectedCartIds((current) => current.filter((id) => id !== item.id));
                        }}
                        aria-label={tx("Remove item", "Xóa sản phẩm", lang)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <aside className="order-summary">
              <h2>{tx("Order summary", "Tóm tắt đơn hàng", lang)}</h2>
              <ShippingProgress subtotal={selectedSubtotal} language={language} />
              <p>
                <span>{tx("Selected items", "Sản phẩm đã chọn", lang)}</span>
                <strong>{selectedCart.reduce((n, item) => n + item.quantity, 0)}</strong>
              </p>
              <p>
                <span>{tx("Subtotal", "Tạm tính", lang)}</span>
                <strong>{formatPrice(selectedSubtotal)}</strong>
              </p>
              <p>
                <span>{tx("Shipping", "Phí vận chuyển", lang)}</span>
                <strong>{shipping ? formatPrice(shipping) : tx("Free", "Miễn phí", lang)}</strong>
              </p>
              <p className="summary-total">
                <span>{tx("Total", "Tổng cộng", lang)}</span>
                <strong>{formatPrice(selectedSubtotal + shipping)}</strong>
              </p>
              <button
                className="primary-button"
                disabled={!selectedCart.length}
                onClick={() =>
                  navigate(`/checkout?items=${selectedCart.map((item) => item.id).join(",")}`)
                }
              >
                {tx("Checkout selected", "Thanh toán mục đã chọn", lang)} <ArrowRight size={16} />
              </button>
              <a className="text-link" href="/products">
                {tx("Continue shopping", "Tiếp tục mua sắm", lang)}
              </a>
            </aside>
          </div>
        ) : (
          <Empty
            title={tx("Your cart is empty", "Giỏ hàng đang trống", lang)}
            text={tx(
              "Find something useful for your setup.",
              "Khám phá sản phẩm phù hợp cho góc làm việc của bạn.",
              lang,
            )}
            go={navigate}
            lang={lang}
          />
        )}
        <section className="cart-recommendations">
          <PageTitle
            title={tx("Popular right now", "Sản phẩm được yêu thích", lang)}
            desc={tx(
              "A few ideas to complete your setup",
              "Một vài gợi ý để hoàn thiện góc setup",
              lang,
            )}
          />
          {cards(
            products
              .filter((item) => !cart.some((cartItem) => cartItem.id === item.id))
              .slice(0, 4),
          )}
        </section>
      </section>
    );
  }
  if (path === "/checkout")
    return (
      <section className="store-page checkout-page">
        <div className="checkout-topline">
          <a className="checkout-back-link" href="/cart">
            {tx("Back to cart", "Quay lại giỏ hàng", lang)}
          </a>
          <span>
            01&nbsp; {tx("Information", "Thông tin", lang)} <i /> 02&nbsp;{" "}
            {tx("Delivery", "Giao hàng", lang)} <i /> 03&nbsp;{" "}
            {tx("Confirmation", "Xác nhận", lang)}
          </span>
        </div>
        <PageTitle
          title={tx("Checkout", "Thanh toán", lang)}
          desc={tx(
            "Just a few details and your order will be on its way.",
            "Hoàn tất thông tin để Technest chuẩn bị đơn hàng cho bạn.",
            lang,
          )}
        />
        {checkoutCart.length ? (
          <CheckoutForm
            cart={checkoutCart}
            subtotal={checkoutSubtotal}
            submitOrder={submitOrder}
            language={language}
          />
        ) : (
          <Empty
            title={tx("No items selected", "Chưa chọn sản phẩm", lang)}
            text={tx(
              "Return to your cart and choose the items you want to order.",
              "Quay lại giỏ hàng và chọn sản phẩm bạn muốn đặt.",
              lang,
            )}
            go={navigate}
            lang={lang}
          />
        )}
        <section className="cart-recommendations">
          <PageTitle
            title={tx("Complete your setup", "Hoàn thiện góc setup", lang)}
            desc={tx(
              "Explore more picks from Technest",
              "Khám phá thêm sản phẩm từ Technest",
              lang,
            )}
          />
          {cards(
            products
              .filter((item) => !cart.some((cartItem) => cartItem.id === item.id))
              .slice(0, 4),
          )}
        </section>
      </section>
    );
  if (path.startsWith("/order-success/")) {
    const order = orders.find((o) => o.id === path.split("/").pop());
    return (
      <section className="store-page narrow-page success-page">
        <CheckCircle2 size={52} />
        <PageTitle
          title={
            order
              ? tx("Order confirmed", "Đặt hàng thành công", lang)
              : tx("Order details unavailable", "Không tìm thấy thông tin đơn hàng", lang)
          }
          desc={
            order
              ? `${tx("Order", "Đơn hàng", lang)} ${order.id} ${tx("has been placed successfully.", "đã được ghi nhận.", lang)}`
              : tx(
                  "We couldn't find this order in this browser.",
                  "Không tìm thấy đơn hàng này trên trình duyệt hiện tại.",
                  lang,
                )
          }
        />
        {order && (
          <div className="order-summary">
            {order.items.map((x) => (
              <p key={x.id}>
                <span>
                  {x.name} × {x.quantity}
                </span>
                <strong>{formatPrice(x.price * x.quantity)}</strong>
              </p>
            ))}
            <p>
              <span>{tx("Shipping to", "Giao đến", lang)}</span>
              <strong>
                {order.customer.name}, {order.customer.address}, {order.customer.city}
              </strong>
            </p>
            <p className="summary-total">
              <span>{tx("Total", "Tổng cộng", lang)}</span>
              <strong>{formatPrice(order.total)}</strong>
            </p>
          </div>
        )}
        <button className="primary-button" onClick={() => navigate("/products")}>
          {tx("Continue shopping", "Tiếp tục mua sắm", lang)} <ArrowRight size={16} />
        </button>
      </section>
    );
  }
  if (["/login", "/register", "/forgot-password"].includes(path))
    return (
      <section className="store-page narrow-page">
        {path === "/login"
          ? formPage(
              tx("Welcome back", "Chào mừng bạn trở lại", lang),
              tx(
                "Demo sign-in complete. No account credentials were stored.",
                "Đăng nhập mô phỏng hoàn tất. Thông tin tài khoản không được lưu.",
                lang,
              ),
              <>
                <label>
                  {tx("Email", "Email", lang)}
                  <input type="email" required autoComplete="email" />
                </label>
                <label>
                  {tx("Password", "Mật khẩu", lang)}
                  <input type="password" minLength="8" required autoComplete="current-password" />
                </label>
              </>,
              <p className="form-links">
                <a href="/forgot-password">{tx("Forgot password?", "Quên mật khẩu?", lang)}</a> ·{" "}
                <a href="/register">{tx("Create an account", "Tạo tài khoản", lang)}</a>
              </p>,
              () => {
                onAuthenticate();
                const next = new URLSearchParams(route.split("?")[1] || "").get("next");
                navigate(next || "/account", true);
              },
            )
          : path === "/register"
            ? formPage(
                tx("Create an account", "Tạo tài khoản", lang),
                tx(
                  "Demo profile ready. Authentication requires a backend.",
                  "Hồ sơ mô phỏng đã sẵn sàng. Cần có backend để xác thực tài khoản.",
                  lang,
                ),
                <>
                  <label>
                    {tx("Name", "Họ tên", lang)}
                    <input required autoComplete="name" />
                  </label>
                  <label>
                    {tx("Email", "Email", lang)}
                    <input type="email" required autoComplete="email" />
                  </label>
                  <label>
                    {tx("Password", "Mật khẩu", lang)}
                    <input type="password" minLength="8" required autoComplete="new-password" />
                  </label>
                  <label>
                    {tx("Confirm password", "Xác nhận mật khẩu", lang)}
                    <input type="password" minLength="8" required autoComplete="new-password" />
                  </label>
                </>,
                <p className="form-links">
                  <a href="/login">
                    {tx("Already have an account? Sign in", "Đã có tài khoản? Đăng nhập", lang)}
                  </a>
                </p>,
                (event) => {
                  const passwords = event.currentTarget.querySelectorAll('input[type="password"]');
                  if (passwords.length > 1 && passwords[0].value !== passwords[1].value) {
                    setNotice(tx("Passwords do not match.", "Mật khẩu xác nhận chưa khớp.", lang));
                    return;
                  }
                  onAuthenticate();
                  const next = new URLSearchParams(route.split("?")[1] || "").get("next");
                  navigate(next || "/account", true);
                },
              )
            : formPage(
                tx("Reset your password", "Đặt lại mật khẩu", lang),
                tx(
                  "If this were connected to an account service, reset instructions would be sent.",
                  "Nếu được kết nối với dịch vụ tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi đến bạn.",
                  lang,
                ),
                <label>
                  {tx("Email", "Email", lang)}
                  <input type="email" required autoComplete="email" />
                </label>,
                <p className="form-links">
                  <a href="/login">{tx("Back to sign in", "Quay lại đăng nhập", lang)}</a>
                </p>,
              )}
      </section>
    );
  if (path.startsWith("/account")) {
    const subsection = path.split("/")[2] || "";
    const profile = safeRead("technest-profile", {
      name: lang ? "Khách hàng Technest" : "Technest Customer",
      email: "hello@example.com",
    });
    return (
      <section className="store-page">
        <PageTitle
          title={tx("My account", "Tài khoản của tôi", lang)}
          desc={tx(
            "Manage your profile, addresses and orders",
            "Quản lý hồ sơ, địa chỉ và đơn hàng",
            lang,
          )}
        />
        <div className="account-layout">
          <nav className="account-nav">
            <a href="/account">{tx("Overview", "Tổng quan", lang)}</a>
            <a href="/account/orders">{tx("Orders", "Đơn hàng", lang)}</a>
            <a href="/account/profile">{tx("Profile", "Hồ sơ", lang)}</a>
            <a href="/account/addresses">{tx("Addresses", "Địa chỉ", lang)}</a>
          </nav>
          <div className="account-panel">
            {subsection === "orders" ? (
              <>
                <h2>{tx("Order history", "Lịch sử đơn hàng", lang)}</h2>
                {orders.length ? (
                  orders.map((o) => (
                    <article className="order-row" key={o.id}>
                      <strong>{o.id}</strong>
                      <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                      <span className="status-pill">{tx("Confirmed", "Đã xác nhận", lang)}</span>
                      <strong>{formatPrice(o.total)}</strong>
                    </article>
                  ))
                ) : (
                  <p>
                    {tx(
                      "No orders yet. Your orders will appear here.",
                      "Bạn chưa có đơn hàng nào.",
                      lang,
                    )}
                  </p>
                )}
              </>
            ) : subsection === "profile" ? (
              <form
                className="store-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = Object.fromEntries(new FormData(e.currentTarget));
                  localStorage.setItem("technest-profile", JSON.stringify(data));
                  setNotice(
                    tx("Profile saved on this device.", "Đã lưu hồ sơ trên thiết bị này.", lang),
                  );
                }}
              >
                <h2>{tx("Profile information", "Thông tin cá nhân", lang)}</h2>
                <label>
                  {tx("Name", "Họ tên", lang)}
                  <input name="name" defaultValue={profile.name} />
                </label>
                <label>
                  {tx("Email", "Email", lang)}
                  <input type="email" name="email" defaultValue={profile.email} />
                </label>
                <label>
                  {tx("Phone", "Số điện thoại", lang)}
                  <input name="phone" defaultValue={profile.phone || ""} />
                </label>
                <button className="primary-button">{tx("Save profile", "Lưu hồ sơ", lang)}</button>
                {notice && <p>{notice}</p>}
              </form>
            ) : subsection === "addresses" ? (
              <form
                className="store-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const saved = [
                    ...safeRead("technest-addresses", []),
                    Object.fromEntries(new FormData(e.currentTarget)),
                  ];
                  localStorage.setItem("technest-addresses", JSON.stringify(saved));
                  setNotice(
                    tx("Address saved on this device.", "Đã lưu địa chỉ trên thiết bị này.", lang),
                  );
                  e.currentTarget.reset();
                }}
              >
                <h2>{tx("Addresses", "Địa chỉ", lang)}</h2>
                {safeRead("technest-addresses", []).map((a, i) => (
                  <p className="address-row" key={i}>
                    {a.name} · {a.address}, {a.city}
                  </p>
                ))}
                <label>
                  {tx("Recipient", "Người nhận", lang)}
                  <input name="name" required />
                </label>
                <label>
                  {tx("Street address", "Địa chỉ đường phố", lang)}
                  <input name="address" required />
                </label>
                <label>
                  {tx("City / province", "Tỉnh / thành phố", lang)}
                  <input name="city" required />
                </label>
                <button className="primary-button">
                  {tx("Add address", "Thêm địa chỉ", lang)}
                </button>
                {notice && <p>{notice}</p>}
              </form>
            ) : (
              <>
                <h2>
                  {tx("Hello", "Xin chào", lang)}, {profile.name}
                </h2>
                <p>
                  {tx(
                    "Review recent orders and keep your contact details up to date.",
                    "Xem đơn hàng gần đây và cập nhật thông tin liên hệ của bạn.",
                    lang,
                  )}
                </p>
                <a className="text-link" href="/account/orders">
                  {tx("View orders", "Xem đơn hàng", lang)} <ArrowRight size={15} />
                </a>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="store-page narrow-page">
      <PageTitle
        title={tx("Page not found", "Không tìm thấy trang", lang)}
        desc={tx(
          "The page you’re looking for isn’t here.",
          "Trang bạn đang tìm không tồn tại.",
          lang,
        )}
      />
      <button className="primary-button" onClick={() => navigate("/")}>
        {tx("Back to home", "Về trang chủ", lang)} <ArrowLeft size={16} />
      </button>
    </section>
  );
}
