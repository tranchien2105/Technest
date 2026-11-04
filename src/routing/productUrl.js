// Catalog slugs are unique and persisted by the backend. Keep IDs as a fallback
// for older saved products that have not been refreshed from the catalog yet.
export function productUrl(product) {
  return `/products/${encodeURIComponent(product.slug || product.productId || product.id)}`;
}
