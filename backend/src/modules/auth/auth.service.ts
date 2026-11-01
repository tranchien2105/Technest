import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { AppError } from "../../shared/errors.js";
import type { AuthRepository } from "./auth.repository.js";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const refreshHash = (token: string) => createHash("sha256").update(token).digest("hex");
const opaqueToken = () => randomBytes(32).toString("base64url");

export type SafeUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: "CUSTOMER" | "ADMIN" | "STAFF";
  permissions?: string[];
  status: "ACTIVE" | "BLOCKED";
};
const safeUser = (user: SafeUser): SafeUser => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  permissions: user.permissions || [],
  status: user.status,
});

export function createAuthService(repository: AuthRepository, jwtSecret: string) {
  const key = new TextEncoder().encode(jwtSecret);
  async function issue(user: SafeUser, refreshToken = opaqueToken()) {
    const accessToken = await new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(user.id))
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(key);
    return {
      user: safeUser(user),
      accessToken,
      refreshToken,
      csrfToken: opaqueToken(),
      expiresIn: ACCESS_TTL_SECONDS,
    };
  }
  return {
    async register(input: { email: string; password: string; fullName?: string }) {
      if (await repository.findUserByEmail(input.email)) {
        throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists");
      }
      const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      let user;
      try {
        user = await repository.createUser({
          email: input.email,
          passwordHash,
          fullName: input.fullName ?? null,
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "23505") {
          throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists");
        }
        throw error;
      }
      if (!user) throw new AppError(500, "INTERNAL_ERROR", "Unable to create account");
      const credentials = await issue(user);
      await repository.createSession(
        user.id,
        refreshHash(credentials.refreshToken),
        new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      );
      return credentials;
    },
    async login(input: { email: string; password: string }) {
      const user = await repository.findUserByEmail(input.email);
      const valid = user ? await argon2.verify(user.passwordHash, input.password) : false;
      if (!user || !valid) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
      if (user.status !== "ACTIVE") throw new AppError(403, "ACCOUNT_BLOCKED", "This account is blocked");
      const credentials = await issue(user);
      await repository.createSession(
        user.id,
        refreshHash(credentials.refreshToken),
        new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      );
      return credentials;
    },
    async refresh(token: string | undefined) {
      if (!token) throw new AppError(401, "UNAUTHENTICATED", "Refresh token is required");
      const replacement = opaqueToken();
      const result = await repository.rotateSession(
        refreshHash(token),
        refreshHash(replacement),
        new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      );
      if (result.kind === "reuse") {
        throw new AppError(401, "REFRESH_TOKEN_REUSE", "Session revoked; please sign in again");
      }
      if (result.kind === "concurrent") {
        throw new AppError(409, "REFRESH_ALREADY_USED", "A concurrent refresh already rotated this session");
      }
      if (result.kind === "blocked") throw new AppError(403, "ACCOUNT_BLOCKED", "This account is blocked");
      if (result.kind !== "ok") throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
      return issue(result.user, replacement);
    },
    async logout(token: string | undefined) {
      if (token) await repository.revokeSession(refreshHash(token));
    },
    async logoutAll(userId: number) {
      await repository.revokeAll(userId);
    },
    async authenticate(token: string | undefined) {
      if (!token) throw new AppError(401, "UNAUTHENTICATED", "Bearer access token is required");
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
        const id = Number(payload.sub);
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid subject");
        const user = await repository.findUserById(id);
        if (!user || user.status !== "ACTIVE") {
          throw new AppError(401, "UNAUTHENTICATED", "Access token is invalid");
        }
        return safeUser(user);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid or expired");
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
