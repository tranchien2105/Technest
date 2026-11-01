import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import ProductImage from "../components/common/ProductImage";
import { formatPrice } from "../utils/formatCurrency";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import { Empty } from "../components/store/PageElements";
import { ShippingProgress } from "../components/store/PageElements";
import ProductGrid from "../components/store/ProductGrid";
import { useCartSelection } from "../hooks/useCartSelection";
import { addMoney, canPurchaseStock, compareMoney } from "../domain/cart";

export default function CartPage({
  navigate,
  language,
  products,
  cart,
  changeQuantity,
  removeFromCart,
  setCart,
  t,
  favorites,
  toggleFavorite,
  addToCart,
  compareIds,
  toggleCompare,
  cartCatalogReady,
  catalogError,
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
  const { selectedCartIds, setSelectedCartIds, selectedCart, selectedSubtotal, removeSelected } =
    useCartSelection(cart, setCart);
  const cards = (items) => <ProductGrid {...cardProps} items={items} />;

  const allSelected =
    cart.length > 0 &&
    cart.every((item) => selectedCartIds.some((id) => String(id) === String(item.id)));
  const shipping = compareMoney(selectedSubtotal, 1000000) >= 0 ? 0 : 30000;
  const selectedStockReady = selectedCart.every((item) => canPurchaseStock(item, item.quantity));
  return (
    <section className="store-page">
      <PageTitle
        title={tx("Shopping cart", "Giỏ hàng", lang)}
        desc={`${cart.reduce((n, x) => n + x.quantity, 0)} ${tx("items", "sản phẩm", lang)}`}
      />
      {cart.length > 0 && (!cartCatalogReady || catalogError) && (
        <p className="catalog-feedback" role="status">
          {tx(
            "Showing saved product snapshots while the catalog is unavailable. Current prices will be checked before checkout.",
            "Đang hiển thị thông tin sản phẩm đã lưu tạm thời. Giá hiện tại sẽ cần được xác minh trước khi thanh toán.",
            lang,
          )}
        </p>
      )}
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
                className={`cart-page-item ${selectedCartIds.some((id) => String(id) === String(item.id)) ? "is-selected" : ""}`}
                key={item.id}
              >
                <label
                  className="cart-item-check"
                  aria-label={tx(`Select ${item.name}`, `Chọn ${item.name}`, lang)}
                >
                  <input
                    type="checkbox"
                    checked={selectedCartIds.some((id) => String(id) === String(item.id))}
                    onChange={(event) =>
                      setSelectedCartIds((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((id) => String(id) !== String(item.id)),
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
                      disabled={
                        item.stockStatus !== "IN_STOCK" || item.quantity >= item.availableQuantity
                      }
                      onClick={() => changeQuantity(item.id, 1)}
                      aria-label={tx("Increase quantity", "Tăng số lượng", lang)}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      className="cart-remove"
                      onClick={() => {
                        removeFromCart(item.id);
                        setSelectedCartIds((current) =>
                          current.filter((id) => String(id) !== String(item.id)),
                        );
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
              <strong>{formatPrice(addMoney(selectedSubtotal, shipping))}</strong>
            </p>
            {selectedCart.length > 0 && !selectedStockReady && (
              <p className="catalog-feedback" role="status">
                {tx(
                  "One or more selected products are unavailable or their stock cannot be confirmed.",
                  "Một hoặc nhiều sản phẩm đã chọn hết hàng hoặc chưa xác nhận được tồn kho.",
                  lang,
                )}
              </p>
            )}
            <button
              className="primary-button"
              disabled={
                !selectedCart.length ||
                !cartCatalogReady ||
                !selectedStockReady ||
                Boolean(catalogError)
              }
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
