import {useSeo} from "./hooks/useSeo";
import { productUrl as getProductUrl } from "./routing/productUrl";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Check, ShoppingCart, X } from "lucide-react";
import { content } from "./data/storeContent";
import HomePage from "./pages/HomePage";
import StoreRoutes from "./routing/StoreRoutes";
import { useNavigation } from "./routing/useNavigation";
import { useCatalog } from "./hooks/useCatalog";
import { useCart } from "./hooks/useCart";
import { useProductLists } from "./hooks/useProductLists";
import { usePersistentState } from "./hooks/usePersistentState";
import { readStored } from "./domain/storage";
import { useToast } from "./hooks/useToast";
import { buyNowUrl } from "./domain/checkout";
import { canPurchaseStock } from "./domain/cart";
import { clearAuth, hasRefreshSession, logout, restoreSession } from "./api/authClient";
import { NotificationsProvider } from "./hooks/useNotifications.jsx";
import CartDrawer from "./components/cart/CartDrawer";
import FloatingActions from "./components/layout/FloatingActions";
import { useHomepageConfig } from "./hooks/useHomepageConfig";
import "./index.css";

const AdminApp = lazy(() => import("./admin/AdminApp"));

function App() {
  const homepage = useHomepageConfig();
  const [language, setLanguage] = useState("vi");
  const [authState, setAuthState] = useState({ ready: false, user: null });
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { toast, notify, dismissToast } = useToast();
  const { cart, setCart, subtotal, cartCount, addItem, changeQuantity, removeFromCart } = useCart();
  const [favorites, setFavorites] = usePersistentState("technest-favorites", []);
  const [compareIds, setCompareIds] = usePersistentState("technest-compare", []);
  const [orders, setOrders] = useState([]);
  const authenticated = Boolean(authState.user);
  const {
    route,
    path,
    navigate: navigateRoute,
  } = useNavigation(authenticated || (!authState.ready && hasRefreshSession()));
  useSeo(route);
  const navigate = useCallback(
    (url, allowAuthenticatedDestination = false, options) => {
      navigateRoute(url, allowAuthenticatedDestination, options);
      setDrawer(null);
      setMobileMenu(false);
      setSearchOpen(false);
    },
    [navigateRoute],
  );
  const catalog = useCatalog({
    homeFeaturedSort: homepage.config?.sections?.featured?.sort && homepage.config.sections.featured.sort !== "recommended" ? homepage.config.sections.featured.sort : "newest",
    homeArrivalSort: homepage.config?.sections?.["new-arrivals"]?.sort || "newest",
    // The Admin visual preview must load the same catalog as the real Homepage.
    route: path.startsWith("/admin") ? "/" : route,
    navigate,
    productIds: [
      ...favorites,
      ...compareIds,
      ...readStored("technest-viewed", []),
      ...cart.map((item) => item.productId || item.id),
      ...(homepage.config?.sections?.featured?.productIds || []),
    ],
  });
  const lists = useProductLists(
    catalog.products,
    [favorites, setFavorites],
    [compareIds, setCompareIds],
  );
  const { favoriteProducts, viewedProducts, toggleFavorite } = lists;
  const { activeCategory, setActiveCategory, sortBy, setSortBy, visibleProducts } = catalog;
  const selectedCatalogIds = new Set(catalog.products.map((product) => String(product.id)));
  const cartCatalogReady =
    !catalog.loading &&
    !catalog.error &&
    cart.every((item) => selectedCatalogIds.has(String(item.productId || item.id)));
  const cartStockReady =
    cartCatalogReady && cart.every((item) => canPurchaseStock(item, item.quantity));
  const t = content[language];
  const recordVisit = lists.recordVisit;

  useEffect(() => {
    if (catalog.loading || catalog.error) return;
    const byId = new Map(catalog.products.map((product) => [String(product.id), product]));
    setCart((current) =>
      current.flatMap((item) => {
        const currentProduct = byId.get(String(item.productId || item.id));
        if (!currentProduct) return [];
        const variant =
          currentProduct.variants?.find(
            (candidate) => candidate.id === String(item.variantId || item.id),
          ) || currentProduct.variants?.[0];
        return [
          {
            ...item,
            ...currentProduct,
            ...(variant
              ? {
                  variantId: variant.id,
                  sku: variant.sku,
                  price: item.flashSaleItemId ? item.flashSalePrice : variant.price ?? currentProduct.price,
                  oldPrice: item.flashSaleItemId ? item.oldPrice : variant.compareAtPrice ?? currentProduct.oldPrice,
                  availableQuantity: item.flashSaleItemId ? Math.min(item.flashSaleAvailableQuantity ?? item.availableQuantity, variant.availableQuantity) : variant.availableQuantity,
                  inStock: variant.inStock,
                  stockStatus: variant.stockStatus,
                }
              : {}),
            id: item.flashSaleItemId ? `${String(variant?.id || currentProduct.id)}:flash:${item.flashSaleItemId}` : String(variant?.id || currentProduct.id),
            productId: String(currentProduct.id),
            quantity: item.quantity,
          },
        ];
      }),
    );
    setFavorites((current) => current.filter((id) => byId.has(String(id))).map(String));
    setCompareIds((current) => current.filter((id) => byId.has(String(id))).map(String));
  }, [catalog.loading, catalog.error, catalog.products, setCart, setFavorites, setCompareIds]);

  useEffect(() => {
    recordVisit(route);
  }, [route, recordVisit]);

  useEffect(() => {
    let active = true;
    restoreSession().then((session) => {
      if (active) setAuthState({ ready: true, user: session?.user || null });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authState.user) return undefined;
    let active = true;
    const restoreOnReturn = () => {
      if (document.visibilityState === "hidden" || !hasRefreshSession()) return;
      restoreSession().then((session) => {
        if (active && session?.user) setAuthState({ ready: true, user: session.user });
      });
    };
    window.addEventListener("focus", restoreOnReturn);
    window.addEventListener("pageshow", restoreOnReturn);
    document.addEventListener("visibilitychange", restoreOnReturn);
    return () => {
      active = false;
      window.removeEventListener("focus", restoreOnReturn);
      window.removeEventListener("pageshow", restoreOnReturn);
      document.removeEventListener("visibilitychange", restoreOnReturn);
    };
  }, [authState.user]);

  const onAuthenticate = useCallback((user) => {
    setAuthState({ ready: true, user });
  }, []);
  const onLogout = async () => {
    try {
      await logout();
    } catch {
      notify(
        language === "vi"
          ? "Không thể xác nhận đăng xuất với máy chủ. Hãy thử lại khi backend hoạt động."
          : "Could not confirm sign-out with the server. Try again when the backend is available.",
      );
    } finally {
      clearAuth();
      setAuthState({ ready: true, user: null });
      navigate("/");
    }
  };

  const addToCart = (product, quantity = 1) => {
    const variant =
      product.variants?.find(
        (item) => item.id === String(product.variantId || product.defaultVariantId),
      ) || product.variants?.[0];
    const item = variant
      ? {
          ...product,
          variantId: variant.id,
          sku: variant.sku,
          price: product.flashSaleItemId ? product.flashSalePrice : variant.price ?? product.price,
          oldPrice: product.flashSaleItemId ? product.oldPrice : variant.compareAtPrice ?? product.oldPrice,
          availableQuantity: product.flashSaleItemId ? Math.min(product.flashSaleAvailableQuantity ?? variant.availableQuantity, variant.availableQuantity) : variant.availableQuantity,
          inStock: variant.inStock,
          stockStatus: variant.stockStatus,
        }
      : product;
    const lineId = `${String(item.variantId || item.id)}${item.flashSaleItemId ? `:flash:${item.flashSaleItemId}` : ""}`;
    const current = cart.find((line) => String(line.id) === lineId);
    if (!canPurchaseStock(item, quantity, current?.quantity || 0)) {
      notify(
        language === "vi"
          ? item.stockStatus === "OUT_OF_STOCK"
            ? "Sản phẩm hiện đã hết hàng."
            : "Chưa thể xác nhận tồn kho của sản phẩm. Vui lòng thử lại sau."
          : item.stockStatus === "OUT_OF_STOCK"
            ? "This product is out of stock."
            : "Product availability cannot be confirmed yet. Please try again later.",
      );
      return false;
    }
    addItem(item, quantity);
    notify(
      language === "vi"
        ? `Đã thêm ${quantity} × ${item.name} vào giỏ hàng`
        : `Added ${quantity} × ${item.name} to your cart`,
      language === "vi" ? "Xem giỏ hàng" : "View cart",
    );
    return true;
  };
  const toggleCompare = (id) => {
    if (!compareIds.some((value) => String(value) === String(id)) && compareIds.length >= 3) {
      notify(
        language === "vi"
          ? "Bạn chỉ có thể so sánh tối đa 3 sản phẩm."
          : "You can compare up to 3 products.",
      );
      return;
    }
    lists.toggleCompare(id);
  };
  const selectCategory = (id) =>
    navigate(id === "all" ? "/products" : `/categories/${encodeURIComponent(id)}`);
  const props = {
    t,
    language,
    setLanguage,
    categories: catalog.categories,
    products: catalog.products,
    catalog,
    catalogLoading: catalog.loading,
    catalogError: catalog.error,
    catalogPagination: catalog.pagination,
    catalogQuery: catalog.queryState,
    brands: catalog.brands,
    brandCount: catalog.brandTotal,
    setCatalogQuery: catalog.setQuery,
    cartCatalogReady,
    cartStockReady,
    search,
    setSearch,
    searchOpen,
    setSearchOpen,
    favorites,
    compareIds,
    toggleCompare,
    viewedProducts,
    cartCount,
    setDrawer,
    mobileMenu,
    setMobileMenu,
    notify,
    activeCategory,
    setActiveCategory,
    setSortBy,
    sortBy,
    clearFilters: catalog.clearFilters,
    selectCategory,
    visibleProducts,
    toggleFavorite,
    addToCart,
    authUser: authState.user,
    onLogout,
    onViewProduct: (product) => navigate(getProductUrl(product)),
    navigate,
    homepageConfig: homepage.config,
  };
  const pageProps = {
    ...props,
    route,
    cart,
    subtotal,
    changeQuantity,
    removeFromCart,
    orders,
    setOrders,
    setCart,
    onAuthenticate,
    onLogout,
    authUser: authState.user,
    buyNow: (product, quantity) => {
      if (!addToCart(product, quantity)) return;
      navigate(buyNowUrl(product.id, quantity, product.variantId));
    },
  };
  if (path.startsWith("/admin")) {
    return (
      <NotificationsProvider user={authState.user}>
        <Suspense fallback={<div className="route-loading-state admin-route-loading" role="status"><span /><span /><span /></div>}>
          <AdminApp
            path={path}
            authUser={authState.user}
            authReady={authState.ready}
            navigate={navigate}
            onLogout={onLogout}
            onAuthenticate={onAuthenticate}
            storePreviewProps={props}
          />
        </Suspense>
      </NotificationsProvider>
    );
  }
  return (
    <NotificationsProvider user={authState.user}>
    <main className="technest">
      <HomePage
        {...props}
        showHome={path === "/"}
        pageContent={path !== "/" ? <StoreRoutes {...pageProps} /> : null}
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
              dismissToast();
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
        cartStockReady={cartStockReady}
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
    </NotificationsProvider>
  );
}
export default App;
