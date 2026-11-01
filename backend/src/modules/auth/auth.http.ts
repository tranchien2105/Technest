import type { Request } from "express";
import { AppError } from "../../shared/errors.js";

export const REFRESH_COOKIE = "technest_refresh";
export const CSRF_COOKIE = "technest_csrf";
export const AUTH_COOKIE_PATH = "/api/v1/auth";

function parseCookies(request: Request): Map<string, string> {
  const values = new Map<string, string>();
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    try {
      values.set(name, decodeURIComponent(part.slice(separator + 1).trim()));
    } catch {
      continue;
    }
  }
  return values;
}

export function cookieValue(request: Request, key: string) {
  return parseCookies(request).get(key);
}

export function requireCsrf(request: Request) {
  const cookie = cookieValue(request, CSRF_COOKIE);
  const header = request.get("x-csrf-token");
  if (!cookie || !header || cookie !== header) {
    throw new AppError(403, "CSRF_VALIDATION_FAILED", "A valid X-CSRF-Token header is required");
  }
}
