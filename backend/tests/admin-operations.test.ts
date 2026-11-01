import { describe, it, expect } from "vitest";
import { adjustedPrice } from "../src/modules/admin-operations/operations.service.js";
import { canAccess } from "../src/modules/admin-operations/permissions.js";
import { auditDetails } from "../src/modules/admin-operations/audit.js";
import {
  bulkInput,
  staffInput,
  voucherInput,
  bannerPlacementsInput,
} from "../src/modules/admin-operations/operations.schemas.js";
import { checkWorkbookArchive } from "../src/modules/admin-operations/excel.service.js";
describe("Admin operational safeguards", () => {
  it("enforces staff scopes and reserves staff management for ADMIN", () => {
    const user = { role: "STAFF" as const, permissions: ["products:read", "orders:write"] };
    expect(canAccess(user, "products")).toBeTruthy();
    expect(canAccess(user, "products", true)).toBeFalsy();
    expect(canAccess(user, "orders", true)).toBeTruthy();
    expect(canAccess(user, "staff", true)).toBeFalsy();
    expect(
      canAccess({ role: "CUSTOMER", permissions: ["products:write"] }, "products", true),
    ).toBeFalsy();
  });
  it("calculates bulk percentages without floating point money", () => {
    expect(adjustedPrice("9999999999999999", "INCREASE_PERCENT", "10")).toBe("10999999999999998");
    expect(adjustedPrice("100001", "DECREASE_PERCENT", "33")).toBe("67001");
    expect(() => adjustedPrice("100", "DECREASE_PERCENT", "101")).toThrow();
  });
  it("does not record passwords or tokens in audit details", () => {
    expect(auditDetails({ name: "Staff", password: "secret", token: "secret" })).toEqual({
      name: "Staff",
    });
  });
  it("rejects duplicate selection, missing action values, invalid permissions and discounts", () => {
    expect(
      bulkInput.safeParse({ ids: ["1", "1"], key: "12345678", action: "PRICE", price: "100" })
        .success,
    ).toBe(false);
    expect(bulkInput.safeParse({ ids: ["1"], key: "12345678", action: "CATEGORY" }).success).toBe(
      false,
    );
    expect(
      staffInput.safeParse({
        email: "staff@test.dev",
        fullName: "Staff",
        permissions: ["staff:write"],
      }).success,
    ).toBe(false);
    expect(
      voucherInput.safeParse({
        code: "SALE",
        name: "Sale",
        type: "PERCENT",
        value: "101",
        usageLimit: 10,
        startsAt: "2026-10-01T00:00:00Z",
        endsAt: "2026-11-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });
  it("validates banner placement capacity and prevents duplicate assignments", () => {
    const valid = { placements: { HOME_HERO: ["1", "2"], HOME_HERO_RIGHT_TOP: ["3"], HOME_HERO_RIGHT_BOTTOM: [], HOME_PROMO: [], HOME_BOTTOM: [], HOME_SETUP_STUDIO: [] } };
    expect(bannerPlacementsInput.safeParse(valid).success).toBe(true);
    expect(bannerPlacementsInput.safeParse({ placements: { ...valid.placements, HOME_HERO_RIGHT_TOP: Array.from({ length: 101 }, (_, index) => String(index + 10)) } }).success).toBe(false);
    expect(bannerPlacementsInput.safeParse({ placements: { ...valid.placements, HOME_SETUP_STUDIO: Array.from({ length: 10 }, (_, index) => String(index + 20)) } }).success).toBe(true);
    expect(bannerPlacementsInput.safeParse({ placements: { ...valid.placements, HOME_PROMO: ["1"] } }).success).toBe(false);
  });
  it("rejects malformed and oversized workbook archives", () => {
    expect(() => checkWorkbookArchive(Buffer.from("bad"))).toThrow();
    const b = Buffer.alloc(68);
    b.writeUInt32LE(0x02014b50, 0);
    b.writeUInt32LE(40 * 1024 * 1024, 24);
    b.writeUInt32LE(0x06054b50, 46);
    b.writeUInt16LE(1, 56);
    expect(() => checkWorkbookArchive(b)).toThrow();
  });
});
