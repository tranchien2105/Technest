import process from "node:process";
import console from "node:console";
import { URL, fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { loadEnv } from "../src/config/env.ts";
import { isOwnedLegacyIllustration, validateCuratedIdentity, validVndAmount } from "../src/database/seeds/catalog-quality.ts";

const env = loadEnv();
const databaseUrl = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "development" || databaseUrl.pathname !== "/technest_dev" || !["localhost", "127.0.0.1", "postgres"].includes(databaseUrl.hostname)) throw new Error("Requires confirmed local development technest_dev");
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
const docs = new URL("../../docs/", import.meta.url);
const targetFile = (name) => fileURLToPath(new URL(name, docs));
const hash = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const quote = (identifier) => '"' + identifier.replaceAll('"', '""') + '"';
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1, statement_timeout: 15_000, query_timeout: 17_000 });
const started = Date.now();
const client = await pool.connect();
try {
  const identity = (await client.query("select current_database() db")).rows[0].db;
  if (identity !== "technest_dev") throw new Error("Wrong database identity");
  await client.query(apply ? "begin isolation level serializable" : "begin isolation level repeatable read read only");
  if (apply) await client.query("select pg_advisory_xact_lock(20261103, 82)");
  const products = (await client.query(`select p.*,p.id::text id,p.price::text price,c.slug category_slug,b.slug brand_slug,b.name brand_name
    from products p join categories c on c.id=p.category_id join brands b on b.id=p.brand_id order by p.id`)).rows;
  const variants = (await client.query("select *,id::text id,product_id::text product_id from product_variants order by product_variants.id")).rows;
  const images = (await client.query("select *,id::text id,product_id::text product_id,variant_id::text variant_id from product_images order by product_images.id")).rows;
  const inventory = (await client.query("select *,id::text id,variant_id::text variant_id from inventories order by inventories.id")).rows;
  const byId = new Map(products.map((product) => [product.id, product]));
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
  const protectedIds = new Map();
  const protect = (id, reason) => {
    if (!byId.has(id)) return;
    if (!protectedIds.has(id)) protectedIds.set(id, new Set());
    protectedIds.get(id).add(reason);
  };
  // Discover references from the live schema, including future business tables.
  const complexForeignKeys = (await client.query(`select f.conname from pg_constraint f join pg_class parent on parent.oid=f.confrelid where f.contype='f' and parent.relname in ('products','product_variants') and cardinality(f.conkey)<>1`)).rows;
  if (complexForeignKeys.length) throw new Error("Composite catalog foreign keys require manual review before quarantine");
  const foreignKeys = (await client.query(`select child.relname child_table,a.attname child_column,parent.relname parent_table
    from pg_constraint f join pg_class child on child.oid=f.conrelid join pg_namespace n on n.oid=child.relnamespace
    join pg_class parent on parent.oid=f.confrelid join pg_attribute a on a.attrelid=child.oid and a.attnum=f.conkey[1]
    where f.contype='f' and n.nspname='public' and parent.relname in ('products','product_variants') and cardinality(f.conkey)=1
    order by child.relname,a.attname`)).rows;
  const references = [];
  for (const fk of foreignKeys) {
    if (["product_variants", "product_images", "inventories"].includes(fk.child_table)) continue;
    const column = quote(fk.child_column), table = quote(fk.child_table);
    const rows = (await client.query(`select distinct ${column}::text id from ${table} where ${column} is not null`)).rows;
    let matched = 0;
    for (const row of rows) {
      const productId = fk.parent_table === "products" ? row.id : variantsById.get(row.id)?.product_id;
      if (productId && byId.has(productId)) { protect(productId, `${fk.child_table}.${fk.child_column}`); matched++; }
    }
    references.push({ ...fk, distinctReferencedIds: matched });
  }
  for (const stock of inventory) if (stock.reserved > 0) protect(variantsById.get(stock.variant_id)?.product_id, "inventories.reserved");
  const cms = (await client.query("select draft,published from homepage_cms")).rows;
  const slugs = new Map(products.map((product) => [product.slug, product.id]));
  function scanCms(value, key = "") {
    if (Array.isArray(value)) { for (const child of value) scanCms(child, key); return; }
    if (value && typeof value === "object") { for (const [name, child] of Object.entries(value)) scanCms(child, name); return; }
    if (typeof value !== "string" && typeof value !== "number") return;
    const text = String(value);
    if (/productids?$/i.test(key)) protect(text, "homepage_cms.manual_product");
    if (/variantids?$/i.test(key)) protect(variantsById.get(text)?.product_id, "homepage_cms.manual_variant");
    const linked = text.match(/^\/products\/([^?#/]+)/)?.[1];
    if (linked) protect(slugs.get(decodeURIComponent(linked)) || linked, "homepage_cms.product_link");
  }
  for (const row of cms) scanCms(row);

  const owned = products.filter(isOwnedLegacyIllustration);
  const targets = owned.filter((product) => product.status === "ACTIVE" && !protectedIds.has(product.id));
  const targetIds = new Set(targets.map((product) => product.id));
  const targetVariantIds = new Set(variants.filter((variant) => targetIds.has(variant.product_id)).map((variant) => variant.id));
  const stableRows = (rows) => rows.map((row) => ({ ...row }));
  const targetBackup = { products: stableRows(targets), variants: variants.filter((row) => targetIds.has(row.product_id)), images: images.filter((row) => targetIds.has(row.product_id)), inventory: inventory.filter((row) => targetVariantIds.has(row.variant_id)) };
  const protectedFingerprint = hash({ products: products.filter((row) => !targetIds.has(row.id)), variants, images, inventory, cms });
  const businessTables = ["brands", "categories", "orders", "order_items", "inventory_movements", "inventory_reservations", "flash_sale_campaigns", "flash_sale_items", "flash_sale_reservations", "vouchers"];
  const businessDigests = {};
  for (const table of businessTables) {
    const result = (await client.query(`select count(*)::int count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) digest from ${quote(table)} t`)).rows[0];
    businessDigests[table] = result;
  }
  const structural = (await client.query(`select
    (select count(*)::int from products p left join brands b on b.id=p.brand_id left join categories c on c.id=p.category_id where b.id is null or c.id is null) orphan_products,
    (select count(*)::int from product_variants v left join products p on p.id=v.product_id where p.id is null) orphan_variants,
    (select count(*)::int from product_images i left join products p on p.id=i.product_id left join product_variants v on v.id=i.variant_id where p.id is null or (i.variant_id is not null and (v.id is null or v.product_id<>i.product_id))) invalid_image_links,
    (select count(*)::int from product_variants v left join inventories i on i.variant_id=v.id where i.id is null) variants_without_inventory,
    (select count(*)::int from inventories where on_hand<reserved or reserved<0 or on_hand<0) invalid_inventory,
    (select count(*)::int from products p where not exists(select 1 from product_images i where i.product_id=p.id)) missing_images,
    (select count(*)::int from (select sku from product_variants group by sku having count(*)>1) t) duplicate_skus,
    (select count(*)::int from (select slug from products group by slug having count(*)>1) t) duplicate_slugs,
    (select count(*)::int from (select lower(name) from products group by lower(name) having count(*)>1) t) duplicate_names,
    (select count(*)::int from (select slug from brands group by slug having count(*)>1) t) duplicate_brand_slugs,
    (select count(*)::int from brands where name ~* '^demo ') suspicious_brand_names`)).rows[0];
  structural.invalid_product_prices = products.filter((row) => !validVndAmount(row.price)).length;
  structural.invalid_variant_prices = variants.filter((row) => row.price !== null && !validVndAmount(row.price)).length;
  const curatedIssues = products.flatMap((row) => validateCuratedIdentity(row).map((issue) => ({ id: row.id, issue })));
  const datasets = {};
  for (const row of products) {
    const name = row.attributes.dataset || "unmarked";
    datasets[name] ||= { total: 0, active: 0, protected: 0 };
    datasets[name].total++; datasets[name].active += Number(row.status === "ACTIVE"); datasets[name].protected += Number(protectedIds.has(row.id));
  }
  const legacyImageMismatchCategories = new Set(["keycaps", "switches", "numeric-keypads", "mousepads", "monitor-arms", "monitor-lights", "wireless-earbuds", "desktop-speakers", "microphones", "usb-microphones", "audio-interfaces", "headphone-dacs", "conference-audio", "soundbars", "usb-hubs", "docking-stations", "adapters", "cables", "laptop-stands", "webcams", "chargers", "desk-accessories", "streaming", "controllers", "storage"]);
  const semanticWarnings = {
    generatedModelNamesNotVerifiedMerchandise: owned.length,
    protectedLegacyModelsStillRequiringReview: owned.filter((row) => row.status === "ACTIVE" && protectedIds.has(row.id)).length,
    legacyGenericColorVariants: variants.filter((row) => byId.has(row.product_id) && isOwnedLegacyIllustration(byId.get(row.product_id))).length,
    legacyBroadIllustrationsMismatchSpecificType: owned.filter((row) => legacyImageMismatchCategories.has(row.category_slug)).length,
    currentMarketPriceVerification: "NOT TESTED: all prices are local development fixtures; no commercial authenticity assertion",
    originalModelsAndBrandsReverifiedAgainstManufacturer: "NOT TESTED: preserved existing records, including private-label/generic brand names",
  };
  const report = {
    generatedAt: new Date().toISOString(), database: identity, mode: apply ? "apply" : verify ? "verify" : "dry-run", counts: { products: products.length, brands: businessDigests.brands.count, variants: variants.length, images: images.length, inventories: inventory.length },
    datasets, structural, semanticWarnings, curatedIssues, foreignKeys: references,
    provenance: { exactLegacyGeneratorMatches: owned.length, markedButUnmatched: products.filter((row) => row.attributes.dataset === "development-illustration" && !isOwnedLegacyIllustration(row)).map((row) => row.id), identifiers: ["attributes.dataset", "attributes.seedKey", "attributes.seedOrdinal", "category slug", "catalog slug namespace/suffix", "exact generator name and linked brand"] },
    action: "Set status=INACTIVE only. No deletion/rename/repricing/stock changes. Referenced records are preserved.",
    targets: targets.map((row) => ({ id: row.id, slug: row.slug, name: row.name, beforeStatus: row.status, afterStatus: "INACTIVE" })),
    protectedLegacy: owned.filter((row) => protectedIds.has(row.id)).map((row) => ({ id: row.id, name: row.name, slug: row.slug, brand: row.brand_name, category: row.category_slug, reasons: [...protectedIds.get(row.id)] })),
    backupHash: hash(targetBackup), protectedFingerprint, businessDigests,
    imageAudit: { categoryIllustrationProducts: products.filter((row) => ["development-illustration", "curated-development-catalog"].includes(row.attributes.dataset)).length, externallyHostedImages: images.filter((row) => /^https?:/.test(row.url)).length, missingLocalImageFiles: [] },
  };
  const localUrls = [...new Set(images.map((row) => row.url).filter((url) => url.startsWith("/images/")))];
  for (const url of localUrls) {
    try { await readFile(fileURLToPath(new URL(`../../public${url}`, import.meta.url))); }
    catch { report.imageAudit.missingLocalImageFiles.push(url); }
  }

  if (verify) {
    const dryRun = JSON.parse(await readFile(targetFile("technest-catalog-quality-dry-run.json"), "utf8"));
    const backup = JSON.parse(await readFile(targetFile("technest-catalog-quarantine-backup.json"), "utf8"));
    const originalIds = new Set(dryRun.targets.map((row) => row.id));
    const currentProtected = hash({ products: products.filter((row) => !originalIds.has(row.id)), variants, images, inventory, cms });
    const unchangedExceptStatus = backup.products.every((before) => {
      const after = byId.get(before.id);
      if (!after || after.status !== "INACTIVE") return false;
      const ignoreStatus = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !["status", "updated_at"].includes(key)));
      return hash(ignoreStatus(before)) === hash(ignoreStatus(after));
    });
    report.verification = {
      quarantinedProducts: originalIds.size,
      unchangedExceptStatus,
      protectedCatalogUnchanged: currentProtected === dryRun.protectedFingerprint,
      businessTablesUnchanged: JSON.stringify(businessDigests) === JSON.stringify(dryRun.businessDigests),
      additionalQuarantineCandidates: targets.length,
      deletedRecords: dryRun.counts.products - products.length,
    };
    if (!unchangedExceptStatus || !report.verification.protectedCatalogUnchanged || !report.verification.businessTablesUnchanged || targets.length || report.verification.deletedRecords) throw new Error(`Post-repair verification failed: ${JSON.stringify(report.verification)}`);
    await writeFile(targetFile("technest-catalog-quality-verification.json"), JSON.stringify(report, null, 2));
  } else if (!apply) {
    const applied = await readFile(targetFile("technest-catalog-quality-results.json"), "utf8").then(JSON.parse).catch(() => null);
    if (applied?.applied?.changedProducts && applied.backupHash !== report.backupHash) throw new Error("Preserving the pre-repair backup/dry-run. Use --verify for an already applied repair; do not overwrite recovery evidence.");
    await writeFile(targetFile("technest-catalog-quarantine-backup.json"), JSON.stringify({ generatedAt: report.generatedAt, database: identity, backupHash: report.backupHash, ...targetBackup }, null, 2));
    await writeFile(targetFile("technest-catalog-quality-dry-run.json"), JSON.stringify(report, null, 2));
  } else {
    const dryRun = JSON.parse(await readFile(targetFile("technest-catalog-quality-dry-run.json"), "utf8"));
    const backup = JSON.parse(await readFile(targetFile("technest-catalog-quarantine-backup.json"), "utf8"));
    if (dryRun.database !== identity || backup.database !== identity || dryRun.backupHash !== report.backupHash || backup.backupHash !== report.backupHash || hash({ products: backup.products, variants: backup.variants, images: backup.images, inventory: backup.inventory }) !== report.backupHash) throw new Error("Backup/dry-run do not match exact live rows; rerun dry-run and review");
    if (JSON.stringify(dryRun.targets) !== JSON.stringify(report.targets) || dryRun.protectedFingerprint !== protectedFingerprint || JSON.stringify(dryRun.businessDigests) !== JSON.stringify(businessDigests)) throw new Error("Catalog/business/CMS changed since dry-run; refusing mutations");
    await client.query("select id from products where id=any($1::bigint[]) order by id for update", [[...targetIds]]);
    await client.query("select id from product_variants where id=any($1::bigint[]) order by id for update", [[...targetVariantIds]]);
    const changed = await client.query("update products set status='INACTIVE',updated_at=now() where id=any($1::bigint[]) and status='ACTIVE' returning id::text", [[...targetIds]]);
    if (changed.rowCount !== targets.length) throw new Error("Target row count changed during update");
    const after = (await client.query("select id::text,status from products where id=any($1::bigint[]) order by id", [[...targetIds]])).rows;
    if (!after.every((row) => row.status === "INACTIVE")) throw new Error("Quarantine verification failed");
    report.applied = { changedProducts: changed.rowCount, deletedProducts: 0, changedBrands: 0, changedVariants: 0, changedInventory: 0, ids: after.map((row) => row.id) };
    // A durable report is written after COMMIT below; failure before this point rolls back.
  }
  await client.query("commit");
  report.elapsedMs = Date.now() - started;
  if (apply) await writeFile(targetFile("technest-catalog-quality-results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: report.mode, counts: report.counts, datasets, structural, curatedIssues: curatedIssues.length, owned: owned.length, targeted: targets.length, protectedLegacy: report.protectedLegacy.length, unmatched: report.provenance.markedButUnmatched.length, applied: report.applied ? { ...report.applied, ids: undefined } : undefined, verification: report.verification, elapsedMs: report.elapsedMs }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
