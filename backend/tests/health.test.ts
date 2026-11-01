import { afterEach, expect, it, vi } from "vitest";
import { createHealthService } from "../src/modules/health/health.service.js";

afterEach(() => {
  vi.useRealTimers();
});
it("bounds the health response when a dependency never settles", async () => {
  vi.useFakeTimers();
  const health = createHealthService({
    postgres: () => new Promise(() => {}),
    redis: async () => "PONG",
  });
  const result = health();
  await vi.advanceTimersByTimeAsync(3000);
  expect(await result).toMatchObject({
    status: "degraded",
    dependencies: { postgres: { status: "down" }, redis: { status: "up" } },
  });
  expect(vi.getTimerCount()).toBe(0);
});
