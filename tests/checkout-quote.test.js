import test from "node:test";
import assert from "node:assert/strict";
import { checkoutQuoteKey, quotedCheckoutItems } from "../src/domain/checkoutQuote.js";

test("checkout rows display confirmed server prices for the exact variant and sale line", () => {
  const cart = [
    { variantId: "12", quantity: 2, price: 100000 },
    { variantId: "12", flashSaleItemId: "8", quantity: 1, price: 80000 },
  ];
  const quote = { items: [
    { variantId: "12", flashSaleItemId: "8", quantity: 1, unitPrice: "70000" },
    { variantId: "12", flashSaleItemId: null, quantity: 2, unitPrice: "120000" },
  ] };
  assert.deepEqual(quotedCheckoutItems(cart, quote).map((item) => item.price), ["120000", "70000"]);
  assert.equal(cart[0].price, 100000, "cart snapshots are not mutated");
  assert.equal(quotedCheckoutItems([{ ...cart[0], quantity: 3 }], quote)[0].price, 100000);
  assert.equal(quotedCheckoutItems(cart, null), cart);
});

test("quote identity changes with quantity, variant, sale item or catalog price", () => {
  const item = { variantId: "12", quantity: 1, price: 100000 };
  const initial = checkoutQuoteKey([item]);
  for (const change of [{ quantity: 2 }, { variantId: "13" }, { flashSaleItemId: "8" }, { price: 110000 }]) {
    assert.notEqual(checkoutQuoteKey([{ ...item, ...change }]), initial);
  }
  assert.equal(checkoutQuoteKey([{ ...item, name: "Updated title" }]), initial);
});
