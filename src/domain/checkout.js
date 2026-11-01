import { addMoney, cartTotal, compareMoney, validQuantity } from "./cart.js";

export const shippingFee = (subtotal) => (compareMoney(subtotal, 1000000) >= 0 ? 0 : 30000);

export function buyNowUrl(productId, quantity, variantId) {
  return `/checkout?items=${encodeURIComponent(variantId || productId)}&quantity=${quantity}`;
}

export function checkoutItems(cart, route) {
  const params = new URL(route, "http://technest.local").searchParams;
  if (!params.has("items")) return cart;
  const ids = new Set(params.get("items").split(",").filter(Boolean));
  const items = cart.filter(
    (item) => ids.has(String(item.id)) || ids.has(String(item.productId || item.id)),
  );
  // Buy Now carries an explicit quantity, independently of existing cart quantity.
  if (params.has("quantity")) {
    const quantity = Number(params.get("quantity"));
    if (ids.size !== 1 || !validQuantity(quantity)) return [];
    return items.filter((item) => item.quantity >= quantity).map((item) => ({ ...item, quantity }));
  }
  return items;
}

export function createOrder(
  items,
  customer,
  now = new Date(),
  id = `TN-${globalThis.crypto.randomUUID()}`,
) {
  if (!items.length) throw new Error("Cannot place an empty order");
  const subtotal = cartTotal(items);
  const shipping = shippingFee(subtotal);
  return {
    id,
    createdAt: now.toISOString(),
    status: "PLACED",
    items: items.map((item) => ({ ...item })),
    subtotal,
    shipping,
    total: addMoney(subtotal, shipping),
    customer,
  };
}

export function consumeOrderItems(cart, items) {
  return cart.flatMap((item) => {
    const ordered = items.find((entry) => String(entry.id) === String(item.id));
    if (!ordered) return [item];
    const quantity = item.quantity - ordered.quantity;
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}
