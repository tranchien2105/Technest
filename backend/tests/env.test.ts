import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

const base = {
  AUTH_JWT_SECRET: "test-secret-with-at-least-thirty-two-characters",
  DATABASE_URL: "postgresql://user:secret@localhost:5433/test",
  REDIS_URL: "redis://localhost:6380",
};

describe("environment validation", () => {
  it("applies defaults and coerces the port", () => {
    expect(parseEnv({ ...base, PORT: "3100" })).toMatchObject({
      PORT: 3100,
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      CORS_ORIGIN: "http://localhost:5173",
    });
  });
  it("rejects missing or invalid settings without exposing input secrets", () => {
    for (const input of [
      {},
      { ...base, PORT: "65536" },
      { ...base, DATABASE_URL: "http://secret-password@localhost" },
      { ...base, REDIS_URL: "https://localhost" },
      { ...base, NODE_ENV: "invalid" },
      { ...base, CORS_ORIGIN: "not-a-url" },
      { ...base, CORS_ORIGIN: "file:///tmp/frontend" },
    ]) {
      expect(() => parseEnv(input)).toThrow("Invalid environment variables");
      try {
        parseEnv(input);
      } catch (error) {
        expect(String(error)).not.toContain("secret-password");
      }
    }
  });
});
