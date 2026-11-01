import { brands, categories } from "../../database/schema/index.js";
import { Router } from "express";
import { z } from "zod";
import { sendData } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import { validateRequest } from "../../middlewares/validate-request.js";
import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import { type Database, idString, listQuery } from "./common.js";
import { createOperationsService } from "./operations.service.js";
import {
  bannerInput,
  voucherInput,
  bulkInput,
  staffInput,
  afterSalesInput,
  afterSalesUpdate,
  reportQuery,
  bannerPlacementsInput,
} from "./operations.schemas.js";
import { imageUpload, saveImages, spreadsheetUpload } from "./uploads.js";
import { createExcelService } from "./excel.service.js";
import { getReports } from "./reports.service.js";
const params = z.object({ id: idString });
export function createOperationsRouter(db: Database) {
  const router = Router(),
    s = createOperationsService(db),
    excel = createExcelService(db);
  router.post("/banners/uploads", imageUpload, async (req, res) =>
    sendData(res, await saveImages((req.files || []) as Express.Multer.File[]), 201),
  );
  router.post("/uploads", imageUpload, async (req, res) =>
    sendData(res, await saveImages((req.files || []) as Express.Multer.File[]), 201),
  );
  router.get("/products/references", async (_req, res) =>
    sendData(res, {
      categories: await db.select().from(categories),
      brands: (await db.select().from(brands)).map((b) => ({ ...b, id: b.id.toString() })),
    }),
  );
  router.post("/products/bulk", validateRequest({ body: bulkInput }), async (_req, res) =>
    sendData(res, await s.bulk(res.locals.validated.body, res.locals.user.id)),
  );
  router.get("/exports/:kind", async (req, res) => {
    const kind = z.enum(["products", "inventory", "orders", "template"]).parse(req.params.kind);
    const file = await excel.exportFile(kind);
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment(`technest-${kind}.xlsx`)
      .send(Buffer.from(file));
  });
  router.get("/imports", async (_req, res) =>
    sendData(res, await excel.listJobs(res.locals.user.id)),
  );
  router.post("/imports/preview", spreadsheetUpload, async (req, res) => {
    if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Chọn tệp .xlsx.");
    sendData(res, await excel.preview(req.file.buffer, req.file.originalname, res.locals.user.id));
  });
  router.post("/imports/:id/run", validateRequest({ params }), async (_req, res) =>
    sendData(res, await excel.runBatch(res.locals.validated.params.id, res.locals.user.id)),
  );
  router.get("/reports", validateRequest({ query: reportQuery }), async (_req, res) =>
    sendData(
      res,
      await getReports(db, res.locals.validated.query.dateFrom, res.locals.validated.query.dateTo),
    ),
  );
  router.get("/banners", validateRequest({ query: listQuery }), async (_req, res) =>
    sendData(res, await s.listBanners(res.locals.validated.query)),
  );
  router.get("/banners/placements", async (_req, res) =>
    sendData(res, await s.getBannerPlacements()),
  );
  router.get("/banners/:id", validateRequest({ params }), async (_req, res) =>
    sendData(res, await s.getBanner(res.locals.validated.params.id)),
  );
  router.put("/banners/placements", validateRequest({ body: bannerPlacementsInput }), async (_req, res) =>
    sendData(res, await s.saveBannerPlacements(res.locals.validated.body.placements)),
  );
  router.post("/banners", validateRequest({ body: bannerInput }), async (_req, res) =>
    sendData(res, await s.saveBanner(res.locals.validated.body), 201),
  );
  router.patch("/banners/:id", validateRequest({ params, body: bannerInput }), async (_req, res) =>
    sendData(res, await s.saveBanner(res.locals.validated.body, res.locals.validated.params.id)),
  );
  router.delete("/banners/:id", validateRequest({ params }), async (_req, res) =>
    sendData(res, await s.deleteBanner(res.locals.validated.params.id)),
  );
  router.get("/vouchers", validateRequest({ query: listQuery }), async (_req, res) =>
    sendData(res, await s.listVouchers(res.locals.validated.query)),
  );
  router.post("/vouchers", validateRequest({ body: voucherInput }), async (_req, res) =>
    sendData(res, await s.saveVoucher(res.locals.validated.body), 201),
  );
  router.patch(
    "/vouchers/:id",
    validateRequest({ params, body: voucherInput }),
    async (_req, res) =>
      sendData(res, await s.saveVoucher(res.locals.validated.body, res.locals.validated.params.id)),
  );
  router.get("/staff", validateRequest({ query: listQuery }), async (_req, res) =>
    sendData(res, await s.listStaff(res.locals.validated.query)),
  );
  router.post("/staff", validateRequest({ body: staffInput }), async (_req, res) =>
    sendData(res, await s.saveStaff(res.locals.validated.body, res.locals.user.id), 201),
  );
  router.patch("/staff/:id", validateRequest({ params, body: staffInput }), async (_req, res) =>
    sendData(
      res,
      await s.saveStaff(
        res.locals.validated.body,
        res.locals.user.id,
        res.locals.validated.params.id,
      ),
    ),
  );
  router.get("/audit", validateRequest({ query: listQuery }), async (_req, res) =>
    sendData(res, await s.listAudit(res.locals.validated.query)),
  );
  router.get("/emails", validateRequest({ query: listQuery }), async (_req, res) =>
    sendData(res, await s.listEmails(res.locals.validated.query)),
  );
  router.post("/emails/:id/retry", validateRequest({ params }), async (_req, res) =>
    sendData(res, await s.retryEmail(res.locals.validated.params.id), 201),
  );
  router.get("/after-sales", validateRequest({ query: listQuery }), async (_req, res) =>
    sendData(res, await s.listAfterSales(res.locals.validated.query)),
  );
  router.post("/after-sales", validateRequest({ body: afterSalesInput }), async (_req, res) =>
    sendData(res, await s.createAfterSales(res.locals.validated.body), 201),
  );
  router.patch(
    "/after-sales/:id",
    validateRequest({ params, body: afterSalesUpdate }),
    async (_req, res) =>
      sendData(
        res,
        await s.updateAfterSales(res.locals.validated.params.id, res.locals.validated.body),
      ),
  );
  return router;
}
export function createOperationsPublicRouter(db: Database, auth: AuthService) {
  const router = Router(),
    s = createOperationsService(db);
  const publicBannerQuery = z.object({ position: z.enum(["HOME_HERO", "HOME_HERO_RIGHT_TOP", "HOME_HERO_RIGHT_BOTTOM", "HOME_PROMO", "HOME_BOTTOM", "HOME_SETUP_STUDIO"]).optional() });
  router.get("/banners", validateRequest({ query: publicBannerQuery }), async (_req, res) =>
    sendData(res, await s.publicBanners(res.locals.validated.query.position)),
  );
  router.get(
    "/account/after-sales",
    authenticate(auth),
    validateRequest({ query: listQuery }),
    async (_req, res) =>
      sendData(res, await s.listAfterSales(res.locals.validated.query, res.locals.user.id)),
  );
  router.post(
    "/account/after-sales",
    authenticate(auth),
    validateRequest({ body: afterSalesInput }),
    async (_req, res) =>
      sendData(res, await s.createAfterSales(res.locals.validated.body, res.locals.user.id), 201),
  );
  return router;
}
