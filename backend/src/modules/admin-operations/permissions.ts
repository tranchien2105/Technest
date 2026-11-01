import type { RequestHandler } from "express";
import type { SafeUser } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors.js";

export const permissionScopes = [
  "dashboard",
  "products",
  "catalog",
  "inventory",
  "orders",
  "customers",
  "settings",
  "banners",
  "vouchers",
  "reports",
  "after-sales",
  "emails",
  "audit",
] as const;
export const permissionKeys = permissionScopes.flatMap((scope) => [
  `${scope}:read`,
  ...(scope === "reports" || scope === "audit" || scope === "dashboard" ? [] : [`${scope}:write`]),
]);
export function canAccess(
  user: Pick<SafeUser, "role" | "permissions">,
  scope: string,
  write = false,
) {
  return (
    user.role === "ADMIN" ||
    (user.role === "STAFF" &&
      (user.permissions?.includes(`${scope}:write`) ||
        (!write && user.permissions?.includes(`${scope}:read`))))
  );
}
export function adminAccess(): RequestHandler {
  return (request, response, next) => {
    const user = response.locals.user as SafeUser | undefined;
    const resource =
      request.originalUrl
        .split("?")[0]!
        .replace(/^\/api\/v1\/admin\/?/, "")
        .split("/")[0] || "overview";
    const scopes: Record<string, string> = {
      overview: "dashboard",
      products: "products",
      uploads: "products",
      imports: "products",
      exports: "reports",
      categories: "catalog",
      brands: "catalog",
      inventory: "inventory",
      orders: "orders",
      customers: "customers",
      settings: "settings",
      banners: "banners",
      vouchers: "vouchers",
      reports: "reports",
      "after-sales": "after-sales",
      emails: "emails",
      audit: "audit",
    };
    const exportKind =
      resource === "exports" ? request.originalUrl.split("?")[0]!.split("/").pop() : undefined;
    const exportScope =
      exportKind === "template" || exportKind === "products"
        ? "products"
        : exportKind === "orders"
          ? "orders"
          : exportKind === "inventory"
            ? "inventory"
            : undefined;
    if (
      !user ||
      !(
        (exportKind && canAccess(user, "reports")) ||
        canAccess(
          user,
          exportScope || scopes[resource] || "staff",
          !["GET", "HEAD"].includes(request.method),
        )
      )
    )
      return next(
        new AppError(403, "FORBIDDEN", "Bạn chưa được cấp quyền thực hiện thao tác này."),
      );
    next();
  };
}
