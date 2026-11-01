import { usePersistentState } from "./usePersistentState";
import { addCartItem, cartTotal, changeCartQuantity } from "../domain/cart";

export function useCart() {
  const [cart, setCart] = usePersistentState("technest-cart", []);
  return {
    cart,
    setCart,
    subtotal: cartTotal(cart),
    cartCount: cart.reduce((count, item) => count + item.quantity, 0),
    addItem: (product, quantity = 1) =>
      setCart((current) => addCartItem(current, product, quantity)),
    changeQuantity: (id, delta) => setCart((current) => changeCartQuantity(current, id, delta)),
    removeFromCart: (id) => setCart((current) => current.filter((item) => String(item.id) !== String(id))),
  };
}
