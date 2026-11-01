import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProduct, safeCatalogInteger } from "../src/api/apiClient.js";
import { cartTotal } from "../src/domain/cart.js";
import { formatPrice } from "../src/utils/formatCurrency.js";

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
