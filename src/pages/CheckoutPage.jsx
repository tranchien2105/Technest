import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import { Empty } from "../components/store/PageElements";
import CheckoutForm from "../components/store/CheckoutForm";
import ProductGrid from "../components/store/ProductGrid";
import { useCheckout } from "../hooks/useCheckout";
import { canPurchaseStock } from "../domain/cart";

export default function CheckoutPage({
  route,
  navigate,
  language,
  products,
  cart,
  setCart,
  setOrders,
  t,
  favorites,
  toggleFavorite,
  addToCart,
  compareIds,
  toggleCompare,
  cartCatalogReady,
  catalogError,
  authUser,
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
  const { checkoutCart, checkoutSubtotal, submitOrder, submitting, error, preview, applyVoucher } = useCheckout({
    route,
    cart,
    setCart,
    setOrders,
    navigate,
  });
  const cards = (items) => <ProductGrid {...cardProps} items={items} />;
  const checkoutStockReady = checkoutCart.every((item) => canPurchaseStock(item, item.quantity));
  return (
    <section className="store-page checkout-page">
      <div className="checkout-topline">
        <a className="checkout-back-link" href="/cart">
          {tx("Back to cart", "Quay lại giỏ hàng", lang)}
        </a>
        <span>
          01&nbsp; {tx("Information", "Thông tin", lang)} <i /> 02&nbsp;{" "}
          {tx("Delivery", "Giao hàng", lang)} <i /> 03&nbsp; {tx("Confirmation", "Xác nhận", lang)}
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
        cartCatalogReady && checkoutStockReady && !catalogError ? (
          <CheckoutForm
            cart={checkoutCart}
            subtotal={checkoutSubtotal}
            submitOrder={submitOrder}
            submitting={submitting}
            error={error}
            preview={preview}
            applyVoucher={applyVoucher}
            language={language}
            authenticated={Boolean(authUser)}
          />
        ) : (
          <p className="catalog-feedback" role="status">
            {tx(
              "Current prices or product availability could not be confirmed. Return to your cart and try again when the catalog is available.",
              "Chưa thể xác nhận giá hiện tại hoặc tồn kho. Hãy quay lại giỏ hàng và thử lại khi danh mục hoạt động.",
              lang,
            )}
          </p>
        )
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
          desc={tx("Explore more picks from Technest", "Khám phá thêm sản phẩm từ Technest", lang)}
        />
        {cards(
          products
            .filter(
              (item) =>
                !cart.some(
                  (cartItem) => String(cartItem.productId || cartItem.id) === String(item.id),
                ),
            )
            .slice(0, 4),
        )}
      </section>
    </section>
  );
}
