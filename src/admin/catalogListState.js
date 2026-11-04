export const catalogFilters = () => ({ categoryId: "", brandId: "", stock: "", minPrice: "", maxPrice: "", sort: "newest", usage: "", level: "" });
export const emptyCatalogListState = () => ({ query: "", status: "", page: 1, filters: catalogFilters() });

export function parseCatalogListState(value) {
  const fallback = emptyCatalogListState();
  if (!value || typeof value !== "object") return fallback;
  const filters = { ...fallback.filters };
  for (const key of Object.keys(filters)) {
    if (typeof value.filters?.[key] === "string") filters[key] = value.filters[key].slice(0, 200);
  }
  if (!["newest", "oldest", "name", "priceAsc", "priceDesc"].includes(filters.sort)) filters.sort = "newest";
  if (!["", "in", "low", "out"].includes(filters.stock)) filters.stock = "";
  if (!["", "used", "unused"].includes(filters.usage)) filters.usage = "";
  if (!["", "root", "child"].includes(filters.level)) filters.level = "";
  return {
    query: typeof value.query === "string" ? value.query.slice(0, 200) : "",
    status: ["ACTIVE", "INACTIVE", "ARCHIVED"].includes(value.status) ? value.status : "",
    page: Number.isSafeInteger(value.page) && value.page > 0 ? value.page : 1,
    filters,
  };
}

export function readCatalogListState(kind, storage = globalThis.sessionStorage) {
  try { return parseCatalogListState(JSON.parse(storage?.getItem(`technest.admin.catalog.${kind}`))); }
  catch { return emptyCatalogListState(); }
}
