export function internalUrl(value, origin) {
  try {
    const url = new URL(value, origin);
    return url.origin === origin && ["http:", "https:"].includes(url.protocol)
      ? url.pathname + url.search + url.hash
      : "/account";
  } catch {
    return "/account";
  }
}

export function guardedRoute(value, authenticated, origin, allowAuthenticatedDestination = false) {
  const route = internalUrl(value, origin);
  const url = new URL(route, origin);
  const accountRoute = url.pathname === "/account" || url.pathname.startsWith("/account/");
  const protectedRoute = url.pathname === "/checkout" || accountRoute;
  return protectedRoute && !authenticated && !allowAuthenticatedDestination
    ? `/login?next=${encodeURIComponent(route)}`
    : route;
}

export function shouldHandleLink(event, anchor, origin) {
  return Boolean(
    anchor &&
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!anchor.target || anchor.target.toLowerCase() === "_self") &&
    !anchor.hasAttribute("download") &&
    anchor.origin === origin &&
    ["http:", "https:"].includes(anchor.protocol),
  );
}

export function categoryFromRoute(route, categories) {
  const url = new URL(route, "http://technest.local");
  const category = url.searchParams.get("category");
  return categories.some((item) => item.id === category) ? category : "all";
}

export function updateRouteQuery(route, updates) {
  const url = new URL(route, "http://technest.local");
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "" || value === "all")
      url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return url.pathname + (url.searchParams.size ? `?${url.searchParams}` : "") + url.hash;
}

export function updateCatalogQuery(route, key, value) {
  if ((key === "category" && route.startsWith("/categories/")) || (key === "brand" && route.startsWith("/brands/"))) {
    const url = new URL(route, "http://technest.local");
    url.pathname = value && value !== "all" ? `/${key === "category" ? "categories" : "brands"}/${encodeURIComponent(value)}` : "/products";
    url.searchParams.delete(key);
    url.searchParams.delete("page");
    return url.pathname + url.search;
  }
  const updates = { [key]: value };
  if (key !== "page") updates.page = null;
  return updateRouteQuery(route, updates);
}

export function routePage(route) {
  const { pathname: path } = new URL(route, "http://technest.local");
  if (path === "/") return "home";
  if (path === "/products" || path === "/search" || /^\/(categories|brands)\/[a-z0-9-]+$/.test(path)) return "products";
  if (path === "/flash-sale") return "flash-sale";
  if (/^\/products\/[^/]+$/.test(path)) return "detail";
  if (["/favorites", "/compare", "/setup", "/cart", "/checkout"].includes(path))
    return path.slice(1);
  if (/^\/order-success\/[^/]+$/.test(path)) return "success";
  if (["/login", "/register", "/forgot-password"].includes(path)) return "auth";
  if (
    ["/account", "/account/orders", "/account/profile", "/account/addresses", "/account/security", "/account/notifications"].includes(path) ||
    /^\/account\/orders\/[^/]+$/.test(path)
  )
    return "account";
  return "not-found";
}
