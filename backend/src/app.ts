import { createOperationsRouter, createOperationsPublicRouter } from "./modules/admin-operations/operations.routes.js";
import { uploadDirectory } from "./modules/admin-operations/uploads.js";
import { adminAudit } from "./modules/admin-operations/audit.js";
import { adminAccess } from "./modules/admin-operations/permissions.js";
import { authenticate } from "./modules/auth/auth.middleware.js";
import { createCheckoutRouter, createCustomerOrdersRouter, createAdminOrdersRouter } from "./modules/orders/orders.routes.js";
import type { OrdersService } from "./modules/orders/orders.service.js";
import type { OrderEventHub } from "./modules/orders/order-events.js";
import type { OrderStatusNotifier } from "./modules/orders/orders.controller.js";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import { createHealthRouter } from "./modules/health/health.routes.js";
import type { HealthDependencies } from "./modules/health/health.service.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFound } from "./middlewares/not-found.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import type { AuthService } from "./modules/auth/auth.service.js";
import type { Env } from "./config/env.js";
import type { RedisClientType } from "redis";
import { createCatalogRouter } from "./modules/catalog/catalog.routes.js";
import type { createCatalogService } from "./modules/catalog/catalog.service.js";
import {
  createAdminInventoryRouter,
  createPublicInventoryRouter,
} from "./modules/inventory/inventory.routes.js";
import type { InventoryService } from "./modules/inventory/inventory.service.js";
import { createAdminRouter } from "./modules/admin/admin.routes.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./database/schema/index.js";
import { createAccountRouter } from "./modules/account/account.routes.js";
import type { AccountService } from "./modules/account/account.service.js";
import { createNotificationsRouter } from "./modules/notifications/notifications.routes.js";
import type { NotificationsService } from "./modules/notifications/notifications.service.js";
import { createAdminNotificationsRouter } from "./modules/notifications/admin-notifications.routes.js";
import { createHomepageAdminRouter, createHomepagePublicRouter } from "./modules/homepage-cms/homepage-cms.routes.js";

interface AppOptions {
  orders?: { service: OrdersService; auth: AuthService; hub: OrderEventHub; notify: OrderStatusNotifier };
  logger: Logger;
  corsOrigin: string;
  health: HealthDependencies;
  auth?: { service: AuthService; env: Env; redis: RedisClientType };
  catalog?: ReturnType<typeof createCatalogService>;
  inventory?: { service: InventoryService; auth: AuthService };
  admin?: { db: NodePgDatabase<typeof schema>; auth: AuthService; notify?: Parameters<typeof createAdminRouter>[2] };
  account?: { service: AccountService; auth: AuthService; redis: RedisClientType; notify?: Parameters<typeof createAccountRouter>[3] };
  notifications?: { service: NotificationsService; auth: AuthService };
  publishNotification?: (recipientUserId: string, notification: NonNullable<Awaited<ReturnType<NotificationsService["createNotification"]>>>) => void;
}

export function createApp({ logger, corsOrigin, health, auth, catalog, inventory, admin, account, notifications, publishNotification, orders }: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    pinoHttp({
      logger,
      genReqId: (_request, response) => {
        const id = randomUUID();
        response.setHeader("X-Request-Id", id);
        return id;
      },
      serializers: {
        req: (request: { id: string; method: string; url: string }) => ({
          id: request.id,
          method: request.method,
          path: request.url.split("?")[0],
        }),
        res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
      },
    }),
  );
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use("/images/uploads", express.static(uploadDirectory, { maxAge: "7d", immutable: true, dotfiles: "deny" }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/v1/health", createHealthRouter(health));
  if (auth) app.use("/api/v1/auth", createAuthRouter(auth.service, auth.env, auth.redis));
  if (catalog) app.use("/api/v1", createCatalogRouter(catalog));
  if (admin) app.use("/api/v1/admin", authenticate(admin.auth), adminAccess(), adminAudit(admin.db));
  if (notifications && admin) app.use("/api/v1/admin/notifications", createAdminNotificationsRouter(notifications.service, admin.auth, publishNotification));
  if (inventory) {
    app.use("/api/v1/inventory", createPublicInventoryRouter(inventory.service));
    app.use(
      "/api/v1/admin/inventory",
      createAdminInventoryRouter(inventory.service, inventory.auth),
    );
  }
  if (admin) { app.use("/api/v1", createOperationsPublicRouter(admin.db, admin.auth)); app.use("/api/v1/admin", createOperationsRouter(admin.db)); }
  if (admin) {
    app.use("/api/v1/homepage", createHomepagePublicRouter(admin.db));
    app.use("/api/v1/admin/homepage", createHomepageAdminRouter(admin.db));
  }
  if (admin) app.use("/api/v1/admin", createAdminRouter(admin.db, admin.auth, admin.notify));
  if (account) app.use("/api/v1/account", createAccountRouter(account.service, account.auth, account.redis, account.notify));
  if (notifications) app.use("/api/v1/notifications", createNotificationsRouter(notifications.service, notifications.auth));
  if (orders) {
    app.use("/api/v1/checkout", createCheckoutRouter(orders.service, orders.auth));
    app.use("/api/v1/orders", createCustomerOrdersRouter(orders.service, orders.auth, orders.hub, orders.notify));
    app.use("/api/v1/admin/orders", createAdminOrdersRouter(orders.service, orders.auth, orders.hub, orders.notify));
  }
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
