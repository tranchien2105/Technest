const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL;
const DEFAULT_API_BASE_URL = "http://localhost:3000/api/v1";

export function apiEventSource(path) {
  const base = (API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
  return new EventSource(`${base}${path}`);
}

export class ApiError extends Error {
  constructor(message, code = "API_ERROR", status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export async function apiGet(path, { signal } = {}) {
  if (!API_BASE_URL) {
    throw new ApiError("VITE_API_BASE_URL is not configured", "API_NOT_CONFIGURED");
  }
  let response;
  try {
    response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Unable to reach the catalog service", "NETWORK_ERROR");
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "Catalog service returned an invalid response",
      "INVALID_RESPONSE",
      response.status,
    );
  }
  if (!response.ok || payload?.success !== true) {
    throw new ApiError(
      payload?.error?.message || "Catalog request failed",
      payload?.error?.code || "API_ERROR",
      response.status,
    );
  }
  return payload.data;
}

export function apiAssetUrl(path) {
  if (!path || !path.startsWith("/images/uploads/")) return path;
  const apiBase = API_BASE_URL || DEFAULT_API_BASE_URL;
  return new URL(path, new URL(apiBase, typeof location !== "undefined" ? location.origin : "http://localhost:3000").origin).href;
}

export function safeCatalogInteger(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : String(value);
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : value;
}

export function normalizeProduct(product) {
  const imageRecords = Array.isArray(product.images) ? product.images : [];
  const images = imageRecords.map((image) => image.url).filter(Boolean);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const activeVariant =
    variants.find((variant) => variant.status === "ACTIVE") || variants[0] || null;
  const baseImage = imageRecords.find((image) => !image.variantId)?.url || "";
  const activeVariantImage =
    imageRecords.find((image) => image.variantId === String(activeVariant?.id))?.url || "";
  const price = safeCatalogInteger(activeVariant?.price ?? product.price);
  const compareAtPrice = safeCatalogInteger(
    activeVariant?.compareAtPrice ?? product.compareAtPrice,
  );
  return {
    ...product,
    id: String(product.id),
    brand: product.brand?.name || product.brand || "",
    brandSlug: product.brand?.slug || product.brandSlug || "",
    brandId: product.brandId ? String(product.brandId) : product.brand?.id,
    category: product.category?.slug || product.category || "",
    price,
    oldPrice: compareAtPrice,
    compareAtPrice,
    availableQuantity: safeCatalogInteger(product.availableQuantity),
    inStock: typeof product.inStock === "boolean" ? product.inStock : null,
    stockStatus: product.stockStatus || "UNKNOWN",
    images,
    imageRecords,
    baseImage,
    defaultVariantId: activeVariant?.id ? String(activeVariant.id) : null,
    image: baseImage || activeVariantImage,
    variants: variants.map((variant) => ({
      ...variant,
      id: String(variant.id),
      price: safeCatalogInteger(variant.price),
      compareAtPrice: safeCatalogInteger(variant.compareAtPrice),
      availableQuantity: safeCatalogInteger(variant.availableQuantity),
      inStock: typeof variant.inStock === "boolean" ? variant.inStock : null,
      stockStatus: variant.stockStatus || "UNKNOWN",
      images: imageRecords.filter((image) => image.variantId === String(variant.id)),
    })),
  };
}
