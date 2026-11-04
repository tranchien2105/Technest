import test from "node:test";
import assert from "node:assert/strict";
import { findVariantFlashDeal, flashCampaignStatus, flashSaleProductUrl } from "../src/domain/flashSale.js";
import { addCartItem, cartTotal } from "../src/domain/cart.js";

const start = Date.parse("2026-11-03T03:00:00Z");
const end = start + 3_600_000;
const item = { id: "75", productId: "12", variantId: "24", slug: "sample-mouse", flashPrice: "500000", originalPrice: "700000", availableQuantity: 2, stockAvailable: 4 };
const campaign = { id: "1", name: "Morning sale", status: "ACTIVE", startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), items: [item] };

test("Flash Sale eligibility uses start inclusive/end exclusive and honors terminal states", () => {
  assert.equal(flashCampaignStatus(campaign, start - 1), "UPCOMING");
  assert.equal(flashCampaignStatus(campaign, start), "ACTIVE");
  assert.equal(flashCampaignStatus(campaign, end - 1), "ACTIVE");
  assert.equal(flashCampaignStatus(campaign, end), "ENDED");
  for (const status of ["PAUSED", "CANCELLED", "DRAFT", "ENDED"]) assert.equal(flashCampaignStatus({ ...campaign, status }, start), status);
  assert.equal(flashCampaignStatus(campaign, NaN), "ENDED");
});

test("selected variant can belong to a second simultaneous campaign", () => {
  const other = { ...campaign, items: [{ ...item, variantId: "999" }] };
  assert.equal(findVariantFlashDeal([other, campaign], "24", start, "700000").id, "75");
  // Caller passes API time, so client clock skew cannot decide eligibility.
  assert.equal(findVariantFlashDeal([campaign], "24", start, "700000").flashPrice, "500000");
  assert.equal(findVariantFlashDeal([campaign], "999", start, "700000"), null);
  assert.equal(findVariantFlashDeal([campaign], "24", end, "700000"), null);
});

test("no exhausted or more expensive Flash Sale price is displayed", () => {
  assert.equal(findVariantFlashDeal([{ ...campaign, items: [{ ...item, availableQuantity: 0 }] }], "24", start, "700000"), null);
  assert.equal(findVariantFlashDeal([{ ...campaign, items: [{ ...item, stockAvailable: 0 }] }], "24", start, "700000"), null);
  assert.equal(findVariantFlashDeal([campaign], "24", start, "400000"), null);
  assert.equal(findVariantFlashDeal([campaign], "24", start, "500000"), null);
});

test("Flash Sale links and cart retain the exact variant and offer", () => {
  assert.equal(flashSaleProductUrl(item), "/products/sample-mouse?variant=24");
  const regular = { id: "12", variantId: "24", price: "700000" };
  const sale = { ...regular, price: "500000", flashSaleItemId: "75" };
  const cart = addCartItem(addCartItem([], regular), sale, 2);
  assert.equal(cart.length, 2);
  assert.equal(cart[1].id, "24:flash:75");
  assert.equal(cart[1].variantId, "24");
  assert.equal(cart[1].flashSaleItemId, "75");
  assert.equal(cartTotal(cart), 1700000);
});
