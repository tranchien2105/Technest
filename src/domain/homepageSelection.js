import { compareMoney } from "./cart.js";

export function selectFeaturedProducts(products, automatic, config = {}) {
  const ids = [...new Set(config.productIds || [])];
  const byId = new Map(products.map((item) => [String(item.id), item]));
  const source = ids.length ? ids.map((id) => byId.get(String(id))).filter(Boolean) : automatic;
  const unique = [...new Map(source.map((item) => [String(item.id), item])).values()];
  const result = unique.filter((item) =>
    (!config.categorySlugs?.length || config.categorySlugs.includes(item.category)) &&
    (!config.brandSlugs?.length || config.brandSlugs.includes(item.brandSlug)));
  if (config.sort === "priceLow") result.sort((a, b) => compareMoney(a.price, b.price));
  if (config.sort === "priceHigh") result.sort((a, b) => compareMoney(b.price, a.price));
  if (config.sort === "newest") result.sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || compareMoney(b.id, a.id));
  return result.slice(0, config.limit || 8);
}

export function selectHomepageBrands(brands, config = {}) {
  const byId = new Map(brands.map((brand) => [brand.id, brand]));
  const source = config.brandSlugs?.length ? [...new Set(config.brandSlugs)].map((id) => byId.get(id)).filter(Boolean) : [...byId.values()];
  return source.slice(0, config.limit || 6);
}
