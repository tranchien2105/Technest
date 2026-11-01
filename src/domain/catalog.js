import { compareMoney } from "./cart.js";

export const isDiscounted = (product) =>
  product.oldPrice !== null &&
  product.oldPrice !== undefined &&
  compareMoney(product.oldPrice, product.price) > 0;

export function discountPercent(product) {
  if (!isDiscounted(product)) return null;
  const current = BigInt(product.price);
  const previous = BigInt(product.oldPrice);
  return Number(((previous - current) * 100n + previous / 2n) / previous);
}

export function sortProducts(products, sortBy) {
  const list = [...products];
  if (sortBy === "priceLow") return list.sort((a, b) => compareMoney(a.price, b.price));
  if (sortBy === "priceHigh") return list.sort((a, b) => compareMoney(b.price, a.price));
  if (sortBy === "newest")
    return list.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return list;
}

export function filterProducts(products, { category = "all", query = "", sale = false } = {}) {
  const term = query.trim().toLowerCase();
  return products.filter(
    (product) =>
      (category === "all" || product.category === category) &&
      (!sale || isDiscounted(product)) &&
      (!term ||
        `${product.name} ${product.brand} ${product.category} ${product.description}`
          .toLowerCase()
          .includes(term)),
  );
}

// Only images owned by this product may appear in its gallery.
export function productGallery(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return [...new Set([product.image, ...images])]
    .filter((src) => typeof src === "string" && src.trim())
    .slice(0, 4);
}
