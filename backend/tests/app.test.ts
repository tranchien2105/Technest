import express from "express";
import request from "supertest";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/config/logger.js";
import { errorHandler } from "../src/middlewares/error-handler.js";
import { validateRequest } from "../src/middlewares/validate-request.js";

const logger = createLogger("silent");
const makeApp = (
  postgres = vi.fn().mockResolvedValue(1),
  redis = vi.fn().mockResolvedValue("PONG"),
) => createApp({ logger, corsOrigin: "http://localhost:5173", health: { postgres, redis } });

describe("HTTP foundation", () => {
  it("keeps liveness independent from unavailable databases", async () => {
    const postgres = vi.fn().mockRejectedValue(new Error("offline"));
    const redis = vi.fn().mockRejectedValue(new Error("offline"));
    const app = makeApp(postgres, redis);
    const live = await request(app).get("/api/v1/health/live").expect(200);
    expect(live.body.data.status).toBe("ok");
    expect(live.headers["cache-control"]).toBe("no-store");
    expect(postgres).not.toHaveBeenCalled();
    expect(redis).not.toHaveBeenCalled();
    await request(app).get("/api/v1/health/ready").expect(503);
  });
  it("stops advertising readiness during shutdown without probing dependencies", async () => {
    const postgres = vi.fn();
    const redis = vi.fn();
    const app = createApp({ logger, corsOrigin: "http://localhost:5173", health: { postgres, redis, isReady: () => false } });
    const response = await request(app).get("/api/v1/health/ready").expect(503);
    expect(response.body.data.status).toBe("not_ready");
    expect(postgres).not.toHaveBeenCalled();
    expect(redis).not.toHaveBeenCalled();
  });
  it("checks both dependencies and returns health with a request ID", async () => {
    const postgres = vi.fn().mockResolvedValue(1);
    const redis = vi.fn().mockResolvedValue("PONG");
    const response = await request(makeApp(postgres, redis)).get("/api/v1/health").expect(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ok", dependencies: { postgres: { status: "up" }, redis: { status: "up" } } },
    });
    expect(postgres).toHaveBeenCalledOnce();
    expect(redis).toHaveBeenCalledOnce();
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
  it("generates separate request IDs and does not trust a supplied ID", async () => {
    const app = makeApp();
    const first = await request(app).get("/api/v1/missing").set("X-Request-Id", "client-controlled").expect(404);
    const second = await request(app).get("/api/v1/missing").expect(404);
    expect(first.headers["x-request-id"]).not.toBe("client-controlled");
    expect(first.body.requestId).toBe(first.headers["x-request-id"]);
    expect(second.headers["x-request-id"]).not.toBe(first.headers["x-request-id"]);
  });
  it.each(["postgres", "redis"])(
    "returns 503 when %s is unavailable without leaking error details",
    async (dependency) => {
      const down = vi.fn().mockRejectedValue(new Error("secret-connection-string"));
      const up = vi.fn().mockResolvedValue(1);
      const app = dependency === "postgres" ? makeApp(down, up) : makeApp(up, down);
      const response = await request(app).get("/api/v1/health").expect(503);
      expect(response.body.success).toBe(false);
      expect(response.body.data.dependencies[dependency].status).toBe("down");
      expect(response.text).not.toContain("secret-connection-string");
    },
  );
  it("returns the standardized 404 response", async () => {
    const response = await request(makeApp()).get("/api/v1/missing").expect(404);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
      requestId: expect.any(String),
    });
  });
  it("handles malformed JSON and oversized bodies", async () => {
    const malformed = await request(makeApp())
      .post("/api/v1/missing")
      .set("Content-Type", "application/json")
      .send("{broken")
      .expect(400);
    expect(malformed.body.error.code).toBe("INVALID_JSON");
    const large = await request(makeApp())
      .post("/api/v1/missing")
      .send({ value: "x".repeat(1024 * 1024) })
      .expect(413);
    expect(large.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
  it("allows the configured frontend origin and not an unrelated origin", async () => {
    const allowed = await request(makeApp())
      .get("/api/v1/health")
      .set("Origin", "http://localhost:5173")
      .expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(allowed.headers["access-control-expose-headers"]).toContain("X-Request-Id");
    const other = await request(makeApp())
      .get("/api/v1/health")
      .set("Origin", "https://other.test");
    expect(other.headers["access-control-allow-origin"]).not.toBe("https://other.test");
    await request(makeApp())
      .options("/api/v1/health")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .expect(204);
  });
  it("forwards async Express 5 errors and hides internal exception details", async () => {
    const app = express();
    app.get("/failure", async () => {
      await Promise.resolve();
      throw new Error("secret");
    });
    app.use(errorHandler(logger));
    const response = await request(app).get("/failure").expect(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.text).not.toContain("secret");
  });
});

describe("request validation", () => {
  const app = express();
  app.use(express.json());
  app.post(
    "/items/:id",
    validateRequest({
      params: z.object({ id: z.coerce.number().int().positive() }),
      query: z.object({ page: z.coerce.number().int().positive().default(1) }),
      body: z.object({ name: z.string().min(1) }),
    }),
    (_req, res) => {
      res.json(res.locals.validated);
    },
  );
  app.use(errorHandler(logger));
  it("parses body/query/params without assigning the Express 5 query getter", async () => {
    const response = await request(app)
      .post("/items/12?page=2")
      .send({ name: "Keyboard", extra: "removed" })
      .expect(200);
    expect(response.body).toEqual({
      params: { id: 12 },
      query: { page: 2 },
      body: { name: "Keyboard" },
    });
  });
  it.each(["/items/0", "/items/12?page=-1"])("returns field errors for %s", async (path) => {
    const response = await request(app).post(path).send({ name: "Keyboard" }).expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details[0].path).toEqual(expect.any(String));
  });
  it("rejects an invalid body", async () => {
    const response = await request(app).post("/items/1").send({ name: "" }).expect(400);
    expect(response.body.error.details[0].path).toBe("body.name");
  });
});
