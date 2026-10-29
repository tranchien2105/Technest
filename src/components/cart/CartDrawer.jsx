import { ArrowRight, Heart, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";
import CartItem from "./CartItem";

function FavoriteItem({ item, t, onAddToCart, onRemove }) {
  return (
    <div className="drawer-product">
      <ProductImage src={item.image} alt={item.name} />
      <div className="drawer-product-info">
        <strong>{item.name}</strong>
        <span>{formatPrice(item.price)}</span>
        <button className="wishlist-add" onClick={() => onAddToCart(item)}>
          <Plus size={14} /> {t.addCart}
        </button>
      </div>
      <button className="remove-item" onClick={() => onRemove(item.id)} aria-label={t.remove}>
        <Trash2 size={17} />
      </button>
    </div>
  );
}

export default function CartDrawer({
  drawer,
  setDrawer,
  t,
  language,
  cart,
  subtotal,
  favoriteProducts,
  changeQuantity,
  removeFromCart,
  toggleFavorite,
  addToCart,
  navigate,
}) {
  if (!drawer) return null;
  return (
    <div className="drawer-overlay" onClick={() => setDrawer(null)}>
      <aside
        className="side-drawer"
        onClick={(event) => event.stopPropagation()}
        aria-label={drawer === "cart" ? t.cart : t.favorites}
      >
        <div className="drawer-header">
          <div>
            <span className="section-kicker">TECHNEST</span>
            <h2>{drawer === "cart" ? t.cart : t.favorites}</h2>
          </div>
          <button className="drawer-close" onClick={() => setDrawer(null)} aria-label={t.close}>
            <X size={22} />
          </button>
        </div>
        {drawer === "cart" ? (
          cart.length ? (
            <>
              <div className="drawer-items">
                {cart.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onChangeQuantity={changeQuantity}
                    onRemove={removeFromCart}
                    t={t}
                  />
                ))}
              </div>
              <div className="drawer-summary">
                <div className="shipping-progress">
                  <p>
                    {subtotal >= 1000000
                      ? language === "vi"
                        ? "Đơn hàng đã được miễn phí vận chuyển!"
                        : "Your order qualifies for free shipping!"
                      : language === "vi"
                        ? `Mua thêm ${formatPrice(1000000 - subtotal)} để được miễn phí vận chuyển`
                        : `Add ${formatPrice(1000000 - subtotal)} for free shipping`}
                  </p>
                  <div className="shipping-progress-track">
                    <span style={{ width: `${Math.min(100, (subtotal / 1000000) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <span>{t.subtotal}</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>
                <p>
                  {language === "vi"
                    ? "Phí vận chuyển sẽ được tính ở bước tiếp theo."
                    : "Shipping will be calculated at the next step."}
                </p>
                <button className="checkout-button" onClick={() => navigate?.("/checkout")}>
                  {t.checkout} <ArrowRight size={17} />
                </button>
                <button className="continue-button" onClick={() => setDrawer(null)}>
                  {t.continue}
                </button>
              </div>
            </>
          ) : (
            <div className="drawer-empty">
              <ShoppingCart size={38} />
              <h3>{t.cartEmpty}</h3>
              <p>{t.cartEmptyDesc}</p>
              <button className="primary-button" onClick={() => setDrawer(null)}>
                {t.continue}
              </button>
            </div>
          )
        ) : favoriteProducts.length ? (
          <div className="drawer-items">
            {favoriteProducts.map((item) => (
              <FavoriteItem
                key={item.id}
                item={item}
                t={t}
                onAddToCart={addToCart}
                onRemove={toggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="drawer-empty">
            <Heart size={38} />
            <h3>{t.wishlistEmpty}</h3>
            <button className="primary-button" onClick={() => setDrawer(null)}>
              {t.continue}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
