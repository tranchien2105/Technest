import { describe, expect, it } from "vitest";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { RedisClientType } from "redis";
import * as schema from "../src/database/schema/index.js";
import { createFlashSalesService } from "../src/modules/flash-sales/flash-sales.service.js";

describe("Flash Sale cached clock", () => {
  it("refreshes the server clock on cached responses instead of extending offer expiry", async () => {
    const oldClock = "2020-01-01T00:00:00.000Z";
    const cache = { isOpen: true, get: async () => JSON.stringify({ serverNow: oldClock, campaigns: [{ id: "1" }] }) } as unknown as RedisClientType;
    const before = Date.now();
    const response = await createFlashSalesService({} as NodePgDatabase<typeof schema>, undefined, cache).listPublic();
    expect(response.campaigns).toEqual([{ id: "1" }]);
    expect(Date.parse(response.serverNow)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(response.serverNow)).toBeLessThanOrEqual(Date.now());
  });
});
