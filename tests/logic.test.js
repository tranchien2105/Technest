import test from "node:test";
import assert from "node:assert/strict";
import {
  addCartItem,
  canPurchaseStock,
  changeCartQuantity,
  reconcileSelection,
  toggleId,
} from "../src/domain/cart.js";
import {
  buyNowUrl,
  checkoutItems,
  consumeOrderItems,
  createOrder,
  shippingFee,
} from "../src/domain/checkout.js";
import {
  filterProducts,
  isDiscounted,
  productGallery,
  sortProducts,
} from "../src/domain/catalog.js";
import { readStored, sanitizeStored, writeStored } from "../src/domain/storage.js";
import {
  categoryFromRoute,
  guardedRoute,
  internalUrl,
  routePage,
  shouldHandleLink,
  updateRouteQuery,
} from "../src/routing/navigation.js";
import { orderTimeline } from "../src/domain/orderTracking.js";

const origin = "https://technest.test";
const categories = [{ id: "all" }, { id: "keyboards" }, { id: "mice" }];
const keyboard = {
  id: 1,
  name: "Keyboard",
  category: "keyboards",
  brand: "Brand",
  description: "Wireless",
  image: "/keyboard.jpg",
  price: 600000,
  oldPrice: 700000,
  stockStatus: "IN_STOCK",
  availableQuantity: 50,
  createdAt: "2026-01-01T00:00:00Z",
};
const mouse = {
  id: 2,
  name: "Mouse",
  category: "mice",
  brand: "Brand",
  description: "Wireless",
  image: "/mouse.jpg",
  price: 200000,
  oldPrice: null,
  stockStatus: "IN_STOCK",
  availableQuantity: 50,
  createdAt: "2026-02-01T00:00:00Z",
};

test("category URL updates, clears and browser history URLs determine the filter", () => {
  const initial = "/products?category=keyboards&sort=priceHigh";
  const changed = updateRouteQuery(initial, { category: "mice" });
  assert.equal(categoryFromRoute(changed, categories), "mice");
  assert.equal(categoryFromRoute(initial, categories), "keyboards");
  const cleared = updateRouteQuery(changed, { category: "all", sort: "recommended", sale: null });
  assert.equal(cleared, "/products");
  assert.equal(categoryFromRoute("/products?category=unknown", categories), "all");
  assert.equal(
    updateRouteQuery("/search?q=wireless#results", { category: "mice" }),
    "/search?q=wireless&category=mice#results",
  );
});

test("entering search without a category finds products across categories", () => {
  const products = [keyboard, mouse];
  assert.equal(
    filterProducts(products, {
      category: categoryFromRoute("/products?category=keyboards", categories),
    }).length,
    1,
  );
  const search = new URL("/search?q=wireless", origin);
  const results = filterProducts(products, {
    category: categoryFromRoute(search.href, categories),
    query: search.searchParams.get("q"),
  });
  assert.deepEqual(
    results.map((item) => item.id),
    [1, 2],
  );
});

test("same-origin anchor retains fragment; modified/new-tab/download/external clicks remain native", () => {
  const anchor = { origin, protocol: "https:", target: "", hasAttribute: () => false };
  const click = { button: 0, defaultPrevented: false };
  assert.equal(shouldHandleLink(click, anchor, origin), true);
  for (const key of ["ctrlKey", "metaKey", "shiftKey", "altKey", "defaultPrevented"]) {
    assert.equal(shouldHandleLink({ ...click, [key]: true }, anchor, origin), false);
  }
  assert.equal(shouldHandleLink({ ...click, button: 1 }, anchor, origin), false);
  for (const target of ["_blank", "preview", "_parent", "_top"])
    assert.equal(shouldHandleLink(click, { ...anchor, target }, origin), false);
  assert.equal(shouldHandleLink(click, { ...anchor, hasAttribute: () => true }, origin), false);
  assert.equal(shouldHandleLink(click, { ...anchor, origin: "https://other.test" }, origin), false);
  assert.equal(internalUrl("/#products", origin), "/#products");
  assert.equal(internalUrl("/products?q=x#detail", origin), "/products?q=x#detail");
  assert.equal(shouldHandleLink(click, null, origin), false);
});

test("protected route guard preserves Buy Now intent and returns accounts to login", () => {
  const checkout = buyNowUrl(1, 2);
  const login = guardedRoute(checkout, false, origin);
  assert.equal(new URL(login, origin).searchParams.get("next"), checkout);
  assert.equal(guardedRoute(checkout, true, origin), checkout);
  assert.equal(guardedRoute(checkout, false, origin, true), checkout);
  assert.equal(
    new URL(guardedRoute("/account/orders", false, origin), origin).searchParams.get("next"),
    "/account/orders",
  );
  assert.equal(guardedRoute("/account/orders", true, origin), "/account/orders");
  assert.equal(internalUrl("https://evil.test/checkout", origin), "/account");
  assert.equal(internalUrl("//evil.test/checkout", origin), "/account");
});

test("account order detail route is protected and order progress follows stored status", () => {
  assert.equal(routePage("/account/orders/TN-order-1"), "account");
  assert.equal(
    new URL(guardedRoute("/account/orders/TN-order-1", false, origin), origin).pathname,
    "/login",
  );
  assert.deepEqual(
    orderTimeline("PLACED").map((step) => step.state),
    ["complete", "active", "upcoming", "upcoming", "upcoming"],
  );
  assert.ok(orderTimeline("DELIVERED").every((step) => step.state === "complete"));
  assert.equal(orderTimeline("CANCELLED")[1].state, "cancelled");
});

test("products → detail → cart → checkout selected → order leaves unselected items", () => {
  const product = filterProducts([keyboard, mouse], { category: "keyboards" })[0];
  let cart = addCartItem([], mouse, 3);
  cart = addCartItem(cart, product, 2);
  cart = changeCartQuantity(cart, 1, 1);
  const items = checkoutItems(cart, "/checkout?items=1");
  const order = createOrder(
    items,
    { name: "Customer", address: "Street", city: "City" },
    new Date("2026-03-01T00:00:00Z"),
    "TN-test",
  );
  assert.equal(order.items.length, 1);
  assert.equal(order.status, "PLACED");
  assert.equal(order.subtotal, 1800000);
  assert.equal(order.shipping, 0);
  assert.deepEqual(consumeOrderItems(cart, order.items), [{ ...mouse, quantity: 3 }]);
  assert.equal(cart[1].quantity, 3);
});

test("inventory availability gates add-to-cart and quantity increases", () => {
  const available = { stockStatus: "IN_STOCK", availableQuantity: 2 };
  assert.equal(canPurchaseStock(available, 1), true);
  assert.equal(canPurchaseStock(available, 1, 1), true);
  assert.equal(canPurchaseStock(available, 1, 2), false);
  assert.equal(canPurchaseStock({ stockStatus: "UNKNOWN", availableQuantity: null }, 1), false);
  assert.equal(canPurchaseStock({ stockStatus: "OUT_OF_STOCK", availableQuantity: 0 }, 1), false);
  const line = { id: "v1", quantity: 2, ...available };
  assert.equal(changeCartQuantity([line], "v1", 1)[0].quantity, 2);
});

test("Buy Now checks out exactly chosen quantity and preserves existing cart quantities", () => {
  let cart = addCartItem([], mouse, 3);
  cart = addCartItem(cart, keyboard, 4);
  cart = addCartItem(cart, keyboard, 2);
  const items = checkoutItems(cart, buyNowUrl(1, 2));
  assert.deepEqual(items, [{ ...keyboard, quantity: 2 }]);
  const remaining = consumeOrderItems(cart, items);
  assert.equal(remaining.find((item) => item.id === 1).quantity, 4);
  assert.equal(remaining.find((item) => item.id === 2).quantity, 3);
});

test("checkout rejects invalid selections/quantities and empty orders", () => {
  const cart = [{ ...keyboard, quantity: 2 }];
  for (const route of [
    "/checkout?items=",
    "/checkout?items=999",
    "/checkout?items=1&quantity=-1",
    "/checkout?items=1&quantity=1.5",
    "/checkout?items=1&quantity=3",
    "/checkout?items=1,2&quantity=1",
  ])
    assert.deepEqual(checkoutItems(cart, route), []);
  assert.throws(() => createOrder([], {}, new Date(), "id"));
  assert.equal(shippingFee(999999), 30000);
  assert.equal(shippingFee(1000000), 0);
  assert.deepEqual(addCartItem(cart, keyboard, -1), cart);
  assert.equal(changeCartQuantity(cart, 1, -100)[0].quantity, 1);
});

test("cart selection adds new IDs, removes deleted IDs and preserves manual deselection", () => {
  assert.deepEqual(reconcileSelection([1], [1, 2], [1, 2, 3]), [1, 3]);
  assert.deepEqual(reconcileSelection([1, 3], [1, 2, 3], [2, 3]), [3]);
  assert.deepEqual(reconcileSelection([], [1, 2], [1, 2]), []);
  assert.deepEqual(reconcileSelection([], [], [1]), [1]);
});

test("gallery never borrows images and removes duplicate/invalid own images", () => {
  assert.deepEqual(productGallery(keyboard), ["/keyboard.jpg"]);
  assert.deepEqual(
    productGallery({ ...keyboard, images: ["/keyboard-side.jpg", "/keyboard.jpg", null, 4] }),
    ["/keyboard.jpg", "/keyboard-side.jpg"],
  );
});

test("deals require an actual discount; newest sorts by createdAt without mutating source", () => {
  const products = [
    mouse,
    keyboard,
    { ...keyboard, id: 3, oldPrice: 500000, createdAt: "2025-01-01" },
  ];
  assert.deepEqual(
    products.filter(isDiscounted).map((item) => item.id),
    [1],
  );
  assert.deepEqual(
    filterProducts(products, { sale: true }).map((item) => item.id),
    [1],
  );
  assert.deepEqual(
    sortProducts(products, "newest").map((item) => item.id),
    [2, 1, 3],
  );
  assert.deepEqual(
    products.map((item) => item.id),
    [2, 1, 3],
  );
});

test("favorites and comparison are idempotent toggles and compare is capped at 3", () => {
  assert.deepEqual(toggleId([1, 2, 3], 4, 3), [1, 2, 3]);
  assert.deepEqual(toggleId([1, 2, 3], 2, 3), [1, 3]);
  assert.deepEqual(toggleId([], 1), [1]);
});

test("storage rejects valid JSON of wrong shape and sanitizes all persisted domains", () => {
  for (const key of [
    "technest-cart",
    "technest-orders",
    "technest-favorites",
    "technest-compare",
    "technest-viewed",
    "technest-addresses",
  ]) {
    for (const value of [null, {}, "oops", 42, true])
      assert.deepEqual(sanitizeStored(key, value, []), []);
  }
  const item = { ...keyboard, quantity: 2 };
  assert.deepEqual(
    sanitizeStored(
      "technest-cart",
      [item, item, { ...item, quantity: -1 }, { ...item, price: "100" }, { ...item, name: {} }],
      [],
    ),
    [item],
  );
  assert.deepEqual(sanitizeStored("technest-compare", [1, 1, "2", -1, {}, 2, 3, 4], []), [1, 2, 3]);
  assert.equal(
    sanitizeStored(
      "technest-viewed",
      Array.from({ length: 12 }, (_, i) => i + 1),
      [],
    ).length,
    8,
  );
  assert.deepEqual(
    sanitizeStored(
      "technest-addresses",
      [{ name: "A", address: "B", city: "C" }, { name: {} }],
      [],
    ),
    [{ name: "A", address: "B", city: "C" }],
  );
  assert.deepEqual(sanitizeStored("technest-profile", { name: {}, email: [] }, { name: "Guest" }), {
    name: "Guest",
  });
  const order = createOrder([item], { name: "A", address: "B", city: "C" }, new Date(), "TN-test");
  assert.deepEqual(
    sanitizeStored(
      "technest-orders",
      [
        order,
        { ...order, items: {} },
        { ...order, customer: {} },
        { ...order, createdAt: "invalid" },
      ],
      [],
    ),
    [order],
  );
});

test("malformed/blocked storage reads and writes do not crash the app", () => {
  assert.deepEqual(readStored("technest-cart", [], { getItem: () => "{broken" }), []);
  const blocked = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.deepEqual(readStored("technest-cart", [], blocked), []);
  assert.equal(writeStored("technest-cart", [], blocked), false);
  let saved;
  assert.equal(
    writeStored("technest-cart", [], {
      setItem: (key, value) => {
        saved = [key, value];
      },
    }),
    true,
  );
  assert.deepEqual(saved, ["technest-cart", "[]"]);
});

test("route matching recognizes pages precisely including unknown account paths", () => {
  assert.equal(routePage("/products/1#gallery"), "detail");
  assert.equal(routePage("/search?q=mouse"), "products");
  assert.equal(routePage("/account/orders"), "account");
  assert.equal(routePage("/account/unknown"), "not-found");
  assert.equal(routePage("/order-success/TN-1"), "success");
});
