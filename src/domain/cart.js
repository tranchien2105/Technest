export const cartTotal = (items) =>
  items.reduce((total, item) => addMoney(total, multiplyMoney(item.price, item.quantity)), 0);

const moneyBigInt = (value) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (Number.isSafeInteger(value)) return BigInt(value);
  throw new TypeError("Invalid catalog money amount");
};
const safeMoneyValue = (value) =>
  value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
export const addMoney = (left, right) => safeMoneyValue(moneyBigInt(left) + moneyBigInt(right));
export const subtractMoney = (left, right) =>
  safeMoneyValue(moneyBigInt(left) - moneyBigInt(right));
export const multiplyMoney = (amount, quantity) =>
  safeMoneyValue(moneyBigInt(amount) * BigInt(quantity));
export const moneyRatio = (value, maximum) =>
  Number((moneyBigInt(value) * 10000n) / moneyBigInt(maximum)) / 100;
export const compareMoney = (left, right) => {
  const a = moneyBigInt(left);
  const b = moneyBigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
};
export const validQuantity = (quantity) => Number.isSafeInteger(quantity) && quantity > 0;
export const canPurchaseStock = (item, quantity, existingQuantity = 0) =>
  item?.stockStatus === "IN_STOCK" &&
  Number.isSafeInteger(item.availableQuantity) &&
  validQuantity(quantity) &&
  Number.isSafeInteger(existingQuantity) &&
  existingQuantity + quantity <= item.availableQuantity;

export function addCartItem(cart, product, quantity = 1) {
  if (!validQuantity(quantity)) return cart;
  const productId = product.id;
  const lineId = product.variantId ? String(product.variantId) : product.id;
  const found = cart.find((item) => String(item.id) === String(lineId));
  if (found && !validQuantity(found.quantity + quantity)) return cart;
  return found
    ? cart.map((item) =>
        String(item.id) === String(lineId)
          ? {
              ...item,
              ...product,
              id: lineId,
              ...(product.variantId ? { productId } : {}),
              quantity: item.quantity + quantity,
            }
          : item,
      )
    : [...cart, { ...product, id: lineId, ...(product.variantId ? { productId } : {}), quantity }];
}

export function changeCartQuantity(cart, id, delta) {
  return cart.map((item) => {
    if (String(item.id) !== String(id)) return item;
    const quantity = Math.max(1, item.quantity + delta);
    if (delta > 0 && !canPurchaseStock(item, delta, item.quantity)) {
      return item;
    }
    return validQuantity(quantity) ? { ...item, quantity } : item;
  });
}

export function reconcileSelection(selectedIds, previousIds, currentIds) {
  const selected = new Set(selectedIds.map(String));
  const previous = new Set(previousIds.map(String));
  return currentIds.filter((id) => selected.has(String(id)) || !previous.has(String(id)));
}

export function toggleId(ids, id, limit = Infinity) {
  if (ids.includes(id)) return ids.filter((value) => value !== id);
  return ids.length < limit ? [...ids, id] : ids;
}
