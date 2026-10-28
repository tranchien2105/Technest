import { useEffect, useMemo, useState } from "react";
import {
  Search, Heart, UserRound, ShoppingCart, Menu, X, ArrowRight,
  ChevronDown, Check, Plus, Minus, Trash2, Truck, ShieldCheck,
  Headphones, CreditCard, Keyboard, Mouse, Laptop, Package,
  SlidersHorizontal, Sparkles, RotateCcw
} from "lucide-react";
import "./index.css";

const products = [
  {
    id: 1,
    name: "Keychron K2 Pro",
    brand: "KEYCHRON",
    category: "keyboards",
    price: 2490000,
    oldPrice: 2890000,
    rating: 4.9,
    reviews: "1.2k",
    badge: "bestseller",
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=900&q=90",
    description: "Bàn phím cơ không dây, thiết kế gọn cho góc làm việc hiện đại."
  },
  {
    id: 2,
    name: "Logitech MX Master 3S",
    brand: "LOGITECH",
    category: "mice",
    price: 2390000,
    oldPrice: 2890000,
    rating: 4.8,
    reviews: "980",
    badge: "sale",
    image: "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=90",
    description: "Chuột không dây chính xác, thoải mái cho những ngày làm việc dài."
  },
  {
    id: 3,
    name: "Sony WH-1000XM5",
    brand: "SONY",
    category: "audio",
    price: 6990000,
    oldPrice: 7990000,
    rating: 4.9,
    reviews: "856",
    badge: "popular",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=90",
    description: "Âm thanh chi tiết cùng trải nghiệm nghe nhạc đắm chìm."
  },
  {
    id: 4,
    name: "USB-C Multiport Hub",
    brand: "TECHNEST SELECT",
    category: "accessories",
    price: 890000,
    oldPrice: null,
    rating: 4.7,
    reviews: "640",
    badge: "hot",
    image: "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=900&q=90",
    description: "Mở rộng kết nối cho laptop với thiết kế nhỏ gọn, tiện dụng."
  },
  {
    id: 5,
    name: "Mechanical Keyboard 75%",
    brand: "KEYCHRON",
    category: "keyboards",
    price: 1890000,
    oldPrice: null,
    rating: 4.8,
    reviews: "412",
    badge: "new",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=90",
    description: "Bố cục 75% tiết kiệm diện tích nhưng vẫn đủ phím cần thiết."
  },
  {
    id: 6,
    name: "Wireless Precision Mouse",
    brand: "LOGITECH",
    category: "mice",
    price: 1290000,
    oldPrice: null,
    rating: 4.7,
    reviews: "530",
    badge: "popular",
    image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=900&q=90",
    description: "Chuột không dây tối giản, phù hợp cho công việc và học tập."
  },
  {
    id: 7,
    name: "Everyday Wireless Headphones",
    brand: "AUDIO",
    category: "audio",
    price: 1590000,
    oldPrice: null,
    rating: 4.6,
    reviews: "328",
    badge: "new",
    image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=90",
    description: "Tai nghe nhẹ, êm và dễ phối với góc setup của bạn."
  },
  {
    id: 8,
    name: "Aluminium Laptop Stand",
    brand: "TECHNEST SELECT",
    category: "accessories",
    price: 590000,
    oldPrice: null,
    rating: 4.8,
    reviews: "274",
    badge: "hot",
    image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=900&q=90",
    description: "Nâng màn hình lên tầm mắt để góc làm việc gọn gàng hơn."
  }
];

const heroSlides = [
  {
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=90",
    alt: { vi: "Góc làm việc hiện đại với màn hình và phụ kiện công nghệ", en: "Modern workspace with a monitor and tech accessories" },
    tag: { vi: "SẢN PHẨM CHÍNH HÃNG · TUYỂN CHỌN MỖI NGÀY", en: "AUTHENTIC TECH · CURATED EVERY DAY" },
    title: { vi: "Nâng cấp nơi làm việc của bạn.", en: "Upgrade your workspace." },
    desc: { vi: "Bàn phím, chuột, tai nghe và phụ kiện công nghệ được chọn lọc cho hiệu suất cao hơn mỗi ngày.", en: "Thoughtfully selected keyboards, mice, headphones and accessories for better everyday productivity." }
  },
  {
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1600&q=90",
    alt: { vi: "Bàn phím cơ trong góc setup tông màu ấm", en: "Mechanical keyboard in a warm-toned workspace" },
    tag: { vi: "GÕ ÊM HƠN · LÀM VIỆC CẢM HỨNG HƠN", en: "BETTER TYPING · BETTER FLOW" },
    title: { vi: "Tìm chiếc bàn phím hợp gu.", en: "Find your perfect keyboard." },
    desc: { vi: "Từ bàn phím cơ nhỏ gọn đến góc setup tối giản, chọn công cụ đúng với cách bạn làm việc.", en: "From compact mechanical keyboards to minimalist setups, find the right tools for your workflow." }
  },
  {
    image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1600&q=90",
    alt: { vi: "Tai nghe chụp tai cho làm việc và giải trí", en: "Over-ear headphones for work and entertainment" },
    tag: { vi: "TẬP TRUNG VÀO ĐIỀU QUAN TRỌNG", en: "FOCUS ON WHAT MATTERS" },
    title: { vi: "Âm thanh tốt, ngày làm việc tốt.", en: "Great sound, better days." },
    desc: { vi: "Khám phá tai nghe và phụ kiện âm thanh cho những giờ tập trung, thư giãn và giải trí.", en: "Explore audio gear for focused work, downtime and everyday entertainment." }
  }
];

const categories = [
  { id: "all", icon: Package, vi: "Tất cả", en: "All products" },
  { id: "keyboards", icon: Keyboard, vi: "Bàn phím", en: "Keyboards" },
  { id: "mice", icon: Mouse, vi: "Chuột", en: "Mice" },
  { id: "audio", icon: Headphones, vi: "Tai nghe", en: "Audio" },
  { id: "accessories", icon: Laptop, vi: "Phụ kiện", en: "Accessories" }
];

const content = {
  vi: {
    shipping: "Miễn phí vận chuyển cho đơn từ 1.000.000₫",
    search: "Tìm sản phẩm, thương hiệu, danh mục...",
    home: "Trang chủ", keyboards: "Bàn phím", mice: "Chuột", audio: "Tai nghe",
    accessories: "Phụ kiện", laptops: "Laptop & PC", combos: "Combo", sale: "Khuyến mãi",
    heroTag: "SẢN PHẨM CHÍNH HÃNG · TUYỂN CHỌN MỖI NGÀY",
    heroTitle: "Góc setup xinh, làm việc thích hơn.",
    heroDesc: "Bàn phím, chuột, tai nghe và phụ kiện công nghệ được chọn lọc cho hiệu suất cao hơn mỗi ngày.",
    explore: "Khám phá sản phẩm", bestSeller: "Bàn phím cơ · Best Seller", bestDesc: "Hiệu năng cao • Góc cực đã",
    audioTitle: "Tai nghe không dây", audioDesc: "Làm việc • Giải trí • Đa thiết bị", shopNow: "Xem ngay",
    featured: "Sản phẩm nổi bật", featuredDesc: "Những món đồ được yêu thích nhất tại Technest",
    trending: "Được săn đón nhiều nhất", trendingDesc: "Những lựa chọn đang được cộng đồng setup yêu thích.",
    dealTitle: "Deal công nghệ đáng chú ý", dealDesc: "Nâng cấp góc làm việc với mức giá tốt hơn trong hôm nay.",
    newArrivals: "Vừa cập bến Technest", newArrivalsDesc: "Những món đồ mới cho góc setup tiếp theo của bạn.",
    shopByMood: "Chọn theo phong cách của bạn", shopByMoodDesc: "Bắt đầu từ cảm hứng, rồi tìm đúng món đồ phù hợp.",
    setupWork: "Góc làm việc tối giản", setupGaming: "Góc gaming nổi bật", setupAudio: "Không gian âm thanh",
    trustedBrands: "Thương hiệu được yêu thích",
    viewAll: "Xem tất cả", products: "sản phẩm", sort: "Sắp xếp", recommended: "Đề xuất",
    priceLow: "Giá thấp đến cao", priceHigh: "Giá cao đến thấp", newest: "Mới nhất",
    addCart: "Thêm vào giỏ", added: "Đã thêm", all: "Tất cả sản phẩm", noResults: "Không tìm thấy sản phẩm phù hợp.",
    why: "Mua sắm công nghệ, nhẹ nhàng hơn", whyDesc: "Tập trung vào những món đồ hữu ích cho công việc và cuộc sống hằng ngày.",
    delivery: "Giao hàng toàn quốc", deliveryDesc: "Nhanh chóng & an toàn", authentic: "Sản phẩm chính hãng", authenticDesc: "Bảo hành đầy đủ",
    support: "Hỗ trợ khách hàng", supportDesc: "Tư vấn tận tâm", payment: "Thanh toán linh hoạt", paymentDesc: "Nhiều phương thức tiện lợi",
    promotionTag: "YOUR DESK, YOUR RULES", promotionTitle: "Một góc làm việc tốt bắt đầu từ công cụ phù hợp.",
    promotionDesc: "Khám phá những phụ kiện giúp không gian của bạn gọn gàng và hiệu quả hơn.",
    exploreMore: "Khám phá ngay", favorites: "Yêu thích", account: "Tài khoản", cart: "Giỏ hàng",
    cartEmpty: "Giỏ hàng đang trống", cartEmptyDesc: "Thêm vài món đồ bạn thích để bắt đầu nhé.",
    subtotal: "Tạm tính", checkout: "Tiến hành thanh toán", continue: "Tiếp tục mua sắm",
    remove: "Xóa", quantity: "Số lượng", close: "Đóng", wishlistEmpty: "Bạn chưa có sản phẩm yêu thích.",
    footerDesc: "Phụ kiện công nghệ cho những ngày làm việc tốt hơn.", customerCare: "Chăm sóc khách hàng",
    guide: "Hướng dẫn mua hàng", shippingPolicy: "Chính sách giao hàng", returns: "Đổi trả & bảo hành",
    about: "Về Technest", contact: "Liên hệ", newsletter: "Nhận tin mới từ Technest",
    newsletterDesc: "Sản phẩm mới, ưu đãi hay ho — gửi đến bạn vừa đủ.", email: "Email của bạn", subscribe: "Đăng ký",
    copyright: "ĐƯỢC THIẾT KẾ CHO CUỘC SỐNG MỖI NGÀY", filter: "Đặt lại bộ lọc", rating: "đánh giá"
  },
  en: {
    shipping: "Free shipping on orders over 1,000,000₫",
    search: "Search products, brands, categories...",
    home: "Home", keyboards: "Keyboards", mice: "Mice", audio: "Audio",
    accessories: "Accessories", laptops: "Laptop & PC", combos: "Bundles", sale: "Offers",
    heroTag: "AUTHENTIC TECH · CURATED EVERY DAY",
    heroTitle: "A better setup. A better workday.",
    heroDesc: "Thoughtfully selected keyboards, mice, headphones and tech accessories for everyday productivity.",
    explore: "Explore products", bestSeller: "Mechanical keyboards · Best seller", bestDesc: "Better performance • Better feel",
    audioTitle: "Wireless headphones", audioDesc: "Work • Play • Stay connected", shopNow: "Shop now",
    featured: "Featured products", featuredDesc: "Everyday essentials loved by the Technest community",
    trending: "Trending favorites", trendingDesc: "Popular picks loved by the setup community.",
    dealTitle: "Tech deals worth a look", dealDesc: "Upgrade your workspace with better prices today.",
    newArrivals: "Just landed at Technest", newArrivalsDesc: "Fresh finds for your next setup upgrade.",
    shopByMood: "Shop by your style", shopByMoodDesc: "Start with inspiration, then find your perfect gear.",
    setupWork: "Minimal workspace", setupGaming: "Bold gaming setup", setupAudio: "Audio corner",
    trustedBrands: "Brands people love",
    viewAll: "View all", products: "products", sort: "Sort by", recommended: "Recommended",
    priceLow: "Price: low to high", priceHigh: "Price: high to low", newest: "Newest",
    addCart: "Add to cart", added: "Added", all: "All products", noResults: "No matching products found.",
    why: "A more thoughtful way to shop tech", whyDesc: "Useful tools for better workdays and everyday life.",
    delivery: "Nationwide delivery", deliveryDesc: "Fast and secure", authentic: "Authentic products", authenticDesc: "Warranty included",
    support: "Customer support", supportDesc: "Here to help", payment: "Flexible payment", paymentDesc: "Convenient options",
    promotionTag: "YOUR DESK, YOUR RULES", promotionTitle: "A better workspace starts with the right tools.",
    promotionDesc: "Discover accessories that make your setup more organized and productive.",
    exploreMore: "Explore now", favorites: "Wishlist", account: "Account", cart: "Cart",
    cartEmpty: "Your cart is empty", cartEmptyDesc: "Add a few things you love to get started.",
    subtotal: "Subtotal", checkout: "Proceed to checkout", continue: "Continue shopping",
    remove: "Remove", quantity: "Quantity", close: "Close", wishlistEmpty: "You haven't saved any favorites yet.",
    footerDesc: "Tech accessories for brighter workdays.", customerCare: "Customer care",
    guide: "Shopping guide", shippingPolicy: "Shipping policy", returns: "Returns & warranty",
    about: "About Technest", contact: "Contact", newsletter: "Get the latest from Technest",
    newsletterDesc: "Fresh products and thoughtful offers, delivered occasionally.", email: "Your email address", subscribe: "Subscribe",
    copyright: "DESIGNED FOR EVERYDAY LIFE", filter: "Reset filters", rating: "reviews"
  }
};

const formatPrice = (value) => new Intl.NumberFormat("vi-VN", {
  style: "currency", currency: "VND", maximumFractionDigits: 0
}).format(value);

function LanguageSwitch({ language, setLanguage }) {
  return (
    <div className="language-switch" aria-label="Language">
      <button className={language === "vi" ? "active" : ""} onClick={() => setLanguage("vi")} aria-pressed={language === "vi"}>VI</button>
      <span>/</span>
      <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button>
    </div>
  );
}


function MiniProductCard({ product, language, addToCart, favorites, toggleFavorite }) {
  const price = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(product.price);

  return (
    <article className="mini-product-card">
      <div className="mini-product-image">
        <img src={product.image} alt={product.name} loading="lazy" />
        <button
          className={`favorite-button ${favorites.includes(product.id) ? "is-favorite" : ""}`}
          onClick={() => toggleFavorite(product.id)}
          aria-label={favorites.includes(product.id) ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart size={17} fill={favorites.includes(product.id) ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="mini-product-info">
        <span className="product-brand">{product.brand}</span>
        <h3>{product.name}</h3>
        <div className="mini-product-bottom">
          <strong>{price}</strong>
          <button onClick={() => addToCart(product)} aria-label={language === "vi" ? "Thêm vào giỏ" : "Add to cart"}>
            <Plus size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

function App() {
  const [language, setLanguage] = useState("vi");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");
  const [favorites, setFavorites] = useState([]);
  const [cart, setCart] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState("");
  const t = content[language];
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleProducts = useMemo(() => {
    let list = products.filter((product) => {
      const matchesCategory = activeCategory === "all" || product.category === activeCategory;
      const query = search.trim().toLowerCase();
      const categoryLabel = categories.find((item) => item.id === product.category)?.[language] || "";
      const searchable = `${product.name} ${product.brand} ${product.category} ${categoryLabel}`.toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
    if (sortBy === "priceLow") list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "priceHigh") list = [...list].sort((a, b) => b.price - a.price);
    if (sortBy === "newest") list = [...list].reverse();
    return list;
  }, [activeCategory, search, sortBy, language]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const favoriteProducts = products.filter((product) => favorites.includes(product.id));

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const addToCart = (product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
    notify(language === "vi" ? `Đã thêm ${product.name} vào giỏ` : `${product.name} added to cart`);
  };

  const changeQuantity = (id, delta) => {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const toggleFavorite = (id) => {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const selectCategory = (id) => {
    setActiveCategory(id);
    setMobileMenu(false);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="technest">
      <div className="announcement-bar">
        <div className="announcement-inner">
          <span><Truck size={15} /> {t.shipping}</span>
          <span className="announcement-note"><Sparkles size={14} /> Better Tools. Brighter Days.</span>
        </div>
      </div>

      <header className="site-header">
        <a className="brand" href="#home" aria-label="Technest home">
          <span className="brand-mark" aria-hidden="true"><span>T</span><i>N</i></span>
          <span className="brand-name">Technest<span className="brand-dot">.</span></span>
          <span className="brand-tagline">Better Tools. Brighter Days.</span>
        </a>
        <div className={`header-search ${searchOpen ? "search-visible" : ""}`}>
          <Search size={19} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} aria-label={t.search} />
          {search && <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search"><X size={16} /></button>}
        </div>
        <div className="header-actions">
          <LanguageSwitch language={language} setLanguage={setLanguage} />
          <button className="header-action" onClick={() => setDrawer("favorites")} aria-label={t.favorites}>
            <span className="header-action-icon"><Heart size={21} />{favorites.length > 0 && <i className="count-bubble">{favorites.length}</i>}</span><span>{t.favorites}</span>
          </button>
          <button className="header-action account-action" onClick={() => notify(language === "vi" ? "Tính năng tài khoản sẽ được bổ sung sau" : "Account features are coming soon")} aria-label={t.account}><UserRound size={21} /><span>{t.account}</span></button>
          <button className="header-action cart-action" onClick={() => setDrawer("cart")} aria-label={`${t.cart}: ${cartCount}`}>
            <span className="header-action-icon"><ShoppingCart size={22} />{cartCount > 0 && <i className="count-bubble">{cartCount}</i>}</span><span>{t.cart}</span>
          </button>
          <button className="mobile-search-button" onClick={() => setSearchOpen((value) => !value)} aria-label={t.search}><Search size={21} /></button>
          <button className="mobile-menu-button" onClick={() => setMobileMenu((value) => !value)} aria-label="Toggle navigation">{mobileMenu ? <X size={23} /> : <Menu size={23} />}</button>
        </div>
      </header>

      <nav className={`category-nav ${mobileMenu ? "nav-open" : ""}`} aria-label="Main navigation">
        <button className="nav-home" onClick={() => { setActiveCategory("all"); setSearch(""); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Package size={17} /> {t.home}</button>
        {categories.slice(1).map((category) => {
          const Icon = category.icon;
          return <button key={category.id} className={activeCategory === category.id ? "nav-selected" : ""} onClick={() => selectCategory(category.id)}><Icon size={17} /> {category[language]}</button>;
        })}
        <button onClick={() => { setSortBy("priceLow"); selectCategory("all"); }}><Sparkles size={17} /> {t.sale}</button>
      </nav>

      <div className="home-content">
        <section className="hero-layout" id="home">
          <div className="hero-main">
            <img key={heroSlides[activeSlide].image} className="hero-main-image" src={heroSlides[activeSlide].image} alt={heroSlides[activeSlide].alt[language]} />
            <div className="hero-image-wash" />
            <div className="hero-copy">
              <span className="eyebrow-pill">{heroSlides[activeSlide].tag[language]}</span>
              <h1 key={`title-${activeSlide}`}>{heroSlides[activeSlide].title[language]}</h1>
              <p key={`desc-${activeSlide}`}>{heroSlides[activeSlide].desc[language]}</p>
              <a href="#products" className="primary-button">{t.explore} <ArrowRight size={18} /></a>
            </div>
            <div className="hero-pagination" aria-label="Banner slides">
              {heroSlides.map((slide, index) => <button key={slide.image} type="button" className={index === activeSlide ? "active" : ""} aria-label={`${language === "vi" ? "Chuyển đến banner" : "Go to banner"} ${index + 1}`} aria-pressed={index === activeSlide} onClick={() => setActiveSlide(index)} />)}
            </div>
          </div>
          <div className="hero-side">
            <article className="hero-promo-card keyboard-promo">
              <div><span className="promo-kicker">{language === "vi" ? "BÀN PHÍM CƠ" : "MECHANICAL KEYBOARDS"}</span><h2>{t.bestSeller}</h2><p>{t.bestDesc}</p><button onClick={() => selectCategory("keyboards")}>{t.shopNow} <ArrowRight size={15} /></button></div>
              <img src="https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=500&q=85" alt="Mechanical keyboard" />
            </article>
            <article className="hero-promo-card audio-promo">
              <div><span className="promo-kicker">{t.audioTitle}</span><h2>{language === "vi" ? "Âm thanh đỉnh cao" : "Sound, elevated"}</h2><p>{t.audioDesc}</p><button onClick={() => selectCategory("audio")}>{t.shopNow} <ArrowRight size={15} /></button></div>
              <img src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=500&q=85" alt="Wireless headphones" />
            </article>
          </div>
        </section>

        <section className="quick-categories" aria-label="Product categories">
          {categories.map((category) => {
            const Icon = category.icon;
            return <button key={category.id} className={`quick-category ${activeCategory === category.id ? "quick-active" : ""}`} onClick={() => selectCategory(category.id)}>
              <span className="quick-category-image"><Icon size={26} strokeWidth={1.7} /></span><span>{category[language]}</span>
            </button>;
          })}
          <button className="quick-category" onClick={() => { setSortBy("priceLow"); selectCategory("all"); }}><span className="quick-category-image"><Sparkles size={26} /></span><span>{t.sale}</span></button>
        </section>

        <section className="product-section unified-section" id="products">
          <div className="section-heading">
            <div><span className="section-kicker">{language === "vi" ? "ĐƯỢC CHỌN LỌC CHO BẠN" : "CURATED FOR YOU"}</span><h2>{t.featured} <Sparkles size={22} className="heading-sparkle" /></h2><p>{t.featuredDesc}</p></div>
            <a href="#products" className="text-link" onClick={() => { setActiveCategory("all"); setSearch(""); }}>{t.viewAll} <ArrowRight size={16} /></a>
          </div>
          <div className="product-toolbar">
            <span><strong>{visibleProducts.length}</strong> {t.products}</span>
            <label className="sort-select"><SlidersHorizontal size={16} /><span>{t.sort}:</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label={t.sort}><option value="recommended">{t.recommended}</option><option value="priceLow">{t.priceLow}</option><option value="priceHigh">{t.priceHigh}</option><option value="newest">{t.newest}</option></select><ChevronDown size={15} /></label>
          </div>
          {activeCategory !== "all" && <div className="active-filter"><span>{categories.find((category) => category.id === activeCategory)?.[language]}</span><button onClick={() => setActiveCategory("all")}><X size={14} /> {t.all}</button></div>}
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image-wrap">
                  <img src={product.image} alt={product.name} loading="lazy" />
                  {product.badge && <span className={`product-badge badge-${product.badge}`}>{product.badge === "bestseller" ? (language === "vi" ? "BÁN CHẠY" : "BESTSELLER") : product.badge === "sale" ? (language === "vi" ? "GIẢM GIÁ" : "SALE") : product.badge === "new" ? (language === "vi" ? "MỚI VỀ" : "NEW") : product.badge === "hot" ? (language === "vi" ? "PHỤ KIỆN HOT" : "TRENDING") : (language === "vi" ? "PHỔ BIẾN" : "POPULAR")}</span>}
                  <button className={`favorite-button ${favorites.includes(product.id) ? "is-favorite" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label={favorites.includes(product.id) ? "Remove from favorites" : "Add to favorites"}><Heart size={18} fill={favorites.includes(product.id) ? "currentColor" : "none"} /></button>
                </div>
                <div className="product-info">
                  <span className="product-brand">{product.brand}</span><h3>{product.name}</h3><p className="product-description">{product.description}</p>
                  <div className="product-rating"><span className="rating-star">★</span><strong>{product.rating.toFixed(1)}</strong><span>({product.reviews} {t.rating})</span></div>
                  <div className="product-price-row"><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</div>
                  <button className="add-cart-button" onClick={() => addToCart(product)}><ShoppingCart size={17} /><span>{t.addCart}</span><ArrowRight size={16} /></button>
                </div>
              </article>
            ))}
            {visibleProducts.length === 0 && <div className="empty-products"><Search size={30} /><h3>{t.noResults}</h3><button className="primary-button" onClick={() => { setSearch(""); setActiveCategory("all"); }}>{t.all}</button></div>}
          </div>
        </section>

        <section className="home-trending-section unified-section">
          <div className="section-heading"><div><span className="section-kicker">{language === "vi" ? "ĐƯỢC CỘNG ĐỒNG LỰA CHỌN" : "COMMUNITY FAVORITES"}</span><h2>{t.trending} <Sparkles size={22} className="heading-sparkle" /></h2><p>{t.trendingDesc}</p></div><a href="#products" className="text-link" onClick={() => { setActiveCategory("all"); setSearch(""); }}>{t.viewAll} <ArrowRight size={16} /></a></div>
          <div className="mini-product-grid">{[products[2], products[0], products[1], products[5]].map((product) => <MiniProductCard key={`trending-${product.id}`} product={product} language={language} addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} />)}</div>
        </section>

        <section className="deal-feature unified-section">
          <div className="deal-feature-copy"><span className="deal-label"><Sparkles size={14} /> TECHNEST DEALS</span><h2>{t.dealTitle}</h2><p>{t.dealDesc}</p><a href="#products" className="deal-button" onClick={() => { setSortBy("priceLow"); setActiveCategory("all"); }}>{t.exploreMore} <ArrowRight size={17} /></a></div>
          <div className="deal-products">{[products[3], products[7], products[4]].map((product) => <div className="deal-product" key={`deal-${product.id}`}><img src={product.image} alt={product.name} loading="lazy" /><span>{product.name}</span><strong>{formatPrice(product.price)}</strong></div>)}</div>
        </section>

        <section className="home-style-section unified-section">
          <div className="section-heading"><div><span className="section-kicker">{language === "vi" ? "TÌM CẢM HỨNG CHO GÓC SETUP" : "FIND YOUR SETUP INSPIRATION"}</span><h2>{t.shopByMood}</h2><p>{t.shopByMoodDesc}</p></div></div>
          <div className="setup-style-grid">
            <button className="setup-style-card setup-work" onClick={() => selectCategory("accessories")}><img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85" alt={t.setupWork} loading="lazy" /><span className="setup-style-overlay" /><span className="setup-style-copy"><small>01 / WORK</small><strong>{t.setupWork}</strong><em>{t.exploreMore} <ArrowRight size={15} /></em></span></button>
            <button className="setup-style-card setup-gaming" onClick={() => selectCategory("keyboards")}><img src="https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=85" alt={t.setupGaming} loading="lazy" /><span className="setup-style-overlay" /><span className="setup-style-copy"><small>02 / PLAY</small><strong>{t.setupGaming}</strong><em>{t.exploreMore} <ArrowRight size={15} /></em></span></button>
            <button className="setup-style-card setup-audio" onClick={() => selectCategory("audio")}><img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85" alt={t.setupAudio} loading="lazy" /><span className="setup-style-overlay" /><span className="setup-style-copy"><small>03 / LISTEN</small><strong>{t.setupAudio}</strong><em>{t.exploreMore} <ArrowRight size={15} /></em></span></button>
          </div>
        </section>

        <section className="home-new-section unified-section">
          <div className="section-heading"><div><span className="section-kicker">{language === "vi" ? "MỚI NHẤT TRONG CỬA HÀNG" : "FRESH IN STORE"}</span><h2>{t.newArrivals}</h2><p>{t.newArrivalsDesc}</p></div><a href="#products" className="text-link" onClick={() => { setSortBy("newest"); setActiveCategory("all"); }}>{t.viewAll} <ArrowRight size={16} /></a></div>
          <div className="mini-product-grid mini-product-grid-four">{[products[7], products[4], products[6], products[3]].map((product) => <MiniProductCard key={`new-${product.id}`} product={product} language={language} addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} />)}</div>
        </section>

        <section className="trusted-brands unified-section">
          <span className="section-kicker">{t.trustedBrands}</span>
          <div className="trusted-brand-list"><span>KEYCHRON</span><span>LOGITECH</span><span>SONY</span><span>TECHNEST SELECT</span><span>JBL</span><span>RAZER</span></div>
        </section>

        <section className="feature-banner unified-section">
          <div className="feature-banner-copy"><span className="section-kicker">{t.promotionTag}</span><h2>{t.promotionTitle}</h2><p>{t.promotionDesc}</p><a href="#products" className="primary-button">{t.exploreMore} <ArrowRight size={17} /></a></div>
          <div className="feature-banner-image"><img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1100&q=85" alt="Organized workspace" loading="lazy" /></div>
        </section>

        <section className="service-strip unified-section">
          <div className="service-item"><span><Truck size={22} /></span><div><strong>{t.delivery}</strong><small>{t.deliveryDesc}</small></div></div>
          <div className="service-item"><span><ShieldCheck size={22} /></span><div><strong>{t.authentic}</strong><small>{t.authenticDesc}</small></div></div>
          <div className="service-item"><span><Headphones size={22} /></span><div><strong>{t.support}</strong><small>{t.supportDesc}</small></div></div>
          <div className="service-item"><span><CreditCard size={22} /></span><div><strong>{t.payment}</strong><small>{t.paymentDesc}</small></div></div>
        </section>
      </div>

      <footer className="site-footer" id="footer">
        <div className="footer-main">
          <div className="footer-brand-column"><a className="brand" href="#home"><span className="brand-mark" aria-hidden="true"><span>T</span><i>N</i></span><span className="brand-name">Technest<span className="brand-dot">.</span></span><span className="brand-tagline">Better Tools. Brighter Days.</span></a><p>{t.footerDesc}</p><div className="footer-socials"><a href="#products" aria-label="Instagram">ig</a><a href="#products" aria-label="Facebook">f</a><a href="#products" aria-label="Youtube">▶</a></div></div>
          <div className="footer-column"><h3>{t.customerCare}</h3><a href="#footer">{t.contact}</a><a href="#footer">{t.guide}</a><a href="#footer">{t.shippingPolicy}</a><a href="#footer">{t.returns}</a></div>
          <div className="footer-column"><h3>{t.about}</h3><a href="#products">{t.featured}</a><a href="#home">{t.home}</a><a href="#footer">{t.contact}</a></div>
          <div className="footer-newsletter"><h3>{t.newsletter}</h3><p>{t.newsletterDesc}</p><form onSubmit={(event) => { event.preventDefault(); notify(language === "vi" ? "Cảm ơn bạn đã đăng ký!" : "Thanks for subscribing!"); event.currentTarget.reset(); }}><input type="email" placeholder={t.email} required aria-label={t.email} /><button type="submit" aria-label={t.subscribe}><ArrowRight size={18} /></button></form></div>
        </div>
        <div className="footer-bottom"><span>© 2026 TECHNEST</span><span>{t.copyright}</span><a href="#home">BACK TO TOP ↑</a></div>
      </footer>

      {toast && <div className="toast-message"><Check size={17} /> {toast}</div>}

      {drawer && <div className="drawer-overlay" onClick={() => setDrawer(null)}>
        <aside className="side-drawer" onClick={(event) => event.stopPropagation()} aria-label={drawer === "cart" ? t.cart : t.favorites}>
          <div className="drawer-header"><div><span className="section-kicker">TECHNEST</span><h2>{drawer === "cart" ? t.cart : t.favorites}</h2></div><button className="drawer-close" onClick={() => setDrawer(null)} aria-label={t.close}><X size={22} /></button></div>
          {drawer === "cart" ? (
            cart.length ? <><div className="drawer-items">{cart.map((item) => <div className="drawer-product" key={item.id}><img src={item.image} alt={item.name} /><div className="drawer-product-info"><strong>{item.name}</strong><span>{formatPrice(item.price)}</span><div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} aria-label="Increase quantity"><Plus size={13} /></button></div></div><button className="remove-item" onClick={() => setCart((current) => current.filter((cartItem) => cartItem.id !== item.id))} aria-label={t.remove}><Trash2 size={17} /></button></div>)}</div><div className="drawer-summary"><div><span>{t.subtotal}</span><strong>{formatPrice(subtotal)}</strong></div><p>{language === "vi" ? "Phí vận chuyển sẽ được tính ở bước tiếp theo." : "Shipping will be calculated at the next step."}</p><button className="checkout-button" onClick={() => notify(language === "vi" ? "Thanh toán sẽ được tích hợp khi có backend" : "Checkout will be available when the backend is connected")}>{t.checkout} <ArrowRight size={17} /></button><button className="continue-button" onClick={() => setDrawer(null)}>{t.continue}</button></div></> : <div className="drawer-empty"><ShoppingCart size={38} /><h3>{t.cartEmpty}</h3><p>{t.cartEmptyDesc}</p><button className="primary-button" onClick={() => setDrawer(null)}>{t.continue}</button></div>
          ) : favoriteProducts.length ? <div className="drawer-items">{favoriteProducts.map((item) => <div className="drawer-product" key={item.id}><img src={item.image} alt={item.name} /><div className="drawer-product-info"><strong>{item.name}</strong><span>{formatPrice(item.price)}</span><button className="wishlist-add" onClick={() => addToCart(item)}><Plus size={14} /> {t.addCart}</button></div><button className="remove-item" onClick={() => toggleFavorite(item.id)} aria-label={t.remove}><Trash2 size={17} /></button></div>)}</div> : <div className="drawer-empty"><Heart size={38} /><h3>{t.wishlistEmpty}</h3><button className="primary-button" onClick={() => setDrawer(null)}>{t.continue}</button></div>}
        </aside>
      </div>}
    </main>
  );
}

export default App;
