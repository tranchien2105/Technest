import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import express from "express";
import request from "supertest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "../src/config/env.js";
import * as schema from "../src/database/schema/index.js";
import { createCatalogService } from "../src/modules/catalog/catalog.service.js";
import { createSeoRepository } from "../src/modules/seo/seo.repository.js";
import { createSeoService, type SeoService } from "../src/modules/seo/seo.service.js";
import {
  seoStorefrontRouter,
  seoAdminRouter,
  seoApiRouter,
} from "../src/modules/seo/seo.routes.js";
import { errorHandler } from "../src/middlewares/error-handler.js";
import { createLogger } from "../src/config/logger.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import { AppError } from "../src/shared/errors.js";
const run = process.env.RUN_SEO_DB_TESTS === "1";
describe.runIf(run)("SEO HTTP with actual PostgreSQL (rollback fixtures)", () => {
  let pool: Pool,
    client: PoolClient,
    service: SeoService,
    dev: SeoService,
    app: express.Express,
    dir: string;
  let productId: string, variantId: string, campaignId: string, categoryId: string, brandId: string;
  const suffix = Date.now().toString(36),
    slug = `seo-verification-${suffix}`,
    brand = `seo-brand-${suffix}`,
    category = `seo-category-${suffix}`;
  const auth = {
    authenticate: async (token?: string) => {
      if (!token) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
      return {
        id: 1,
        email: "seo@example.test",
        role: token === "admin" ? "ADMIN" : token === "reader" ? "STAFF" : "CUSTOMER",
        permissions: token === "reader" ? ["products:read"] : [],
        status: "ACTIVE",
      };
    },
  } as unknown as AuthService;
  beforeAll(async () => {
    const env = loadEnv();
    if (!["development", "test"].includes(env.NODE_ENV)) throw new Error("Development only");
    pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
    client = await pool.connect();
    if ((await client.query("select current_database() db")).rows[0].db !== "technest_dev")
      throw new Error("Wrong database");
    await client.query("begin");
    await client.query("SET LOCAL statement_timeout='10000ms'");
    brandId = (
      await client.query("insert into brands(name,slug) values($1,$2) returning id::text", [
        `SEO verification ${suffix}`,
        brand,
      ])
    ).rows[0].id;
    categoryId = (
      await client.query("insert into categories(name,slug) values($1,$2) returning id", [
        `SEO verification ${suffix}`,
        category,
      ])
    ).rows[0].id;
    productId = (
      await client.query(
        `insert into products(name,slug,description,category_id,brand_id,price,status) values($1,$2,'Nội dung kiểm chứng HTTP SEO trong transaction rollback.',$3,$4,1000000,'ACTIVE') returning id::text`,
        ["SEO verification keyboard", slug, categoryId, brandId],
      )
    ).rows[0].id;
    variantId = (
      await client.query(
        `insert into product_variants(product_id,sku,name,price,status) values($1,$2,'Standard',1000000,'ACTIVE') returning id::text`,
        [productId, slug],
      )
    ).rows[0].id;
    await client.query("insert into seo_product_redirects(old_slug,product_id) values($1,$2)", [
      slug + "-old",
      productId,
    ]);
    await client.query("insert into inventories(variant_id,on_hand,reserved) values($1,10,2)", [
      variantId,
    ]);
    await client.query(
      "insert into product_images(product_id,url,alt_text) values($1,'/seo-social.png','Keyboard')",
      [productId],
    );
    await client.query(
      `insert into products(name,slug,category_id,brand_id,price,status,attributes) values('Private item',$1,$2,$3,1,'INACTIVE','{}'),('Illustrative item',$4,$2,$3,1,'ACTIVE','{"seedBatch":"seo-verification"}')`,
      [slug + "-hidden", categoryId, brandId, slug + "-demo"],
    );
    campaignId = (
      await client.query(
        `insert into flash_sale_campaigns(name,slug,starts_at,ends_at,status) values('SEO verification',$1,now()-interval '1 hour',now()+interval '1 hour','ACTIVE') returning id::text`,
        [slug],
      )
    ).rows[0].id;
    await client.query(
      `insert into flash_sale_items(campaign_id,product_id,variant_id,original_price_snapshot,flash_price,quota,per_customer_limit) values($1,$2,$3,1000000,800000,10,1)`,
      [campaignId, productId, variantId],
    );
    const repo = createSeoRepository(client),
      catalog = createCatalogService(drizzle(client, { schema }));
    service = createSeoService(repo, catalog, {
      environment: "production",
      siteUrl: "https://shop.example.test",
      indexingEnabled: true,
    });
    dev = createSeoService(repo, catalog, { environment: "development", indexingEnabled: false });
    dir = await mkdtemp(join(tmpdir(), "technest-seo-"));
    await writeFile(
      join(dir, "index.html"),
      '<!doctype html><html lang="vi"><head><title>Old</title></head><body><div id="root"></div><script type="module" src="/assets/main.js"></script></body></html>',
    );
    app = express();
    app.use(express.json());
    app.use("/api/v1", seoApiRouter(service));
    app.use("/api/v1/admin", seoAdminRouter(service, auth));
    app.use(seoStorefrontRouter(service, dir));
    app.use((_req, res) => res.status(404).json({ error: "Not found" }));
    app.use(errorHandler(createLogger("silent")));
  }, 30000);
  afterAll(async () => {
    if (client) {
      await client.query("rollback");
      client.release();
    }
    if (pool) await pool.end();
    if (dir) await rm(dir, { recursive: true, force: true });
  });
  const productSchema = (html: string) =>
    JSON.parse(
      /<script data-seo type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]!,
    )["@graph"].find((x: Record<string, unknown>) => x["@type"] === "Product");
  it("serves unique homepage HTML metadata, Organization and WebSite before JS", async () => {
    const r = await request(app).get("/").expect(200);
    expect(r.text).toContain('name="description"');
    expect(r.text).toContain('"@type":"Organization"');
    expect(r.text).toContain('"@type":"WebSite"');
    expect(r.text).toContain("<h1>");
  });
  it("serves unique product metadata, OG/Twitter, breadcrumb and live offer in HTML", async () => {
    const r = await request(app).get(`/products/${slug}`).expect(200);
    expect(r.text).toContain("SEO verification keyboard | Technest");
    expect(r.text).toContain(
      'property="og:image" content="https://shop.example.test/seo-social.png"',
    );
    expect(r.text).toContain('name="twitter:card"');
    expect(r.text).toContain('"@type":"BreadcrumbList"');
    expect(productSchema(r.text).offers).toMatchObject({
      price: "800000",
      priceCurrency: "VND",
      availability: "https://schema.org/InStock",
    });
    expect(r.headers["cache-control"]).toBe("no-store");
  });
  it("does not advertise a Flash Sale offer when physical stock is unavailable", async () => {
    await client.query("update inventories set on_hand=2 where variant_id=$1", [variantId]);
    const page = await service.page(`/products/${slug}`);
    expect(page.schemas.find((item) => item["@type"] === "Product")?.offers).toMatchObject({
      price: "1000000",
      availability: "https://schema.org/OutOfStock",
    });
    await client.query("update inventories set on_hand=10 where variant_id=$1", [variantId]);
  });
  it("redirects numeric legacy products, trailing slashes and legacy category queries", async () => {
    await request(app)
      .get(`/products/${productId}`)
      .expect(308)
      .expect("Location", `/products/${slug}`);
    await request(app)
      .get(`/products/${slug}-old`)
      .expect(308)
      .expect("Location", `/products/${slug}`);
    await request(app).get(`/products/${slug}/`).expect(308);
    await request(app)
      .get(`/products?category=${category}&page=2`)
      .expect(308)
      .expect("Location", `/categories/${category}?page=2`);
  });
  it("returns HTTP 404 for missing, unpublished and unknown routes without homepage soft 404", async () => {
    for (const path of [
      `/products/${slug}-missing`,
      `/products/${slug}-hidden`,
      "/not-a-real-route",
    ]) {
      const r = await request(app).get(path).expect(404);
      expect(r.text).toContain("noindex");
    }
  });
  it("renders category and brand metadata with collection schema", async () => {
    for (const path of [`/categories/${category}`, `/brands/${brand}`]) {
      const r = await request(app).get(path).expect(200);
      expect(r.text).toContain('"@type":"CollectionPage"');
      expect(r.text).toContain(`https://shop.example.test${path}`);
    }
  });
  it("keeps pagination self-canonical and facets noindex", async () => {
    const p = await service.page("/products?page=2");
    expect(p.canonical).toBe("https://shop.example.test/products?page=2");
    expect(p.status).toBe(200);
    expect((await service.page("/products?sort=priceLow")).robots).toContain("noindex");
    expect((await service.page("/search?q=keyboard")).robots).toContain("noindex");
    expect((await service.page(`/categories/${category}?page=999`)).status).toBe(404);
  });
  it("omits offers and indexing for demo data and excludes demo/unpublished/admin sitemap URLs", async () => {
    expect((await service.page(`/products/${slug}-demo`)).robots).toContain("noindex");
    const xml = await service.sitemap("products", 1);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(slug);
    expect(xml).not.toContain(slug + "-demo");
    expect(xml).not.toContain(slug + "-hidden");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/account");
    const index = await request(app).get("/sitemap.xml").expect(200);
    expect(index.text).toContain("/sitemaps/products-1.xml");
    await request(app).get("/sitemaps/pages.xml").expect(200);
    await request(app).get("/sitemaps/nonsense.xml").expect(404);
  });
  it("has production robots sitemap and dev/staging noindex without localhost canonicals/sitemaps", async () => {
    expect(service.robots()).toContain("Sitemap: https://shop.example.test/sitemap.xml");
    expect(service.robots()).not.toContain("Disallow: /assets");
    for (const path of ["/", "/account", "/checkout", "/admin"])
      expect((await dev.page(path)).robots).toContain("noindex");
    expect((await dev.page("/")).canonical).toBeNull();
    expect(await dev.sitemap()).toBeNull();
    expect(dev.robots()).toBe("User-agent: *\nDisallow: /\n");
  });
  it("protects SEO admin endpoints with existing RBAC", async () => {
    const path = `/api/v1/admin/products/${productId}/seo`;
    await request(app).patch(path).send({ title: "Unauthorized" }).expect(401);
    await request(app)
      .patch(path)
      .set("Authorization", "Bearer customer")
      .send({ title: "Unauthorized" })
      .expect(403);
    await request(app)
      .patch(path)
      .set("Authorization", "Bearer reader")
      .send({ title: "Unauthorized" })
      .expect(403);
    await request(app).get(path).set("Authorization", "Bearer reader").expect(200);
    await request(app)
      .patch(path)
      .set("Authorization", "Bearer admin")
      .send({ title: "Custom product SEO", description: "Custom verified description" })
      .expect(200);
    expect((await service.page(`/products/${slug}`)).title).toBe("Custom product SEO");
  });
  it("excludes explicit noindex/canonical overrides and leaves API unknown routes as API 404", async () => {
    await service.repository.save("products", productId, {
      title: "",
      description: "",
      socialImage: "",
      canonicalPath: "",
      noindex: true,
    });
    expect((await service.sitemap("products", 1)) || "").not.toContain(`/products/${slug}</loc>`);
    const r = await request(app).get("/api/v1/unknown").expect(404);
    expect(r.type).toContain("json");
  });
  it("revalidates flash expiry and out-of-stock offer rather than serving stale discount", async () => {
    await service.repository.save("products", productId, {
      title: "",
      description: "",
      socialImage: "",
      canonicalPath: "",
      noindex: false,
    });
    await client.query(
      "update flash_sale_campaigns set ends_at=now()-interval '1 second' where id=$1",
      [campaignId],
    );
    await client.query("update inventories set on_hand=2 where variant_id=$1", [variantId]);
    const r = await request(app).get(`/products/${slug}`).expect(200);
    expect(productSchema(r.text).offers).toMatchObject({
      price: "1000000",
      availability: "https://schema.org/OutOfStock",
    });
  });
  it("returns the same public HTML to browsers and crawlers", async () => {
    const browser = await request(app)
      .get(`/products/${slug}`)
      .set("User-Agent", "Mozilla/5.0")
      .expect(200);
    const crawler = await request(app)
      .get(`/products/${slug}`)
      .set("User-Agent", "Googlebot")
      .expect(200);
    expect(crawler.text).toBe(browser.text);
  });
  it("applies page SEO noindex to sitemap entries and supports metadata-only requests", async () => {
    await service.repository.save("pages", "home", {
      title: "",
      description: "",
      socialImage: "",
      canonicalPath: "",
      noindex: true,
    });
    expect(await service.sitemap("pages")).not.toContain("https://shop.example.test/</loc>");
    await service.repository.save("pages", "home", {
      title: "",
      description: "",
      socialImage: "",
      canonicalPath: "",
      noindex: false,
    });
    const response = await request(app)
      .get("/api/v1/seo/page")
      .query({ path: `/products/${slug}`, metadata: "1" })
      .expect(200);
    expect(response.body.data.content).toBeUndefined();
    expect(
      response.body.data.schemas.some(
        (item: Record<string, unknown>) => item["@type"] === "Product",
      ),
    ).toBe(true);
  });
  it("enforces the configured HTTPS host only with explicitly trusted proxy settings", async () => {
    const strict = createSeoService(
      createSeoRepository(client),
      createCatalogService(drizzle(client, { schema })),
      {
        environment: "production",
        siteUrl: "https://shop.example.test",
        indexingEnabled: true,
        enforceOrigin: true,
        proxyHops: 1,
      },
    );
    const proxyApp = express();
    proxyApp.set("trust proxy", 1);
    proxyApp.use(seoStorefrontRouter(strict, dir));
    await request(proxyApp)
      .get("/robots.txt")
      .expect(308)
      .expect("Location", "https://shop.example.test/robots.txt");
    await request(proxyApp)
      .get("/robots.txt")
      .set("Host", "shop.example.test")
      .set("X-Forwarded-Proto", "https")
      .expect(200);
    const staging = createSeoService(
      createSeoRepository(client),
      createCatalogService(drizzle(client, { schema })),
      {
        environment: "production",
        siteUrl: "https://staging.example.test",
        indexingEnabled: false,
      },
    );
    expect((await staging.page("/")).robots).toContain("noindex");
    expect(await staging.sitemap()).toBeNull();
    expect(staging.robots()).toContain("Allow: /");
    expect(service.robots()).not.toContain("Disallow: /admin");
  });
  it("keeps variant canonicals stable and schedules refresh for future Flash Sale", async () => {
    const variant = (
      await client.query(
        "insert into product_variants(product_id,sku,name,price,status) values($1,$2,'Alternate',1200000,'ACTIVE') returning id::text",
        [productId, slug + "-alternate"],
      )
    ).rows[0].id;
    await client.query("insert into inventories(variant_id,on_hand,reserved) values($1,0,0)", [
      variant,
    ]);
    await client.query("insert into product_images(product_id,variant_id,url,alt_text) values($1,$2,'/images/alternate-keyboard.png','Alternate keyboard')", [productId, variant]);
    const page = await service.page(`/products/${slug}?variant=${variant}&utm_source=test`);
    expect(page.image).toBe("https://shop.example.test/images/alternate-keyboard.png");
    expect(page.content).toContain('alt="Alternate keyboard"');
    expect(page.canonical).toBe(`https://shop.example.test/products/${slug}`);
    const offers = page.schemas.find((item) => item["@type"] === "Product")?.offers;
    expect(offers).toMatchObject({
      price: "1200000",
      availability: "https://schema.org/OutOfStock",
    });
    await client.query(
      "update flash_sale_campaigns set starts_at=now()+interval '1 hour',ends_at=now()+interval '2 hours',status='SCHEDULED' where id=$1",
      [campaignId],
    );
    const upcoming = await service.page(`/products/${slug}`);
    expect(upcoming.schemas.find((item) => item["@type"] === "Product")?.offers).toMatchObject({
      price: "1000000",
    });
    expect(new Date(upcoming.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });
});
