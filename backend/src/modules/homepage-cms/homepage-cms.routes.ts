import { Router } from "express";
import { eq } from "drizzle-orm";
import { homepageCms } from "../../database/schema/index.js";
import { validateRequest } from "../../middlewares/validate-request.js";
import { authorize } from "../auth/auth.middleware.js";
import { sendData } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import { type Database } from "../admin-operations/common.js";
import { homepageConfigSchema } from "./homepage-cms.schemas.js";

export function createHomepagePublicRouter(db: Database) {
  const router = Router();
  router.get("/config", async (_request, response) => {
    const [row] = await db.select({ published: homepageCms.published }).from(homepageCms).where(eq(homepageCms.id, 1)).limit(1);
    if (!row) throw new AppError(503, "HOMEPAGE_CONFIG_UNAVAILABLE", "Cấu hình trang chủ chưa sẵn sàng.");
    const parsed = homepageConfigSchema.safeParse(row.published);
    if (!parsed.success) throw new AppError(503, "HOMEPAGE_CONFIG_INVALID", "Cấu hình trang chủ không hợp lệ.");
    return sendData(response, parsed.data);
  });
  return router;
}

export function createHomepageAdminRouter(db: Database) {
  const router = Router();
  router.use(authorize("ADMIN"));
  router.get("/", async (_request, response) => {
    const [row] = await db.select().from(homepageCms).where(eq(homepageCms.id, 1)).limit(1);
    if (!row) throw new AppError(503, "HOMEPAGE_CONFIG_UNAVAILABLE", "Cấu hình trang chủ chưa sẵn sàng.");
    return sendData(response, { draft: row.draft, published: row.published, publishedAt: row.publishedAt, updatedAt: row.updatedAt });
  });
  router.patch("/draft", validateRequest({ body: homepageConfigSchema }), async (_request, response) => {
    const config = response.locals.validated.body;
    const [row] = await db.update(homepageCms).set({ draft: config, updatedBy: response.locals.user.id, updatedAt: new Date() }).where(eq(homepageCms.id, 1)).returning({ draft: homepageCms.draft, publishedAt: homepageCms.publishedAt, updatedAt: homepageCms.updatedAt });
    if (!row) throw new AppError(503, "HOMEPAGE_CONFIG_UNAVAILABLE", "Chưa có cấu hình trang chủ.");
    return sendData(response, row);
  });
  router.post("/publish", async (_request, response) => {
    const [current] = await db.select({ draft: homepageCms.draft }).from(homepageCms).where(eq(homepageCms.id, 1)).limit(1);
    if (!current) throw new AppError(503, "HOMEPAGE_CONFIG_UNAVAILABLE", "Chưa có cấu hình trang chủ.");
    const parsed = homepageConfigSchema.safeParse(current.draft);
    if (!parsed.success) throw new AppError(400, "HOMEPAGE_CONFIG_INVALID", "Bản nháp không hợp lệ.");
    const now = new Date();
    const [row] = await db.update(homepageCms).set({ published: parsed.data, updatedBy: response.locals.user.id, updatedAt: now, publishedAt: now }).where(eq(homepageCms.id, 1)).returning({ published: homepageCms.published, publishedAt: homepageCms.publishedAt });
    return sendData(response, row);
  });
  return router;
}
