import test from "node:test";
import assert from "node:assert/strict";
import { emptyCatalogListState, parseCatalogListState, readCatalogListState } from "../src/admin/catalogListState.js";

test("admin catalog preserves each resource's search, filters and page in session", () => {
  const state = { query: "MX Master", page: 3, status: "ACTIVE", filters: { brandId: "15", categoryId: "", stock: "in", minPrice: "100000", sort: "priceAsc" } };
  const storage = { getItem: (key) => key === "technest.admin.catalog.products" ? JSON.stringify(state) : null };
  const restored = readCatalogListState("products", storage);
  assert.equal(restored.query, state.query);
  assert.equal(restored.page, 3);
  assert.equal(restored.filters.brandId, "15");
  assert.equal(restored.filters.sort, "priceAsc");
  assert.deepEqual(readCatalogListState("brands", storage), emptyCatalogListState());
});

test("invalid or unavailable admin session data resets safely", () => {
  assert.deepEqual(readCatalogListState("products", { getItem: () => "{bad" }), emptyCatalogListState());
  assert.deepEqual(readCatalogListState("products", { getItem: () => { throw new Error("Storage blocked"); } }), emptyCatalogListState());
  const result = parseCatalogListState({ query: {}, page: -3, status: "ADMIN", filters: { sort: "unsafe", stock: "unlimited", usage: "none" } });
  assert.deepEqual(result, emptyCatalogListState());
});
