import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("all store routes render with populated, empty and malformed persisted data", async () => {
  const server = await createServer({
    root,
    server: { middlewareMode: true, watch: null, ws: false, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  const previousStorage = globalThis.localStorage;
  try {
    const { default: StoreRoutes } = await server.ssrLoadModule("/src/routing/StoreRoutes.jsx");
    const { products, categories, content } = await server.ssrLoadModule("/src/data/products.js");
    const noop = () => {};
    const item = {
      ...products[0],
      quantity: 2,
      stockStatus: "IN_STOCK",
      availableQuantity: 10,
    };
    const order = {
      id: "TN-test",
      createdAt: "2026-10-01T00:00:00Z",
      items: [item],
      subtotal: item.price * 2,
      shipping: 0,
      total: item.price * 2,
      customer: { name: "Customer", address: "Street", city: "City" },
    };
    const props = {
      products,
      categories,
      catalog: { detailProduct: products[0], loading: false, error: null },
      catalogLoading: false,
      catalogError: null,
      catalogPagination: null,
      catalogQuery: {},
      brands: [],
      setCatalogQuery: noop,
      cartCatalogReady: true,
      cartStockReady: true,
      t: content.vi,
      language: "vi",
      cart: [item],
      orders: [order],
      favorites: [item.id],
      compareIds: [item.id],
      visibleProducts: products,
      activeCategory: "all",
      sortBy: "recommended",
      navigate: noop,
      addToCart: noop,
      buyNow: noop,
      setCart: noop,
      setOrders: noop,
      setActiveCategory: noop,
      setSortBy: noop,
      clearFilters: noop,
      changeQuantity: noop,
      removeFromCart: noop,
      toggleFavorite: noop,
      toggleCompare: noop,
      onAuthenticate: noop,
    };
    const routes = [
      "/products",
      "/search?q=keyboard",
      "/products/1",
      "/products/99999",
      "/favorites",
      "/compare",
      "/setup",
      "/cart",
      "/checkout?items=1",
      "/order-success/TN-test",
      "/order-success/missing",
      "/login",
      "/register",
      "/forgot-password",
      "/account",
      "/account/orders",
      "/account/orders/TN-test",
      "/account/profile",
      "/account/addresses",
      "/account/notifications",
      "/account/missing",
      "/missing",
    ];
    globalThis.localStorage = { getItem: () => '{"name":{},"email":[]}', setItem: noop };
    for (const route of routes) {
      const markup = renderToStaticMarkup(createElement(StoreRoutes, { ...props, route }));
      assert.ok(markup.includes("store-page"), `${route} rendered its page wrapper`);
      assert.ok(!markup.includes("undefined"), `${route} has no undefined text`);
    }
    for (const route of ["/cart", "/checkout", "/favorites", "/compare", "/account/orders"]) {
      const markup = renderToStaticMarkup(
        createElement(StoreRoutes, {
          ...props,
          route,
          cart: [],
          orders: [],
          favorites: [],
          compareIds: [],
        }),
      );
      assert.ok(markup.length > 100, `${route} renders empty state`);
    }
    const detail = renderToStaticMarkup(
      createElement(StoreRoutes, { ...props, route: "/products/1" }),
    );
    assert.equal((detail.match(/<h1\b/g) || []).length, 1);
    assert.match(detail, /<h2>Có thể bạn cũng thích<\/h2>/);
    // A fresh detail instance starts at one, and only its own photo is used in thumbnails.
    assert.match(detail, /<span>1<\/span>/);
    const thumbnails = detail
      .split('class="detail-thumbnails"')[1]
      .split('class="route-detail-info"')[0];
    assert.equal((thumbnails.match(/<button/g) || []).length, 1);
    const checkout = renderToStaticMarkup(
      createElement(StoreRoutes, { ...props, route: "/checkout?items=1&quantity=1" }),
    );
    assert.match(checkout, /checkout-item-count/);
    assert.match(checkout, /1 món/);
    const missing = renderToStaticMarkup(
      createElement(StoreRoutes, { ...props, route: "/account/missing" }),
    );
    assert.match(missing, /Không tìm thấy trang/);
    const orderDetail = renderToStaticMarkup(
      createElement(StoreRoutes, { ...props, route: "/account/orders/TN-test" }),
    );
    // Server-owned orders must not appear merely because browser data was passed in.
    assert.match(orderDetail, /account-order-skeleton/);
    const { default: OrderProgress } = await server.ssrLoadModule("/src/components/account/OrderProgress.jsx");
    const progress = renderToStaticMarkup(createElement(OrderProgress, { order: { ...order, status: "PENDING" }, language: "vi" }));
    assert.match(progress, /order-timeline/);
    assert.match(progress, /Trạng thái đơn hàng được cập nhật từ Technest/);
  } finally {
    globalThis.localStorage = previousStorage;
    await server.close();
  }
});

test("header shows the authenticated customer's name and status indicator", async () => {
  const server = await createServer({
    root,
    server: { middlewareMode: true, watch: null, ws: false, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  try {
    const { default: Header } = await server.ssrLoadModule("/src/components/layout/Header.jsx");
    const { NotificationsContext } = await server.ssrLoadModule("/src/hooks/notificationsContext.js");
    const { content } = await server.ssrLoadModule("/src/data/products.js");
    const noop = () => {};
    const markup = renderToStaticMarkup(
      createElement(NotificationsContext.Provider, { value: { unreadCount: 4, refreshUnreadCount: noop, revision: 0 } }, createElement(Header, {
        language: "vi",
        setLanguage: noop,
        search: "",
        setSearch: noop,
        searchOpen: false,
        setSearchOpen: noop,
        favorites: [],
        cartCount: 0,
        mobileMenu: false,
        setMobileMenu: noop,
        t: content.vi,
        navigate: noop,
        authUser: { fullName: "Test Customer", email: "test@example.com" },
      })),
    );
    assert.match(markup, /Test Customer/);
    assert.match(markup, /account-signed-in-dot/);
    assert.match(markup, /notification-count-bubble/);
    assert.match(markup, />4</);
    assert.doesNotMatch(markup, /order-notifications-trigger/);
  } finally {
    await server.close();
  }
});

test("auth client sends login then fetches /me with the in-memory bearer token", async () => {
  const server = await createServer({
    root,
    server: { middlewareMode: true, watch: null, ws: false, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  const previousFetch = globalThis.fetch;
  try {
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      const data = url.endsWith("/login")
        ? { accessToken: "memory-access-token", csrfToken: "csrf", user: { id: 1 } }
        : { id: 1, email: "person@example.com", fullName: "Test Customer", role: "CUSTOMER" };
      return { ok: true, json: async () => ({ success: true, data }) };
    };
    const auth = await server.ssrLoadModule("/src/api/authClient.js");
    await auth.login({ email: "person@example.com", password: "safe-password" });
    const user = await auth.getMe();
    assert.equal(user.fullName, "Test Customer");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[1].url, "http://localhost:3000/api/v1/auth/me");
    assert.equal(calls[1].options.method, "GET");
    assert.equal(calls[1].options.headers.Authorization, "Bearer memory-access-token");
    assert.equal(calls[1].options.credentials, "include");
  } finally {
    globalThis.fetch = previousFetch;
    await server.close();
  }
});

test("home deals and arrivals use catalog discount and creation date rules", async () => {
  const server = await createServer({
    root,
    server: { middlewareMode: true, watch: null, ws: false, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  try {
    const { default: DealSection } = await server.ssrLoadModule(
      "/src/components/home/DealSection.jsx",
    );
    const { default: NewArrivalsSection } = await server.ssrLoadModule(
      "/src/components/home/NewArrivalsSection.jsx",
    );
    const { default: TrendingSection } = await server.ssrLoadModule(
      "/src/components/home/TrendingSection.jsx",
    );
    const { products, content } = await server.ssrLoadModule("/src/data/products.js");
    const latest = [...products]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 4);
    const props = {
      products: products.filter((product) => product.oldPrice > product.price).slice(0, 3),
      t: content.vi,
      language: "vi",
      favorites: [],
      compareIds: [],
      addToCart() {},
      toggleFavorite() {},
      toggleCompare() {},
      onViewProduct() {},
    };
    const deals = renderToStaticMarkup(createElement(DealSection, props));
    assert.match(deals, /home-rail-track/);
    assert.match(deals, /Cuộn sang phải/);
    const actualDeals = products.filter((product) => product.oldPrice > product.price).slice(0, 3);
    for (const product of actualDeals) assert.ok(deals.includes(product.name));
    assert.ok(!deals.includes("USB-C Multiport Hub"));
    assert.ok(deals.includes("/products?sale=1&amp;sort=priceLow"));
    const arrivals = renderToStaticMarkup(
      createElement(NewArrivalsSection, { ...props, products: latest }),
    );
    assert.match(arrivals, /home-rail-track/);
    assert.match(arrivals, /Cuộn sang trái/);
    for (const product of latest) assert.ok(arrivals.includes(product.name));
    const trending = renderToStaticMarkup(
      createElement(TrendingSection, { ...props, products: latest }),
    );
    assert.match(trending, /home-rail-track/);
    assert.match(trending, /Cuộn sang phải/);
    assert.ok(products.every((product) => Number.isFinite(Date.parse(product.createdAt))));
  } finally {
    await server.close();
  }
});

test("App wiring renders URL category, isolated search and guarded checkout with real hooks", async () => {
  const server = await createServer({
    root,
    server: { middlewareMode: true, watch: null, ws: false, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  const previousStorage = globalThis.localStorage;
  const previousLocation = globalThis.location;
  try {
    const { default: App } = await server.ssrLoadModule("/src/App.jsx");
    // These persisted values are JSON-valid but invalid for the UI domains.
    globalThis.localStorage = { getItem: () => '{"wrong":"shape"}', setItem() {} };
    globalThis.location = new URL("https://technest.test/products?category=mice");
    const catalog = renderToStaticMarkup(createElement(App));
    assert.match(catalog, /catalog-loading/);
    assert.ok(!catalog.includes("Keychron K2 Pro"));
    globalThis.location = new URL("https://technest.test/search?q=Keychron");
    const search = renderToStaticMarkup(createElement(App));
    assert.ok(search.includes("Keychron"));
    assert.ok(!search.includes("Keychron K2 Pro"));
    globalThis.location = new URL("https://technest.test/checkout?items=1&quantity=2");
    const checkout = renderToStaticMarkup(createElement(App));
    assert.ok(checkout.includes("Chào mừng bạn trở lại"));
    globalThis.location = new URL("https://technest.test/");
    assert.ok(renderToStaticMarkup(createElement(App)).includes("home-content"));
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.location = previousLocation;
    await server.close();
  }
});
