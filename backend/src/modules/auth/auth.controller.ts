import type { RequestHandler } from "express";
import { sendData } from "../../shared/response.js";
import type { Env } from "../../config/env.js";
import type { AuthService, SafeUser } from "./auth.service.js";
import { AUTH_COOKIE_PATH, CSRF_COOKIE, cookieValue, REFRESH_COOKIE, requireCsrf } from "./auth.http.js";

type CookieResponse = Parameters<RequestHandler>[1];
const refreshCookieOptions = (env: Env) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production" || env.AUTH_COOKIE_SAME_SITE === "none",
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  path: AUTH_COOKIE_PATH,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
const csrfCookieOptions = (env: Env) => ({
  httpOnly: false,
  secure: env.NODE_ENV === "production" || env.AUTH_COOKIE_SAME_SITE === "none",
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  // The SPA must read this cookie to restore its in-memory access token after reload.
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

function credentialsResponse(
  response: CookieResponse,
  env: Env,
  result: Awaited<ReturnType<AuthService["login"]>>,
  statusCode = 200,
) {
  response.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(env));
  response.cookie(CSRF_COOKIE, result.csrfToken, csrfCookieOptions(env));
  return sendData(
    response,
    {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      csrfToken: result.csrfToken,
    },
    statusCode,
  );
}

export function createAuthController(auth: AuthService, env: Env) {
  return {
    register: (async (_request, response, next) => {
      try {
        const body = response.locals.validated.body as { email: string; password: string; fullName?: string };
        credentialsResponse(response, env, await auth.register(body), 201);
      } catch (error) {
        next(error);
      }
    }) satisfies RequestHandler,
    login: (async (_request, response, next) => {
      try {
        const body = response.locals.validated.body as { email: string; password: string };
        const result = await auth.login(body);
        credentialsResponse(response, env, result);
      } catch (error) {
        next(error);
      }
    }) satisfies RequestHandler,
    refresh: (async (request, response, next) => {
      try {
        requireCsrf(request);
        const result = await auth.refresh(cookieValue(request, REFRESH_COOKIE));
        credentialsResponse(response, env, result);
      } catch (error) {
        next(error);
      }
    }) satisfies RequestHandler,
    logout: (async (request, response, next) => {
      try {
        requireCsrf(request);
        await auth.logout(cookieValue(request, REFRESH_COOKIE));
        response.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(env), maxAge: undefined });
        response.clearCookie(CSRF_COOKIE, { ...csrfCookieOptions(env), maxAge: undefined });
        sendData(response, { loggedOut: true });
      } catch (error) {
        next(error);
      }
    }) satisfies RequestHandler,
    logoutAll: (async (request, response, next) => {
      try {
        requireCsrf(request);
        const user = response.locals.user as SafeUser;
        await auth.logoutAll(user.id);
        response.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(env), maxAge: undefined });
        response.clearCookie(CSRF_COOKIE, { ...csrfCookieOptions(env), maxAge: undefined });
        sendData(response, { loggedOut: true });
      } catch (error) {
        next(error);
      }
    }) satisfies RequestHandler,
    me: ((_request, response) => {
      sendData(response, response.locals.user);
    }) satisfies RequestHandler,
  };
}
