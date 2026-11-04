import { describe, expect, it } from "vitest";
import { referenceQuery } from "../src/modules/admin-operations/catalog-references.js";

describe("bounded admin catalog references", () => {
  it("defaults to a bounded brand search and normalizes the query", () => {
    expect(referenceQuery.parse({ q: "  Logitech  " })).toEqual({ type: "brands", q: "Logitech", limit: 30 });
  });
  it("rejects invalid IDs, limits, types and excessive text", () => {
    for (const value of [{ limit: 51 }, { limit: 0 }, { type: "users" }, { id: "0" }, { id: "9999999999999999999" }, { type: "categories", id: "15" }, { q: "x".repeat(201) }]) {
      expect(referenceQuery.safeParse(value).success).toBe(false);
    }
  });
  it("accepts a selected UUID category or bigint brand without converting IDs to numbers", () => {
    expect(referenceQuery.parse({ type: "categories", id: "e12b27b0-d728-4d2c-a7bb-d6777d3be079" }).id).toBe("e12b27b0-d728-4d2c-a7bb-d6777d3be079");
    expect(referenceQuery.parse({ id: "9223372036854775807" }).id).toBe("9223372036854775807");
  });
});
