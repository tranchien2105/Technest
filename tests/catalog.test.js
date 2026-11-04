import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProduct, safeCatalogInteger } from "../src/api/apiClient.js";
import { cartTotal } from "../src/domain/cart.js";
import { formatPrice } from "../src/utils/formatCurrency.js";
import { productUrl } from "../src/routing/productUrl.js";

test("product links use persisted slugs, including Flash Sale items, and support old saved IDs", () => {
  assert.equal(productUrl({ id: "63", slug: "steelseries-aerox-5-wireless" }), "/products/steelseries-aerox-5-wireless");
  assert.equal(productUrl({ id: "4", productId: "63", slug: "steelseries-aerox-5-wireless" }), "/products/steelseries-aerox-5-wireless");
  assert.equal(productUrl({ id: "63" }), "/products/63");
});

test("catalog BIGINT identifiers and money stay strings outside the safe integer range", () => {
  assert.equal(safeCatalogInteger("9007199254740993"), "9007199254740993");
  assert.equal(safeCatalogInteger("2490000"), 2490000);
  const product = normalizeProduct({
    id: "9007199254740993",
    price: "90071992547409930",
    compareAtPrice: null,
    brand: { name: "TECHNEST" },
    category: { slug: "keyboards" },
    images: [
      { id: "1", variantId: "11", url: "/keyboard-red.jpg" },
      { id: "2", variantId: "12", url: "/keyboard-blue.jpg" },
    ],
    availableQuantity: 9,
    inStock: true,
    stockStatus: "IN_STOCK",
    variants: [
      {
        id: "11",
        status: "ACTIVE",
        sku: "TN-11",
        price: "90071992547409930",
        availableQuantity: 9,
        inStock: true,
        stockStatus: "IN_STOCK",
      },
    ],
  });
  assert.equal(product.id, "9007199254740993");
  assert.equal(product.price, "90071992547409930");
  assert.equal(product.image, "/keyboard-red.jpg");
  assert.equal(product.variants[0].images[0].url, "/keyboard-red.jpg");
  assert.equal(product.variants[0].images.length, 1);
  assert.equal(product.stockStatus, "IN_STOCK");
  assert.equal(product.variants[0].availableQuantity, 9);
  assert.match(formatPrice(product.price), /90\.071\.992\.547\.409\.930/);
  assert.equal(cartTotal([{ price: product.price, quantity: 2 }]), "180143985094819860");
});

test("catalog normalization treats missing stock as unknown, never as available", () => {
  const product = normalizeProduct({
    id: "1",
    price: "100",
    variants: [{ id: "2", status: "ACTIVE" }],
  });
  assert.equal(product.stockStatus, "UNKNOWN");
  assert.equal(product.availableQuantity, null);
  assert.equal(product.variants[0].stockStatus, "UNKNOWN");
  assert.equal(product.variants[0].inStock, null);
});

test("Homepage manual selections preserve admin order and filters", async () => {
  const { selectFeaturedProducts } = await import("../src/domain/homepageSelection.js");
  const rows = [{id:"2",price:"500",category:"mice",brandSlug:"demo"},{id:"1",price:"100",category:"keyboards",brandSlug:"demo"}];
  assert.deepEqual(selectFeaturedProducts(rows, [], { productIds:["1","2","1"] }).map((row)=>row.id),["1","2"]);
  assert.deepEqual(selectFeaturedProducts(rows, rows, { limit:1 }).map((row)=>row.id),["2"]);
  assert.deepEqual(selectFeaturedProducts(rows, rows, { brandSlugs:["demo"], categorySlugs:["mice"] }).map((row)=>row.id),["2"]);
  assert.deepEqual(selectFeaturedProducts(rows, rows, { sort:"priceLow" }).map((row)=>row.id),["1","2"]);
});

test("Homepage brands honor manual ordering, deduplicate and remain bounded", async () => {
  const { selectHomepageBrands } = await import("../src/domain/homepageSelection.js");
  const brands = [{id:"new",name:"New"},{id:"old",name:"Old"}];
  assert.deepEqual(selectHomepageBrands(brands,{limit:1}).map((brand)=>brand.id),["new"]);
  assert.deepEqual(selectHomepageBrands(brands,{brandSlugs:["old","new","old"]}).map((brand)=>brand.id),["old","new"]);
  assert.deepEqual(selectHomepageBrands(brands,{brandSlugs:["missing"]}),[]);
});
