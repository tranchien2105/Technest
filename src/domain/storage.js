const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string";
const money = (value) =>
  (Number.isSafeInteger(value) && value >= 0) || (typeof value === "string" && /^\d+$/.test(value));
const positiveId = (value) =>
  (Number.isSafeInteger(value) && value > 0) ||
  (typeof value === "string" && /^[1-9]\d*$/.test(value));
const normalizeId = (value) => {
  if (typeof value !== "string") return value;
  const parsed = BigInt(value);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : value;
};
const quantity = (value) => Number.isSafeInteger(value) && value > 0;
const stringRecord = (value) => record(value) && Object.values(value).every(text);
const cartItem = (value) =>
  record(value) &&
  positiveId(value.id) &&
  quantity(value.quantity) &&
  money(value.price) &&
  ["name", "brand", "category", "image"].every((key) => text(value[key]));
const uniqueItems = (items) =>
  items.filter(
    (item, index) => items.findIndex((entry) => String(entry.id) === String(item.id)) === index,
  );
const address = (value) =>
  stringRecord(value) && ["name", "address", "city"].every((key) => text(value[key]));
const order = (value) =>
  record(value) &&
  text(value.id) &&
  text(value.createdAt) &&
  Number.isFinite(Date.parse(value.createdAt)) &&
  Array.isArray(value.items) &&
  value.items.length > 0 &&
  value.items.every(cartItem) &&
  ["subtotal", "shipping", "total"].every((key) => money(value[key])) &&
  address(value.customer);

export function sanitizeStored(key, value, fallback) {
  if (["technest-favorites", "technest-compare", "technest-viewed"].includes(key)) {
    if (!Array.isArray(value)) return fallback;
    const limit = key === "technest-compare" ? 3 : key === "technest-viewed" ? 8 : Infinity;
    return [...new Set(value.filter(positiveId).map(normalizeId))].slice(0, limit);
  }
  if (key === "technest-cart")
    return Array.isArray(value) ? uniqueItems(value.filter(cartItem)) : fallback;
  if (key === "technest-orders") return Array.isArray(value) ? value.filter(order) : fallback;
  if (key === "technest-addresses") return Array.isArray(value) ? value.filter(address) : fallback;
  if (key === "technest-profile")
    return stringRecord(value) && text(value.name) && text(value.email) ? value : fallback;
  return fallback;
}

export function readStored(key, fallback, storage) {
  try {
    return sanitizeStored(
      key,
      JSON.parse((storage ?? globalThis.localStorage).getItem(key)),
      fallback,
    );
  } catch {
    return fallback;
  }
}

export function writeStored(key, value, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
