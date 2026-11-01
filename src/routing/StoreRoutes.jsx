import { routePage } from "./navigation";
import ComparePage from "../pages/ComparePage";
import ProductsPage from "../pages/ProductsPage";
import ProductDetailPage from "../pages/ProductDetailPage";
import FavoritesPage from "../pages/FavoritesPage";
import SetupPage from "../pages/SetupPage";
import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import OrderSuccessPage from "../pages/OrderSuccessPage";
import AuthPage from "../pages/AuthPage";
import AccountPage from "../pages/AccountPage";
import NotFoundPage from "../pages/NotFoundPage";

export default function StoreRoutes(props) {
  const url = new URL(props.route, "http://technest.local");
  const page = routePage(props.route);
  if (page === "products")
    return <ProductsPage key={`${url.pathname}:${url.searchParams.get("q") || ""}`} {...props} />;
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
