import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../../config/env.js";
import { createDatabase } from "../../config/database.js";
import { CURATED_BRANDS, CURATED_PRODUCTS, STOREFRONT_BATCH, storefrontFixture } from "./storefront-demo-data.js";

const env = loadEnv();
const databaseUrl = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "development" || databaseUrl.pathname !== "/technest_dev" || !["127.0.0.1", "localhost", "postgres"].includes(databaseUrl.hostname)) {
  throw new Error("Requires confirmed local development technest_dev database");
}
const { pool } = createDatabase(env.DATABASE_URL, { statement_timeout: 30000, query_timeout: 32000, connectionTimeoutMillis: 10000 });
const assets = fileURLToPath(new URL("../../../../public/images/storefront-curated/", import.meta.url));
const assetKeys = [...new Set(CURATED_PRODUCTS.map((item) => item.imageKey))];

function illustration(key: string): string {
  const icon: Record<string, string> = {
    monitor: '<rect x="245" y="145" width="310" height="205" rx="15" fill="#253244"/><rect x="260" y="160" width="280" height="175" rx="7" fill="#dcebf5"/><path d="M260 300l86-90 65 68 56-52 73 74v35H260" fill="#f16a21" opacity=".8"/><path d="M385 350h30v60h-30zM330 412h140v14H330z" fill="#6b7683"/>',
    keyboard: '<rect x="175" y="205" width="450" height="180" rx="24" fill="#253244"/>' + Array.from({ length: 4 }, (_, r) => Array.from({ length: 10 }, (_, c) => `<rect x="192" y="222" width="30" height="26" rx="5" fill="#e7edf2" transform="translate(${c * 42} ${r * 37})"/>`).join("")).join("") + '<rect x="315" y="333" width="170" height="27" rx="5" fill="#f16a21"/>',
    mouse: '<path d="M310 255c0-94 34-140 90-140s90 46 90 140v72c0 79-31 122-90 122s-90-43-90-122z" fill="#293747"/><path d="M400 115v105" stroke="#f16a21" stroke-width="8"/><rect x="385" y="150" width="30" height="55" rx="15" fill="#f16a21"/>',
    audio: '<path d="M290 300v-55c0-150 220-150 220 0v55" stroke="#253244" stroke-width="30" fill="none"/><rect x="260" y="270" width="70" height="145" rx="30" fill="#f16a21"/><rect x="470" y="270" width="70" height="145" rx="30" fill="#f16a21"/>',
    earbuds: '<rect x="295" y="270" width="210" height="125" rx="48" fill="#253244"/><path d="M350 155c-45 0-58 50-40 88l25 45h45V202c0-29-7-47-30-47zm100 0c45 0 58 50 40 88l-25 45h-45V202c0-29 7-47 30-47z" fill="#f16a21"/>',
    speaker: '<rect x="275" y="160" width="250" height="260" rx="55" fill="#253244"/><circle cx="400" cy="288" r="72" fill="#f16a21"/><circle cx="400" cy="288" r="34" fill="#273648"/><circle cx="400" cy="288" r="10" fill="#f6f7f8"/>',
    microphone: '<rect x="360" y="130" width="80" height="220" rx="40" fill="#253244"/><path d="M320 260v35c0 110 160 110 160 0v-35" stroke="#f16a21" stroke-width="20" fill="none"/><path d="M400 390v50m-60 0h120" stroke="#687684" stroke-width="16"/>',
    hub: '<rect x="250" y="230" width="300" height="100" rx="22" fill="#253244"/><rect x="285" y="265" width="55" height="24" rx="5" fill="#f16a21"/><rect x="365" y="265" width="55" height="24" rx="5" fill="#dce5eb"/><rect x="445" y="265" width="55" height="24" rx="5" fill="#dce5eb"/>',
    charger: '<rect x="320" y="170" width="160" height="230" rx="32" fill="#253244"/><rect x="350" y="205" width="100" height="70" rx="10" fill="#eaf0f4"/><path d="M370 315h60" stroke="#f16a21" stroke-width="12"/>',
    network: '<path d="M260 265q140-150 280 0" stroke="#f16a21" stroke-width="18" fill="none"/><path d="M310 310q90-90 180 0" stroke="#f16a21" stroke-width="18" fill="none"/><rect x="330" y="330" width="140" height="75" rx="16" fill="#253244"/><circle cx="365" cy="368" r="6" fill="#f1b746"/><circle cx="400" cy="368" r="6" fill="#f1b746"/><circle cx="435" cy="368" r="6" fill="#f1b746"/>',
    storage: '<rect x="300" y="190" width="200" height="200" rx="32" fill="#253244"/><rect x="325" y="215" width="150" height="150" rx="22" fill="#e8edf1"/><circle cx="400" cy="290" r="18" fill="#f16a21"/>',
    webcam: '<rect x="275" y="210" width="250" height="145" rx="25" fill="#253244"/><circle cx="400" cy="282" r="48" fill="#e7edf2"/><circle cx="400" cy="282" r="25" fill="#f16a21"/><path d="M350 360v35h100v-35" fill="#687684"/>',
    streaming: '<rect x="250" y="175" width="300" height="215" rx="20" fill="#253244"/><rect x="280" y="205" width="65" height="55" rx="8" fill="#f16a21"/><rect x="365" y="205" width="65" height="55" rx="8" fill="#e7edf2"/><rect x="450" y="205" width="65" height="55" rx="8" fill="#e7edf2"/><rect x="280" y="285" width="65" height="55" rx="8" fill="#e7edf2"/><rect x="365" y="285" width="65" height="55" rx="8" fill="#f16a21"/><rect x="450" y="285" width="65" height="55" rx="8" fill="#e7edf2"/>',
    adapter: '<rect x="300" y="235" width="200" height="110" rx="25" fill="#253244"/><path d="M300 280h-70v20h70M500 280h70v20h-70" stroke="#687684" stroke-width="14"/><rect x="350" y="265" width="36" height="22" rx="4" fill="#f16a21"/><rect x="414" y="265" width="36" height="22" rx="4" fill="#e7edf2"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560"><rect width="800" height="560" fill="#f6f8fa"/><circle cx="655" cy="115" r="115" fill="#f16a21" opacity=".08"/><ellipse cx="400" cy="460" rx="250" ry="22" fill="#273648" opacity=".1"/>${icon[key] ?? icon.monitor}<text x="30" y="42" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#465361">TECHNEST · ẢNH MINH HỌA</text><text x="570" y="520" font-family="Arial,sans-serif" font-size="13" fill="#687684">Không phải ảnh model thực tế</text></svg>`;
}

async function main() {
  const { rows: identity } = await pool.query("select current_database() db");
  if (identity[0].db !== "technest_dev") throw new Error("Wrong database identity");
  const lock = await pool.query("select pg_try_advisory_lock(20261102, 2060) locked");
  if (!lock.rows[0].locked) throw new Error("Another curated storefront seed is already running");
  const started = Date.now();
  let inserted = 0;
  try {
    const { rows: categoryRows } = await pool.query("select id,slug from categories");
    const categoryBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));
    let insertedBrands = 0;
    for (const brand of CURATED_BRANDS) {
      const result = await pool.query("insert into brands(name,slug) values($1,$2) on conflict(slug) do nothing returning id", [brand.name, brand.slug]);
      insertedBrands += result.rowCount ?? 0;
      const existing = (await pool.query("select name from brands where slug=$1", [brand.slug])).rows[0];
      if (existing?.name !== brand.name) throw new Error(`Brand namespace collision: ${brand.slug}`);
    }
    const { rows: brandRows } = await pool.query("select id,slug from brands");
    const brandBySlug = new Map(brandRows.map((row) => [row.slug, row.id]));
    for (const item of CURATED_PRODUCTS) {
      if (!categoryBySlug.has(item.categorySlug)) throw new Error(`Missing category ${item.categorySlug}`);
      if (!brandBySlug.has(item.brandSlug)) throw new Error(`Missing brand ${item.brandSlug}`);
    }
    await mkdir(assets, { recursive: true });
    for (const key of assetKeys) await writeFile(`${assets}${key}.svg`, illustration(key));

    for (let offset = 0; offset < CURATED_PRODUCTS.length; offset += 20) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        for (let i = offset; i < Math.min(offset + 20, CURATED_PRODUCTS.length); i++) {
          const item = storefrontFixture(i);
          const values = [item.name, item.slug, item.description, categoryBySlug.get(item.categorySlug), brandBySlug.get(item.brandSlug), String(item.price), JSON.stringify(item.attributes)];
          const existing = (await client.query("select id from products where attributes->>'seedBatch'=$1 and attributes->>'seedOrdinal'=$2 for update", [STOREFRONT_BATCH, String(i)])).rows[0];
          let productId: string;
          if (existing) {
            const update = await client.query(
              `update products set name=$2,slug=$3,description=$4,category_id=$5,brand_id=$6,price=$7,attributes=$8::jsonb,badge='new',status='ACTIVE',is_featured=false,is_trending=false,updated_at=now()
               where id=$1 and attributes->>'seedBatch'=$9
                 and (name is distinct from $2 or slug is distinct from $3 or description is distinct from $4 or category_id is distinct from $5 or brand_id is distinct from $6 or price is distinct from $7::numeric or attributes is distinct from $8::jsonb or status<>'ACTIVE') returning id`,
              [existing.id, ...values, STOREFRONT_BATCH],
            );
            productId = String(update.rows[0]?.id ?? existing.id);
          } else {
            const created = await client.query(
              `insert into products(name,slug,description,category_id,brand_id,price,attributes,badge,status,is_featured,is_trending)
               values($1,$2,$3,$4,$5,$6,$7::jsonb,'new','ACTIVE',false,false)
               on conflict(slug) do nothing returning id`, values,
            );
            inserted += created.rowCount ?? 0;
            const product = created.rows[0] ?? (await client.query("select id,attributes from products where slug=$1", [item.slug])).rows[0];
            if (!product || product.attributes?.seedBatch !== STOREFRONT_BATCH) throw new Error(`Slug namespace collision: ${item.slug}`);
            productId = String(product.id);
          }
          const product = (await client.query("select id,attributes from products where id=$1", [productId])).rows[0];
          if (!product || product.attributes?.seedBatch !== STOREFRONT_BATCH) throw new Error(`Slug namespace collision: ${item.slug}`);
          await client.query(
            `insert into product_variants(product_id,sku,name,price,attributes,status)
             values($1,$2,'Mặc định',$3,$4::jsonb,'ACTIVE') on conflict(sku) do nothing returning id`,
            [product.id, item.sku, String(item.price), JSON.stringify({ optionType: "standard", developmentCatalog: true })],
          );
          const variantRow = (await client.query("select id,product_id from product_variants where sku=$1", [item.sku])).rows[0];
          if (!variantRow || String(variantRow.product_id) !== String(product.id)) throw new Error(`SKU namespace collision: ${item.sku}`);
          await client.query("insert into inventories(variant_id,on_hand,reserved) values($1,$2,0) on conflict(variant_id) do nothing", [variantRow.id, 8 + (i % 17)]);
          await client.query("delete from product_images where product_id=$1 and url like '/images/storefront-curated/%' and url<>$2", [product.id, item.image]);
          await client.query("insert into product_images(product_id,url,alt_text,sort_order) select $1,$2,$3,0 where not exists(select 1 from product_images where product_id=$1 and url=$2)", [product.id, item.image, `Ảnh minh họa nhóm ${item.imageKey}; không phải ảnh model thực tế`]);
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally { client.release(); }
      console.log(JSON.stringify({ phase: "curated-products", processed: Math.min(offset + 20, CURATED_PRODUCTS.length), inserted }));
    }
    const { rows: checks } = await pool.query(
      `select count(*)::int products,count(distinct brand_id)::int brands,
        count(*) filter(where price<=0)::int invalid_prices,
        count(*) filter(where status<>'ACTIVE')::int inactive,
        count(*) filter(where not exists(select 1 from categories c where c.id=products.category_id))::int missing_categories,
        count(*) filter(where not exists(select 1 from brands b where b.id=products.brand_id))::int missing_brands,
        count(*) filter(where not exists(select 1 from product_images i where i.product_id=products.id))::int missing_images,
        count(*) filter(where not exists(select 1 from product_variants v join inventories n on n.variant_id=v.id where v.product_id=products.id and v.status='ACTIVE' and n.on_hand>n.reserved))::int missing_sellable_variants
       from products where attributes->>'seedBatch'=$1`, [STOREFRONT_BATCH]);
    const { rows: duplicates } = await pool.query(
      "select (select count(*) from (select sku from product_variants group by sku having count(*)>1) x)::int duplicate_skus,(select count(*) from (select slug from products group by slug having count(*)>1) y)::int duplicate_slugs",
    );
    const newest = await pool.query("select id::text,name,slug from products where attributes->>'seedBatch'=$1 order by created_at desc,id desc limit 10", [STOREFRONT_BATCH]);
    const report = { database: identity[0].db, batch: STOREFRONT_BATCH, inserted: { brands: insertedBrands, products: inserted }, elapsedMs: Date.now() - started, checks: checks[0], duplicates: duplicates[0], newest: newest.rows };
    console.log(JSON.stringify(report));
    if (checks[0].products !== CURATED_PRODUCTS.length || checks[0].invalid_prices || checks[0].inactive || checks[0].missing_categories || checks[0].missing_brands || checks[0].missing_images || checks[0].missing_sellable_variants || duplicates[0].duplicate_skus || duplicates[0].duplicate_slugs) throw new Error("Curated catalog verification failed");
  } finally {
    await pool.query("select pg_advisory_unlock(20261102, 2060)");
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => pool.end());
