import express, { Router } from "express";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { SeoService } from "./seo.service.js";
import { renderSeoDocument } from "./seo.render.js";
import { sendData } from "../../shared/response.js";
import { validateRequest } from "../../middlewares/validate-request.js";
import { authenticate } from "../auth/auth.middleware.js";
import { adminAccess } from "../admin-operations/permissions.js";
import type { AuthService } from "../auth/auth.service.js";
export const seoInput = z.object({
  title: z.string().trim().max(160).default(""),
  description: z.string().trim().max(500).default(""),
  socialImage: z
    .string()
    .trim()
    .max(1500)
    .refine(
      (value) => !value || /^\/(?!\/)[^<>"\s]*$/.test(value) || /^https:\/\/[^<>"\s]+$/.test(value),
      "Use a local image path or HTTPS URL",
    )
    .default(""),
  canonicalPath: z
    .string()
    .trim()
    .max(300)
    .refine(
      (value) => !value || /^\/(?!\/)[a-z0-9/?=&%-]*$/.test(value),
      "Use a same-site absolute path",
    )
    .default(""),
  noindex: z.boolean().default(false),
});
export function seoApiRouter(service: SeoService) {
  const router = Router();
  router.get(
    "/seo/page",
    validateRequest({
      query: z.object({ path: z.string().max(2000), metadata: z.enum(["0", "1"]).default("0") }),
    }),
    async (_req, res) => {
      res.set("Cache-Control", "no-store");
      const page = await service.page(res.locals.validated.query.path);
      sendData(
        res,
        res.locals.validated.query.metadata === "1" ? { ...page, content: undefined } : page,
      );
    },
  );
  return router;
}
export function seoAdminRouter(service: SeoService, auth: AuthService) {
  const router = Router();
  router.use(authenticate(auth), adminAccess());
  for (const kind of ["products", "categories", "brands", "pages"]) {
    const path = kind === "pages" ? "/settings/seo/:key" : `/${kind}/:key/seo`;
    const params = z.object({
      key:
        kind === "categories"
          ? z.string().uuid()
          : kind === "pages"
            ? z.enum(["home", "products", "flash-sale"])
            : z.string().regex(/^\d+$/),
    });
    router.get(path, validateRequest({ params }), async (_req, res) =>
      sendData(res, await service.repository.override(kind, res.locals.validated.params.key)),
    );
    router.patch(path, validateRequest({ params, body: seoInput }), async (_req, res) => {
      const saved = await service.repository.save(
        kind,
        res.locals.validated.params.key,
        res.locals.validated.body,
      );
      if (!saved) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Không tìm thấy nội dung." },
        });
        return;
      }
      sendData(res, await service.repository.override(kind, res.locals.validated.params.key));
    });
  }
  return router;
}
const fallbackTemplate =
  '<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>';
export function seoStorefrontRouter(service: SeoService, distDirectory: string) {
  const router = Router();
  const directory = resolve(distDirectory);
  router.use((req, res, next) => {
    if (
      service.config.environment === "production" &&
      service.config.enforceOrigin &&
      service.config.siteUrl
    ) {
      const origin = new URL(service.config.siteUrl);
      if (req.protocol !== origin.protocol.slice(0, -1) || req.get("host") !== origin.host) {
        res.redirect(308, origin.origin + req.originalUrl);
        return;
      }
      res.set("Strict-Transport-Security", "max-age=31536000");
    }
    next();
  });
  router.get("/robots.txt", (_req, res) =>
    res
      .type("text/plain")
      .set("X-Robots-Tag", "noindex")
      .set("Cache-Control", "no-store")
      .send(service.robots()),
  );
  router.get(["/sitemap.xml", "/sitemaps/:file"], async (req, res) => {
    const file = typeof req.params.file === "string" ? req.params.file : undefined;
    const match = file && /^(products|categories|brands)-(\d+)\.xml$/.exec(file);
    if (file && file !== "pages.xml" && !match) {
      res.status(404).end();
      return;
    }
    const page = match ? Number(match[2]) : 1;
    if (page < 1 || page > 100000) {
      res.status(404).end();
      return;
    }
    const xml = await service.sitemap(file === "pages.xml" ? "pages" : match?.[1], page);
    if (!xml) {
      res
        .status(service.indexing ? 404 : 503)
        .set("X-Robots-Tag", "noindex")
        .type("text/plain")
        .send(service.indexing ? "Not found" : "Sitemap disabled outside configured production");
      return;
    }
    res.type("application/xml").set("Cache-Control", "public, max-age=60").send(xml);
  });
  router.get("/index.html", (_req, res) => res.redirect(308, "/"));
  router.use(
    "/assets",
    express.static(join(directory, "assets"), {
      index: false,
      dotfiles: "deny",
      maxAge: "1y",
      immutable: true,
    }),
  );
  router.use(express.static(directory, { index: false, dotfiles: "deny", maxAge: 0 }));
  router.get("/{*path}", async (req, res, next) => {
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/images/") ||
      req.path.startsWith("/assets/") ||
      /\.[a-z0-9]+$/i.test(req.path)
    ) {
      next();
      return;
    }
    const page = await service.page(req.originalUrl);
    if (page.redirect) {
      res.redirect(page.status, page.redirect);
      return;
    }
    let template: string;
    try {
      template = await readFile(join(directory, "index.html"), "utf8");
    } catch {
      if (service.config.environment === "production") {
        res.status(503).type("text/plain").send("Storefront build unavailable");
        return;
      }
      template = fallbackTemplate;
    }
    res
      .status(page.status)
      .type("html")
      .set("Cache-Control", "no-store")
      .set("X-Robots-Tag", page.robots)
      .send(renderSeoDocument(template, page, service.config.verification));
  });
  return router;
}
