import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/config/logger.js";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import { REFRESH_COOKIE } from "../src/modules/auth/auth.http.js";

const secret = "integration-test-secret-with-at-least-thirty-two-characters";
class MemoryAuthRepository {
  users: Array<{
    id: number;
    email: string;
    passwordHash: string;
    fullName: string | null;
    role: "CUSTOMER" | "ADMIN";
    status: "ACTIVE" | "BLOCKED";
  }> = [];
  sessions = new Map<string, { userId: number; expiresAt: Date; revokedAt?: Date; rotatedAt?: Date }>();
  private id = 1;
  async findUserByEmail(email: string) {
    return this.users.find((user) => user.email === email);
  }
  async findUserById(id: number) {
    return this.users.find((user) => user.id === id);
  }
  async createUser(input: { email: string; passwordHash: string; fullName: string | null }) {
    if (await this.findUserByEmail(input.email)) throw Object.assign(new Error("unique"), { code: "23505" });
    const user = { ...input, id: this.id++, role: "CUSTOMER" as const, status: "ACTIVE" as const };
    this.users.push(user);
    return user;
  }
  async createSession(userId: number, tokenHash: string, expiresAt: Date) {
    this.sessions.set(tokenHash, { userId, expiresAt });
  }
  async rotateSession(oldHash: string, newHash: string, expiresAt: Date) {
    const session = this.sessions.get(oldHash);
    if (!session) return { kind: "invalid" as const };
    if (session.revokedAt) {
      if (session.rotatedAt && Date.now() - session.rotatedAt.getTime() < 10_000) {
        return { kind: "concurrent" as const };
      }
      for (const candidate of this.sessions.values()) {
        if (candidate.userId === session.userId && !candidate.revokedAt) candidate.revokedAt = new Date();
      }
      return { kind: "reuse" as const };
    }
    const user = await this.findUserById(session.userId);
    if (!user || user.status !== "ACTIVE") {
      session.revokedAt = new Date();
      return { kind: "blocked" as const };
    }
    session.revokedAt = new Date();
    session.rotatedAt = new Date();
    this.sessions.set(newHash, { userId: session.userId, expiresAt });
    return { kind: "ok" as const, user };
  }
  async revokeSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (session) session.revokedAt = new Date();
  }
  async revokeAll(userId: number) {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) session.revokedAt = new Date();
    }
  }
}

function setup() {
  const repository = new MemoryAuthRepository();
  const service = createAuthService(repository as never, secret);
  const redis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
  } as never;
  const env = {
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: 3000,
    CORS_ORIGIN: "http://localhost:5173",
    AUTH_JWT_SECRET: secret,
    LOG_LEVEL: "silent",
    DATABASE_URL: "postgresql://localhost/test",
    REDIS_URL: "redis://localhost",
  } as never;
  const app = createApp({
    logger: createLogger("silent"),
    corsOrigin: "http://localhost:5173",
    health: { postgres: async () => 1, redis: async () => "PONG" },
    auth: { service, env, redis },
  });
  return { app, repository };
}

function register(app: ReturnType<typeof setup>["app"], email = "person@example.com") {
  return request(app).post("/api/v1/auth/register").send({ email, password: "long-password-123", fullName: "Test User" });
}
function csrf(response: { body: { data: { csrfToken: string } } }) {
  return response.body.data.csrfToken;
}

afterEach(() => vi.useRealTimers());

describe("Authentication API integration", () => {
  it("registers a customer and sets HttpOnly refresh cookie without exposing its value", async () => {
    const { app, repository } = setup();
    const response = await register(app).expect(201);
    expect(response.body.data).toMatchObject({ user: { email: "person@example.com", role: "CUSTOMER" }, expiresIn: 900 });
    expect(response.body.data).not.toHaveProperty("refreshToken");
    expect(String(response.headers["set-cookie"])).toContain(`${REFRESH_COOKIE}=`);
    expect(String(response.headers["set-cookie"])).toContain("HttpOnly");
    expect(repository.users[0]?.passwordHash).not.toBe("long-password-123");
  });

  it("rejects duplicate email and rejects a client-supplied ADMIN role", async () => {
    const { app } = setup();
    await register(app).expect(201);
    await register(app).expect(409);
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "admin@example.com", password: "long-password-123", role: "ADMIN" })
      .expect(400);
  });

  it("logs in only with the correct password", async () => {
    const { app } = setup();
    await register(app).expect(201);
    await request(app).post("/api/v1/auth/login").send({ email: "person@example.com", password: "wrong" }).expect(401);
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "person@example.com", password: "long-password-123" })
      .expect(200);
  });

  it("requires a valid unexpired bearer token for /me", async () => {
    const { app } = setup();
    await request(app).get("/api/v1/auth/me").expect(401);
    const login = await register(app).expect(201);
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`)
      .expect(200);
    const expired = await new SignJWT({ role: "CUSTOMER" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 1200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(new TextEncoder().encode(secret));
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${expired}`).expect(401);
  });

  it("rotates refresh tokens, rejects reuse, and revokes the account sessions on confirmed reuse", async () => {
    vi.useFakeTimers();
    const { app } = setup();
    const agent = request.agent(app);
    const first = await agent.post("/api/v1/auth/register").send({ email: "rotate@example.com", password: "long-password-123" }).expect(201);
    const oldCookie = String(first.headers["set-cookie"]).match(new RegExp(`(${REFRESH_COOKIE}=[^;,]+)`))?.[1];
    expect(oldCookie).toBeDefined();
    const rotated = await agent
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", csrf(first))
      .expect(200);
    expect(rotated.body.data.accessToken).toBeTruthy();
    vi.advanceTimersByTime(11_000);
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${oldCookie}; technest_csrf=${csrf(rotated)}`)
      .set("x-csrf-token", csrf(rotated))
      .expect(401);
    await agent.post("/api/v1/auth/refresh").set("x-csrf-token", csrf(rotated)).expect(401);
  });

  it("requires double-submit CSRF and logout revokes the refresh session", async () => {
    const { app } = setup();
    const agent = request.agent(app);
    const login = await agent.post("/api/v1/auth/register").send({ email: "logout@example.com", password: "long-password-123" }).expect(201);
    const refreshCookie = String(login.headers["set-cookie"]).match(new RegExp(`(${REFRESH_COOKIE}=[^;,]+)`))?.[1];
    await agent.post("/api/v1/auth/logout").expect(403);
    await agent.post("/api/v1/auth/logout").set("x-csrf-token", csrf(login)).expect(200);
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${refreshCookie}; technest_csrf=${csrf(login)}`)
      .set("x-csrf-token", csrf(login))
      .expect(401);
  });

  it("logout-all revokes sessions from multiple devices", async () => {
    const { app } = setup();
    const firstDevice = request.agent(app);
    const secondDevice = request.agent(app);
    const first = await firstDevice.post("/api/v1/auth/register").send({ email: "devices@example.com", password: "long-password-123" }).expect(201);
    const second = await secondDevice.post("/api/v1/auth/login").send({ email: "devices@example.com", password: "long-password-123" }).expect(200);
    await firstDevice
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${first.body.data.accessToken}`)
      .set("x-csrf-token", csrf(first))
      .expect(200);
    await secondDevice.post("/api/v1/auth/refresh").set("x-csrf-token", csrf(second)).expect(401);
  });

  it("rejects a blocked user on login and refresh", async () => {
    const { app, repository } = setup();
    const agent = request.agent(app);
    const registered = await agent.post("/api/v1/auth/register").send({ email: "blocked@example.com", password: "long-password-123" }).expect(201);
    repository.users[0]!.status = "BLOCKED";
    await request(app).post("/api/v1/auth/login").send({ email: "blocked@example.com", password: "long-password-123" }).expect(403);
    await agent.post("/api/v1/auth/refresh").set("x-csrf-token", csrf(registered)).expect(403);
  });

  it("allows only one concurrent rotation and keeps the winning token usable", async () => {
    const { app } = setup();
    const agent = request.agent(app);
    const initial = await agent.post("/api/v1/auth/register").send({ email: "race@example.com", password: "long-password-123" }).expect(201);
    const [one, two] = await Promise.all([
      agent.post("/api/v1/auth/refresh").set("x-csrf-token", csrf(initial)),
      agent.post("/api/v1/auth/refresh").set("x-csrf-token", csrf(initial)),
    ]);
    expect([one.status, two.status].sort()).toEqual([200, 409]);
    const winner = one.status === 200 ? one : two;
    const next = await agent
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", csrf(winner))
      .expect(200);
    expect(next.body.data.accessToken).toBeTruthy();
  });
});
