import type { RequestHandler } from "express";
import type { AuthService, SafeUser } from "./auth.service.js";
import { AppError } from "../../shared/errors.js";

export function authenticate(auth: AuthService): RequestHandler {
  return async (request, response, next) => {
    const header = request.get("authorization");
    const match = header?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
    try {
      response.locals.user = await auth.authenticate(match?.[1]);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorize(...roles: SafeUser["role"][]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.user as SafeUser | undefined;
    if (!user || !roles.includes(user.role)) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to access this resource"));
      return;
    }
    next();
  };
}
