import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../../config/env.js";
import { createDatabase } from "../../config/database.js";

const env = loadEnv();
const url = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "development" || url.pathname !== "/technest_dev" || !["127.0.0.1", "localhost", "postgres"].includes(url.hostname)) {
  throw new Error("Refusing cleanup outside local development technest_dev");
}
const { pool } = createDatabase(env.DATABASE_URL, { statement_timeout: 30000, query_timeout: 32000 });
const docs = new URL("../../../../docs/", import.meta.url);
const batch = "tn-large-20261102";

type DryRun = { database: { db: string }; batch: string; targets: { products: { id: string; slug: string }[]; brands: { id: string; slug: string }[] }; summary: Record<string, string> };

async function main() {
  const dryRun = JSON.parse(await readFile(fileURLToPath(new URL("technest-low-quality-seed-dry-run.json", docs)), "utf8")) as DryRun;
  const backup = JSON.parse(await readFile(fileURLToPath(new URL("technest-low-quality-seed-backup.json", docs)), "utf8")) as Record<string, unknown[]> & { database: string; batch: string };
  if (dryRun.database.db !== "technest_dev" || dryRun.batch !== batch || backup.database !== "technest_dev" || backup.batch !== batch) throw new Error("Dry-run/backup identity mismatch");
  if (dryRun.targets.products.length !== 2000 || dryRun.targets.brands.length !== 2000 || backup.products?.length !== 2000 || backup.brands?.length !== 2000 || backup.product_variants?.length !== 4000 || backup.product_images?.length !== 4000 || backup.inventories?.length !== 4000) throw new Error("Backup or target list is incomplete");

  const { rows: identity } = await pool.query("select current_database() db");
  if (identity[0].db !== "technest_dev") throw new Error("Wrong database identity");
  const productIds = dryRun.targets.products.map((row) => row.id);
  const brandIds = dryRun.targets.brands.map((row) => row.id);
  const [products, brands, variants] = await Promise.all([
    pool.query("select id::text,slug from products where attributes->>'seedBatch'=$1 order by id", [batch]),
    pool.query("select id::text,slug from brands where slug like $1||'-%' order by id", [batch]),
    pool.query("select v.id::text from product_variants v join products p on p.id=v.product_id where p.attributes->>'seedBatch'=$1 order by v.id", [batch]),
  ]);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);
  if (!same(products.rows.map((row) => row.id), productIds) || !same(products.rows.map((row) => row.slug), dryRun.targets.products.map((row) => row.slug)) || !same(brands.rows.map((row) => row.id), brandIds) || !same(brands.rows.map((row) => row.slug), dryRun.targets.brands.map((row) => row.slug)) || variants.rows.length !== 4000) throw new Error("Live target IDs/slugs differ from the approved dry-run inventory");

  const { rows: refCounts } = await pool.query(
    `select
      (select count(*)::int from order_items oi join products p on p.id=oi.product_id where p.attributes->>'seedBatch'=$1) orders,
      (select count(*)::int from flash_sale_items f join products p on p.id=f.product_id where p.attributes->>'seedBatch'=$1) flash_sales,
      (select count(*)::int from inventory_movements m join product_variants v on v.id=m.variant_id join products p on p.id=v.product_id where p.attributes->>'seedBatch'=$1) movements,
      (select count(*)::int from inventory_reservations r join product_variants v on v.id=r.variant_id join products p on p.id=v.product_id where p.attributes->>'seedBatch'=$1) reservations,
      (select count(*)::int from homepage_cms h join products p on p.attributes->>'seedBatch'=$1 where h.published::text like '%'||p.id::text||'%' or h.draft::text like '%'||p.id::text||'%') cms`, [batch]);
  if (Object.values(refCounts[0]).some((value) => value !== 0)) throw new Error(`Business references found; refusing cleanup: ${JSON.stringify(refCounts[0])}`);
  const existingBrandProductRefs = await pool.query("select count(*)::int n from products where brand_id=any($1::bigint[])", [brandIds]);
  if (existingBrandProductRefs.rows[0].n !== 0) throw new Error("Batch brands have product references; refusing cleanup");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(20261102, 2061)");
    const live = await client.query("select id from products where attributes->>'seedBatch'=$1 for update", [batch]);
    if (live.rows.length !== 2000) throw new Error("Product target changed during cleanup");
    const deletedInventory = await client.query("delete from inventories i using product_variants v, products p where i.variant_id=v.id and v.product_id=p.id and p.attributes->>'seedBatch'=$1 returning i.id", [batch]);
    if (deletedInventory.rowCount !== 4000) throw new Error(`Expected 4,000 inventory rows; deleted ${deletedInventory.rowCount}`);
    const deletedProducts = await client.query("delete from products where attributes->>'seedBatch'=$1 returning id", [batch]);
    if (deletedProducts.rowCount !== 2000) throw new Error(`Expected 2,000 products; deleted ${deletedProducts.rowCount}`);
    const deletedBrands = await client.query("delete from brands where id=any($1::bigint[]) returning id", [brandIds]);
    if (deletedBrands.rowCount !== 2000) throw new Error(`Expected 2,000 placeholder brands; deleted ${deletedBrands.rowCount}`);
    await client.query("commit");
    console.log(JSON.stringify({ database: identity[0].db, batch, deleted: { products: deletedProducts.rowCount, brands: deletedBrands.rowCount, variants: 4000, images: 4000, inventories: deletedInventory.rowCount }, protectedReferences: refCounts[0], backup: "docs/technest-low-quality-seed-backup.json" }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => pool.end());
