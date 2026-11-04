import { lazy, Suspense } from "react";
import { routePage } from "./navigation";
const ComparePage = import.meta.env.SSR
  ? (await import("../pages/ComparePage")).default
  : lazy(() => import("../pages/ComparePage"));
const ProductsPage = import.meta.env.SSR
  ? (await import("../pages/ProductsPage")).default
  : lazy(() => import("../pages/ProductsPage"));
const ProductDetailPage = import.meta.env.SSR
  ? (await import("../pages/ProductDetailPage")).default
  : lazy(() => import("../pages/ProductDetailPage"));
const FavoritesPage = import.meta.env.SSR
  ? (await import("../pages/FavoritesPage")).default
  : lazy(() => import("../pages/FavoritesPage"));
const SetupPage = import.meta.env.SSR
  ? (await import("../pages/SetupPage")).default
  : lazy(() => import("../pages/SetupPage"));
const CartPage = import.meta.env.SSR
  ? (await import("../pages/CartPage")).default
  : lazy(() => import("../pages/CartPage"));
const CheckoutPage = import.meta.env.SSR
  ? (await import("../pages/CheckoutPage")).default
  : lazy(() => import("../pages/CheckoutPage"));
const OrderSuccessPage = import.meta.env.SSR
  ? (await import("../pages/OrderSuccessPage")).default
  : lazy(() => import("../pages/OrderSuccessPage"));
const AuthPage = import.meta.env.SSR
  ? (await import("../pages/AuthPage")).default
  : lazy(() => import("../pages/AuthPage"));
const AccountPage = import.meta.env.SSR
  ? (await import("../pages/AccountPage")).default
  : lazy(() => import("../pages/AccountPage"));
const NotFoundPage = import.meta.env.SSR
  ? (await import("../pages/NotFoundPage")).default
  : lazy(() => import("../pages/NotFoundPage"));
const FlashSalePage = import.meta.env.SSR
  ? (await import("../pages/FlashSalePage")).default
  : lazy(() => import("../pages/FlashSalePage"));

function RouteContent(props) {
  const url = new URL(props.route, "http://technest.local");
  const page = routePage(props.route);
  if (page === "products")
    return <ProductsPage key={`${url.pathname}:${url.searchParams.get("q") || ""}`} {...props} />;
  if (page === "flash-sale") return <FlashSalePage {...props} />;
  if (page === "detail") {
    const product = props.catalog?.detailProduct;
    return (
      <ProductDetailPage
        key={`${url.pathname}:${product?.id || "loading"}`}
        {...props}
        product={product}
      />
    );
  }
  if (page === "compare") return <ComparePage {...props} />;
  if (page === "favorites") return <FavoritesPage {...props} />;
  if (page === "setup") return <SetupPage {...props} />;
  if (page === "cart") return <CartPage {...props} />;
  if (page === "checkout") return <CheckoutPage key={url.search} {...props} />;
  if (page === "success") return <OrderSuccessPage {...props} />;
  if (page === "auth") return <AuthPage key={url.pathname} {...props} />;
  if (page === "account") return <AccountPage key={url.pathname} {...props} />;
  return <NotFoundPage {...props} />;
}

export default function StoreRoutes(props) {
  return (
    <Suspense
      fallback={
        <div className="route-loading-state" role="status" aria-label="Đang tải trang…">
          <span />
          <span />
          <span />
        </div>
      }
    >
      <RouteContent {...props} />
    </Suspense>
  );
}
