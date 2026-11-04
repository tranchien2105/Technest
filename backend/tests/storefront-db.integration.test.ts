import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDatabase } from "../src/config/database.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/config/logger.js";
import { createCatalogService } from "../src/modules/catalog/catalog.service.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import { createApp } from "../src/app.js";
import { CURATED_PRODUCTS, ROOT_BRANDS, ROOTS, STOREFRONT_BATCH } from "../src/database/seeds/storefront-demo-data.js";

type Item = {id:string; slug:string; name:string; price:string; status:string; category:{slug:string}; brand?:{slug:string}; isTrending:boolean};
describe.skipIf(process.env.RUN_STOREFRONT_DB_TESTS !== "1")("storefront batch: actual development PostgreSQL/API", () => {
  let database: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof createApp>;
  const evidence: Record<string, unknown> = { auth: "ADMIN identity fixture; actual PostgreSQL; not an auth test", requests: [] };
  const get = async (path: string, status = 200) => {
    const start = performance.now();
    const response = await request(app).get(`/api/v1/${path}`).set("Authorization", "Bearer development-read-test").expect(status);
    (evidence.requests as unknown[]).push({ path, durationMs: Number((performance.now()-start).toFixed(2)), status: response.status });
    return response.body.data;
  };
  beforeAll(() => {
    const env = loadEnv();
    if (env.NODE_ENV === "production" || new URL(env.DATABASE_URL).pathname !== "/technest_dev") throw new Error("Confirmed development DB required");
    database = createDatabase(env.DATABASE_URL, { statement_timeout: 10000, query_timeout: 12000 });
    const auth = { authenticate: async () => ({ id:1,email:"admin@example.test",fullName:"Admin",role:"ADMIN",status:"ACTIVE" }) } as unknown as AuthService;
    app = createApp({ logger:createLogger("silent"),corsOrigin:env.CORS_ORIGIN,health:{postgres:async()=>1,redis:async()=>"PONG"},catalog:createCatalogService(database.db),admin:{db:database.db,auth} });
  });
  afterAll(async () => {
    if (!database) return;
    const {rows}=await database.pool.query("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM products WHERE status='ACTIVE' ORDER BY created_at DESC,id DESC LIMIT 24");
    evidence.queryPlan=rows[0];
    await writeFile(fileURLToPath(new URL("../../docs/technest-large-seed-api-verification.json",import.meta.url)),JSON.stringify(evidence,null,2));
    await database.pool.end();
  });
  it("confirms the low-quality batch is removed and curated records have valid relations", async () => {
    const {rows} = await database.pool.query("select (select count(*)::int from products where attributes->>'seedBatch'='tn-large-20261102') old_products, (select count(*)::int from brands where slug like 'tn-large-20261102-%') old_brands, (select count(*)::int from products where attributes->>'seedBatch'=$1) products, (select count(distinct p.brand_id)::int from products p where p.attributes->>'seedBatch'=$1) linked_brands, (select count(*)::int from products p join brands b on b.id=p.brand_id where p.attributes->>'seedBatch'=$1 and b.name ilike '%demo%') demo_brands, (select count(*)::int from products p where p.attributes->>'seedBatch'=$1 and (p.name ilike '%willow%' or p.name ilike '%demo%')) contaminated_products, (select count(*)::int from product_variants pv join products p on p.id=pv.product_id where p.attributes->>'seedBatch'=$1) variants, (select count(*)::int from product_images pi join products p on p.id=pi.product_id where p.attributes->>'seedBatch'=$1) images, (select count(*)::int from inventories i join product_variants v on v.id=i.variant_id join products p on p.id=v.product_id where p.attributes->>'seedBatch'=$1) inventories", [STOREFRONT_BATCH]);
    expect(rows[0].old_products).toBe(0);
    expect(rows[0].old_brands).toBe(0);
    expect(rows[0].products).toBe(CURATED_PRODUCTS.length);
    expect(rows[0].linked_brands).toBeGreaterThan(25);
    expect(rows[0].demo_brands).toBe(0);
    expect(rows[0].contaminated_products).toBe(0);
    expect(rows[0].variants).toBe(CURATED_PRODUCTS.length);
    expect(rows[0].images).toBe(CURATED_PRODUCTS.length);
    expect(rows[0].inventories).toBe(CURATED_PRODUCTS.length);
    const duplicateModels = await database.pool.query("select count(*)::int n from products p join products old on lower(old.name)=lower(p.name) and old.id<>p.id where p.attributes->>'seedBatch'=$1", [STOREFRONT_BATCH]);
    expect(duplicateModels.rows[0].n).toBe(0);
    const elgato = await database.pool.query("select b.name,c.slug from products p join brands b on b.id=p.brand_id join categories c on c.id=p.category_id where p.attributes->>'seedBatch'=$1 and p.name='Elgato Stream Deck MK.2'", [STOREFRONT_BATCH]);
    expect(elgato.rows[0]).toMatchObject({ name: "ELGATO", slug: "streaming" });
    const {rows: brands}=await database.pool.query("select slug from brands where slug = any($1::text[])",[[...new Set(ROOTS.flatMap((root)=>ROOT_BRANDS[root]))]]);
    expect(brands.length).toBeGreaterThan(30);
  });
  it("matches SQL newest ten and paginates without duplicates",async()=>{
    const {rows}=await database.pool.query("select id::text,slug from products where status='ACTIVE' order by created_at desc,id desc limit 10");
    const first=await get("products?limit=10"),second=await get("products?limit=10&page=2");
    expect(first.items.map((item:Item)=>item.id)).toEqual(rows.map((row)=>row.id));
    expect(first.items.every((item:Item)=>item.slug.startsWith(STOREFRONT_BATCH)&&item.status==="ACTIVE")).toBe(true);
    expect(second.items.some((item:Item)=>rows.some((row)=>row.id===item.id))).toBe(false);
    evidence.newestTenSQL=rows;evidence.newestTenAPI=first.items.map((item:Item)=>({id:item.id,name:item.name}));
  });
  it("preserves category/brand filters, price sorting and complete product details",async()=>{
    const data=await get("products?category=mice&sort=priceLow&limit=20");
    const {rows: cats}=await database.pool.query("select slug from categories where slug='mice' or parent_category_id=(select id from categories where slug='mice')");
    expect(data.items.every((item:Item)=>cats.some((cat)=>cat.slug===item.category.slug)&&item.status==="ACTIVE")).toBe(true);
    for(let i=1;i<data.items.length;i++)expect(BigInt(data.items[i].price)>=BigInt(data.items[i-1].price)).toBe(true);
    const brand=await get("products?brand=anker&limit=10");
    expect(brand.items.length).toBeGreaterThan(0);
    expect(brand.items.every((item:Item)=>item.brand?.slug === "anker")).toBe(true);
    const detail=await get(`products/${brand.items[0].slug}`);
    expect(detail.variants).toHaveLength(1);expect(detail.images).toHaveLength(1);expect(detail.availableQuantity).toBeGreaterThan(0);
  });
  it("paginates/searches newest linked brands with capped payloads",async()=>{
    const brands=await get("brands?paginated=1&limit=10"),next=await get("brands?paginated=1&limit=10&page=2");
    expect(brands.items).toHaveLength(10);expect(brands.pagination.total).toBeGreaterThanOrEqual(50);
    expect(brands.items.every((row:Item)=>!row.name.startsWith("Demo "))).toBe(true);
    expect(next.items.some((item:Item)=>brands.items.some((row:Item)=>row.id===item.id))).toBe(false);
    expect((await get("brands?q=Sony")).some((row:Item)=>row.name === "SONY")).toBe(true);
    expect(await get("brands?q=Demo%20Willow%20Works")).toEqual([]);
    await get("brands?limit=2000",400);evidence.homepageBrands=brands.items;
  });
  it("feeds new Homepage sections while preserving trending and published CMS",async()=>{
    const arrivals=await get("products?sort=newest&limit=24"),featured=await get("products?sort=newest&limit=24&page=2"),deals=await get("products?sale=1&sort=newest&limit=100");
    const occupied=new Set([...arrivals.items,...featured.items].map((row:Item)=>row.id));
    const visible=deals.items.filter((row:Item)=>!occupied.has(row.id)).slice(0,8);
    expect(visible).toHaveLength(8);
    expect([...arrivals.items,...featured.items].every((row:Item)=>row.slug.startsWith(STOREFRONT_BATCH))).toBe(true);
    const trending=await get("products?trending=1&limit=24&sort=recommended");
    expect(trending.items.every((row:Item)=>row.isTrending&&!row.slug.startsWith(STOREFRONT_BATCH))).toBe(true);
    const cms=await get("homepage/config");evidence.cmsSections=cms.sections;
    evidence.homeSections={arrivals:arrivals.items.slice(0,8).map((row:Item)=>row.id),featured:featured.items.slice(0,8).map((row:Item)=>row.id),deals:visible.map((row:Item)=>row.id)};
  });
  it("exposes the new batch through existing Admin paginated APIs",async()=>{
    const items=await get("admin/products?limit=10"),brands=await get("admin/brands?limit=10");
    expect(items.items.every((row:Item)=>row.slug.startsWith(STOREFRONT_BATCH))).toBe(true);
    expect(brands.items.every((row:Item)=>!row.name.startsWith("Demo "))).toBe(true);
    expect(brands.items.every((row:Item)=>!row.name.startsWith("Lưu trữ · "))).toBe(true);
    evidence.admin={products:items.items.map((row:Item)=>row.id),brands:brands.items.map((row:Item)=>row.slug)};
  });
});
