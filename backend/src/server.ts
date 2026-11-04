import {fileURLToPath} from "node:url";
import {createSeoRepository} from "./modules/seo/seo.repository.js";
import {createSeoService} from "./modules/seo/seo.service.js";
import { Server } from "socket.io";
import { createOrdersService } from "./modules/orders/orders.service.js";
import { createOrderEventHub } from "./modules/orders/order-events.js";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createDatabase } from "./config/database.js";
import { createRedis } from "./config/redis.js";
import { createLogger } from "./config/logger.js";
import { createAuthRepository } from "./modules/auth/auth.repository.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { createCatalogService } from "./modules/catalog/catalog.service.js";
import { createInventoryService } from "./modules/inventory/inventory.service.js";
import { createTransactionalEmailRuntime } from "./modules/email/email.runtime.js";
import { createAccountService } from "./modules/account/account.service.js";
import { createNotificationsService } from "./modules/notifications/notifications.service.js";
import { createFlashSalesService } from "./modules/flash-sales/flash-sales.service.js";

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const { pool, db } = createDatabase(env.DATABASE_URL);
const redis = createRedis(env.REDIS_URL);
const inventoryService = createInventoryService(db);
const authService = createAuthService(createAuthRepository(db), env.AUTH_JWT_SECRET);
const emailRuntime = createTransactionalEmailRuntime(db, env, logger);
const notificationsService = createNotificationsService(db);
const flashSales = createFlashSalesService(db, (event, payload) => io?.to("public:flash-sales").emit(event, payload), redis);
const ordersService = createOrdersService(db, (itemId) => flashSales.notifyItemUpdated(itemId));
pool.on("error", () => logger.error("Unexpected PostgreSQL pool error"));
redis.on("error", () => logger.error("Redis connection error"));
const hub = createOrderEventHub();
const notify = (payload: { userId: string; orderId: string; orderNumber: string; status: string; updatedAt: string; notification?: Awaited<ReturnType<typeof notificationsService.createNotification>> }) => {
  const { userId, notification, ...event } = payload;
  hub.publish(userId, event);
  io?.to(`user:${userId}`).to("admin:orders").emit("order:status-updated", event);
  if (notification) {
    publishNotification(userId, notification);
  }
};
const publishNotification = (userId: string, notification: NonNullable<Awaited<ReturnType<typeof notificationsService.createNotification>>>) => {
  io?.to(`user:${userId}`).emit("notification:new", notification);
  void notificationsService.getUnreadCount(Number(userId)).then((unreadCount) => {
    io?.to(`user:${userId}`).emit("notification:unread-count", { unreadCount });
  }).catch(() => logger.warn("Could not publish notification unread count"));
};
const catalogService=createCatalogService(db);
const seoService=createSeoService(createSeoRepository(pool),catalogService,{enforceOrigin:env.SEO_ENFORCE_ORIGIN,proxyHops:env.SEO_TRUST_PROXY_HOPS,environment:env.NODE_ENV,siteUrl:env.SEO_SITE_URL,indexingEnabled:env.SEO_INDEXING_ENABLED,verification:env.SEO_GOOGLE_VERIFICATION});
const app = createApp({
  seo:{service:seoService,distDirectory:env.STOREFRONT_DIST||fileURLToPath(new URL("../../dist",import.meta.url))},
  orders: { service: ordersService, auth: authService, hub, notify },
  logger,
  corsOrigin: env.CORS_ORIGIN,
  health: {
    postgres: () => pool.query("SELECT 1"),
    redis: () => redis.ping(),
    isReady: () => !stopping,
  },
  auth: {
    service: authService,
    env,
    redis,
  },
  catalog: catalogService,
  inventory: {
    service: inventoryService,
    auth: authService,
  },
  account: { service: createAccountService(db), auth: authService, redis, notify: publishNotification },
  notifications: { service: notificationsService, auth: authService },
  flashSales,
  publishNotification,
  admin: { db, auth: authService, notify: publishNotification },
});
const server = createServer(app);
const io = new Server(server, { cors: { origin: env.CORS_ORIGIN, credentials: true } });
io.use(async (socket, next) => {
  try {
    const token: unknown = socket.handshake.auth.token;
    socket.data.user = typeof token === "string" ? await authService.authenticate(token) : null;
    next();
  } catch { next(new Error("UNAUTHENTICATED")); }
});
io.on("connection", (socket) => {
  const user = socket.data.user;
  if (!user) { void socket.join("public:flash-sales"); return; }
  void socket.join(`user:${user.id}`);
  if (user.role === "ADMIN" || (user.role === "STAFF" && (user.permissions?.includes("orders:read") || user.permissions?.includes("orders:write")))) void socket.join("admin:orders");
  const expiry = setTimeout(() => socket.disconnect(true), 60_000);
  expiry.unref();
  socket.on("disconnect", () => clearTimeout(expiry));
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
let stopping = false;
let reservationExpiryWorker: NodeJS.Timeout | undefined;
let flashSaleScheduleWorker: NodeJS.Timeout | undefined;

async function shutdown(reason: string, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  logger.info({ reason }, "Shutting down");
  if (reservationExpiryWorker) clearInterval(reservationExpiryWorker);
  if (flashSaleScheduleWorker) clearInterval(flashSaleScheduleWorker);
  const deadline = setTimeout(() => {
    logger.error("Shutdown timed out");
    process.exit(1);
  }, 10000);
  deadline.unref();
  try {
    let failed = false;
    await emailRuntime.close();
    io?.disconnectSockets(true);
    io?.engine.close();
    if (server.listening) {
      try {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeIdleConnections();
        });
      } catch {
        failed = true;
      }
    }
    const results = await Promise.allSettled([
      pool.end(),
      redis.isOpen ? redis.close() : Promise.resolve(),
    ]);
    process.exitCode =
      failed || results.some((result) => result.status === "rejected") ? 1 : exitCode;
  } finally {
    clearTimeout(deadline);
  }
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("uncaughtException", () => {
  logger.fatal("Uncaught exception");
  void shutdown("uncaughtException", 1);
});
process.once("unhandledRejection", () => {
  logger.fatal("Unhandled rejection");
  void shutdown("unhandledRejection", 1);
});
server.on("error", () => {
  logger.error("HTTP server failed to start");
  void shutdown("serverError", 1);
});

try {
  await pool.query("SELECT 1");
  if (!stopping) await redis.connect();
  if (!stopping) {
    await emailRuntime.start();
    const expireReservations = async () => {
      try {
        const expiredCount = await inventoryService.expireReservations();
        if (expiredCount > 0)
          logger.info({ expiredCount }, "Expired inventory reservations released");
        const expiredFlashSaleOrders = await ordersService.expireFlashSaleOrders();
        for (const event of expiredFlashSaleOrders) notify(event);
      } catch {
        logger.error("Inventory reservation expiry worker failed");
      }
    };
    await expireReservations();
    reservationExpiryWorker = setInterval(() => void expireReservations(), 60_000);
    reservationExpiryWorker.unref();
    flashSaleScheduleWorker = setInterval(() => void flashSales.announceTimeTransitions().catch(() => logger.warn("Flash Sale schedule event check failed")), 5_000);
    flashSaleScheduleWorker.unref();
    await flashSales.announceTimeTransitions();
    server.listen(env.PORT, env.HOST, () =>
      logger.info({ host: env.HOST, port: env.PORT }, "Technest API listening"),
    );
  }
} catch {
  logger.error("Dependency connection failed during startup");
  await shutdown("startupError", 1);
}
