import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ShoppingCart, X } from "lucide-react";
import { categories, content, heroSlides, products } from "./data/products";
import HomePage from "./pages/HomePage";
import StorePages from "./pages/StorePages";
import CartDrawer from "./components/cart/CartDrawer";
import FloatingActions from "./components/layout/FloatingActions";
import "./index.css";

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [language, setLanguage] = useState("vi");
  const [route, setRoute] = useState(() =>
    location.pathname === "/checkout"
      ? `/login?next=${encodeURIComponent(location.pathname + location.search)}`
      : location.pathname + location.search,
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");
  const [favorites, setFavorites] = useState(() => read("technest-favorites", []));
  const [cart, setCart] = useState(() => read("technest-cart", []));
  const [orders, setOrders] = useState(() => read("technest-orders", []));
  const [compareIds, setCompareIds] = useState(() => read("technest-compare", []));
  const [viewedIds, setViewedIds] = useState(() => {
    const saved = read("technest-viewed", []);
    const match = location.pathname.match(/^\/products\/([^/]+)$/);
    const initialProduct = match && products.find((item) => item.id === Number(match[1]));
    return initialProduct
      ? [initialProduct.id, ...saved.filter((id) => id !== initialProduct.id)].slice(0, 8)
      : saved;
  });
  const [drawer, setDrawer] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const t = content[language];
  const navigate = (url, allowCheckout = false) => {
    const destination =
      url.split("?")[0] === "/checkout" && !authenticated && !allowCheckout
        ? `/login?next=${encodeURIComponent(url)}`
        : url;
    history.pushState({}, "", destination);
    setRoute(destination);
    const viewedMatch = destination.split("?")[0].match(/^\/products\/([^/]+)$/);
    const viewedProduct =
      viewedMatch && products.find((item) => item.id === Number(viewedMatch[1]));
    if (viewedProduct) {
      setViewedIds((current) =>
        [viewedProduct.id, ...current.filter((id) => id !== viewedProduct.id)].slice(0, 8),
      );
    }
    setDrawer(null);
    if (destination.split("?")[0] === "/") setSelectedProduct(null);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (location.pathname === "/checkout" && !authenticated)
      history.replaceState(
        {},
        "",
        `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
      );
    const onPop = () => {
      if (location.pathname === "/checkout" && !authenticated) {
        const loginUrl = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
        history.replaceState({}, "", loginUrl);
        setRoute(loginUrl);
      } else setRoute(location.pathname + location.search);
      const viewedMatch = location.pathname.match(/^\/products\/([^/]+)$/);
      const viewedProduct =
        viewedMatch && products.find((item) => item.id === Number(viewedMatch[1]));
      if (viewedProduct) {
        setViewedIds((current) =>
          [viewedProduct.id, ...current.filter((id) => id !== viewedProduct.id)].slice(0, 8),
        );
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [authenticated]);
  useEffect(() => {
    localStorage.setItem("technest-cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem("technest-favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem("technest-compare", JSON.stringify(compareIds));
  }, [compareIds]);
  useEffect(() => {
    localStorage.setItem("technest-viewed", JSON.stringify(viewedIds));
  }, [viewedIds]);
  useEffect(() => {
    const timer = setInterval(() => setActiveSlide((i) => (i + 1) % heroSlides.length), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const click = (e) => {
      const a = e.target.closest("a[href]");
      if (a && a.origin === location.origin && a.pathname.startsWith("/")) {
        e.preventDefault();
        navigate(a.pathname + a.search);
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  });

  const [currentPath] = route.split("?");
  const query =
    currentPath === "/search"
      ? new URLSearchParams(route.split("?")[1] || "").get("q") || ""
      : currentPath === "/"
        ? search
        : "";
  const routeCategory =
    currentPath === "/products"
      ? new URLSearchParams(route.split("?")[1] || "").get("category")
      : null;
  const currentCategory =
    routeCategory && categories.some((item) => item.id === routeCategory)
      ? routeCategory
      : activeCategory;
  const visibleProducts = useMemo(() => {
    let list = products.filter(
      (p) =>
        (currentCategory === "all" || p.category === currentCategory) &&
        (!query ||
          `${p.name} ${p.brand} ${p.category} ${p.description}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    );
    if (sortBy === "priceLow") list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "priceHigh") list = [...list].sort((a, b) => b.price - a.price);
    if (sortBy === "newest") list = [...list].reverse();
    return list;
  }, [currentCategory, query, sortBy]);
  const cartCount = cart.reduce((n, p) => n + p.quantity, 0);
  const subtotal = cart.reduce((n, p) => n + p.price * p.quantity, 0);
  const favoriteProducts = products.filter((p) => favorites.includes(p.id));
  const notify = (message, action = null) => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5000 : 3200);
  };
  const addToCart = (product, quantity = 1) => {
    setCart((old) => {
      const found = old.find((p) => p.id === product.id);
      return found
        ? old.map((p) => (p.id === product.id ? { ...p, quantity: p.quantity + quantity } : p))
        : [...old, { ...product, quantity }];
    });
    notify(
      language === "vi"
        ? `Đã thêm ${quantity} × ${product.name} vào giỏ hàng`
        : `Added ${quantity} × ${product.name} to your cart`,
      language === "vi" ? "Xem giỏ hàng" : "View cart",
    );
  };
  const changeQuantity = (id, delta) =>
    setCart((old) =>
      old.map((p) => (p.id === id ? { ...p, quantity: Math.max(1, p.quantity + delta) } : p)),
    );
  const removeFromCart = (id) => setCart((old) => old.filter((p) => p.id !== id));
  const toggleFavorite = (id) =>
    setFavorites((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id]));
  const toggleCompare = (id) =>
    setCompareIds((old) => {
      if (old.includes(id)) return old.filter((item) => item !== id);
      if (old.length >= 3) {
        notify(
          language === "vi"
            ? "Bạn chỉ có thể so sánh tối đa 3 sản phẩm."
            : "You can compare up to 3 products.",
        );
        return old;
      }
      return [...old, id];
    });
  const selectCategory = (id) => {
    setActiveCategory(id);
    setMobileMenu(false);
    navigate("/products" + (id === "all" ? "" : `?category=${id}`));
  };
  const viewProduct = (p) => {
    navigate(`/products/${p.id}`);
    setSelectedProduct(p);
  };
  const props = {
    t,
    language,
    setLanguage,
    categories,
    products,
    heroSlides,
    activeSlide,
    setActiveSlide,
    search,
    setSearch,
    searchOpen,
    setSearchOpen,
    favorites,
    compareIds,
    toggleCompare,
    viewedProducts: viewedIds.map((id) => products.find((item) => item.id === id)).filter(Boolean),
    cartCount,
    setDrawer,
    mobileMenu,
    setMobileMenu,
    notify,
    activeCategory: currentCategory,
    setActiveCategory,
    setSortBy,
    sortBy,
    selectCategory,
    visibleProducts,
    toggleFavorite,
    addToCart,
    selectedProduct,
    onViewProduct: viewProduct,
    onBackToHome: () => navigate("/"),
    navigate,
  };
  const [path] = route.split("?");
  const productMatch = path.match(/^\/products\/([^/]+)$/);
  const activeProduct = productMatch
    ? products.find((p) => String(p.id) === productMatch[1])
    : null;
  const pageProps = {
    ...props,
    route,
    navigate,
    cart,
    subtotal,
    changeQuantity,
    removeFromCart,
    orders,
    setOrders,
    setCart,
    authenticated,
    onAuthenticate: () => setAuthenticated(true),
    product: activeProduct,
    compareIds,
    toggleCompare,
    viewedProducts: viewedIds.map((id) => products.find((item) => item.id === id)).filter(Boolean),
  };
  return (
    <main className="technest">
      <HomePage
        {...props}
        showHome={path === "/"}
        pageContent={path !== "/" ? <StorePages {...pageProps} /> : null}
      />
      {toast && (
        <div className="toast-message" role="status" aria-live="polite">
          <span className="toast-icon">
            <Check size={19} />
          </span>
          <span className="toast-copy">{toast.message}</span>
          {toast.action && (
            <button className="toast-action" type="button" onClick={() => navigate("/cart")}>
              <ShoppingCart size={16} /> {toast.action}
            </button>
          )}
          <button
            className="toast-close"
            type="button"
            aria-label={language === "vi" ? "Đóng thông báo" : "Dismiss notification"}
            onClick={() => {
              window.clearTimeout(toastTimer.current);
              setToast(null);
            }}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <CartDrawer
        drawer={drawer}
        setDrawer={setDrawer}
        t={t}
        language={language}
        cart={cart}
        subtotal={subtotal}
        favoriteProducts={favoriteProducts}
        changeQuantity={changeQuantity}
        removeFromCart={removeFromCart}
        toggleFavorite={toggleFavorite}
        addToCart={addToCart}
        notify={notify}
        navigate={navigate}
      />
      {compareIds.length > 0 && path !== "/compare" && (
        <div className="compare-floating-bar">
          <span>
            {language === "vi"
              ? `Đang chọn ${compareIds.length}/3 sản phẩm`
              : `Comparing ${compareIds.length}/3 products`}
          </span>
          <button type="button" className="primary-button" onClick={() => navigate("/compare")}>
            {language === "vi" ? "So sánh ngay" : "Compare now"}
          </button>
          <button type="button" className="compare-clear-button" onClick={() => setCompareIds([])}>
            {language === "vi" ? "Xóa" : "Clear"}
          </button>
        </div>
      )}
      <FloatingActions language={language} />
    </main>
  );
}
export default App;
