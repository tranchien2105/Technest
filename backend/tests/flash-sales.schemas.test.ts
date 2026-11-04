import { describe, expect, it } from "vitest";
import { campaignInput, campaignUpdate } from "../src/modules/flash-sales/flash-sales.schemas.js";
import { createFlashSalesService } from "../src/modules/flash-sales/flash-sales.service.js";

describe("Flash Sale campaign request schemas", () => {
  it("accepts a scheduled campaign with immutable variant identifiers and integer prices", () => {
    expect(campaignInput.safeParse({
      name: "Weekend Sale",
      description: "",
      startsAt: "2027-01-02T02:00:00.000Z",
      endsAt: "2027-01-02T04:00:00.000Z",
      status: "SCHEDULED",
      items: [{ variantId: "42", flashPrice: 790000, quota: 10, perCustomerLimit: 2, sortOrder: 0 }],
    }).success).toBe(true);
  });

  it("rejects invalid date ranges and nonpositive prices or purchase limits", () => {
    const input = { name: "Sale", description: "", startsAt: "2027-01-02T04:00:00.000Z", endsAt: "2027-01-02T02:00:00.000Z", items: [{ variantId: "42", flashPrice: 0, quota: 10, perCustomerLimit: 0, sortOrder: 0 }] };
    expect(campaignInput.safeParse(input).success).toBe(false);
  });

  it("allows metadata-only updates without applying create defaults", () => {
    expect(campaignUpdate.safeParse({ status: "PAUSED" }).success).toBe(true);
    expect(campaignUpdate.safeParse({ startsAt: "2027-01-02T04:00:00.000Z", endsAt: "2027-01-02T02:00:00.000Z" }).success).toBe(false);
  });
});

describe("Flash Sale public visibility", () => {
  it.each(["DRAFT", "CANCELLED"])("does not reveal %s campaign details by direct ID", async (status) => {
    const hiddenCampaign = { id: 42n, status };
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [hiddenCampaign] }) }),
      }),
    };
    const service = createFlashSalesService(db as never);
    await expect(service.publicDetail("42")).rejects.toMatchObject({ code: "FLASH_SALE_NOT_FOUND" });
  });
});
