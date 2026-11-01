import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "../../config/env.js";
import { createDatabase } from "../../config/database.js";

const env = loadEnv();
const database = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "development" || database.pathname !== "/technest_dev") {
  throw new Error("Image checker is restricted to development database technest_dev");
}
const { pool } = createDatabase(env.DATABASE_URL, { connectionTimeoutMillis: 10000, statement_timeout: 30000, query_timeout: 32000 });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const concurrency = 8;
const timeoutMs = 6000;

async function checkUrl(url: string) {
  if (url.startsWith("/")) {
    const file = path.resolve(root, "public", `.${url}`);
    try {
      const info = await (await import("node:fs/promises")).stat(file);
      return { ok: info.isFile() && info.size > 30, status: info.isFile() ? 200 : 0 };
    } catch {
      return { ok: false, status: 0 };
    }
  }
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      lastStatus = response.status;
      if (response.ok && (response.headers.get("content-type") || "").startsWith("image/")) return { ok: true, status: response.status };
    } catch {
      lastStatus = 0;
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { ok: false, status: lastStatus };
}

async function checkUrls(urls: string[]) {
  const results = new Map<string, { ok: boolean; status: number }>();
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      const url = urls[index];
      if (url === undefined) return;
      results.set(url, await checkUrl(url));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}

try {
  await mkdir(path.join(root, "public", "images", "catalog-illustrations"), { recursive: true });
  const selectImages = () => pool.query<{ id: string; product_id: string; url: string; sort_order: number; product_name: string; root_slug: string }>(
    `SELECT pi.id::text, pi.product_id::text, pi.url, pi.sort_order, p.name AS product_name,
      COALESCE(parent.slug, c.slug) AS root_slug
     FROM product_images pi JOIN products p ON p.id = pi.product_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories parent ON parent.id = c.parent_category_id ORDER BY pi.id`,
  );
  let images = await selectImages();
  let uniqueUrls = [...new Set(images.rows.map((image) => image.url))];
  let results = await checkUrls(uniqueUrls);
  const broken = images.rows.filter((image) => !results.get(image.url)?.ok);
  if (process.argv.includes("--repair") && broken.length) {
    for (const image of broken) {
      const view = (image.sort_order % 3) + 1;
      const url = `/images/catalog-illustrations/${image.root_slug}-view-${view}.svg`;
      const assetPath = path.resolve(root, "public", `.${url}`);
      try {
        await (await import("node:fs/promises")).access(assetPath);
        await pool.query("UPDATE product_images SET url=$1, alt_text=$2 WHERE id=$3", [url, `Ảnh minh họa ${image.product_name} · không phải ảnh chính thức của nhà sản xuất`, image.id]);
      } catch {
        // Report the broken URL if the matching illustration is not present.
      }
    }
    images = await selectImages();
    uniqueUrls = [...new Set(images.rows.map((image) => image.url))];
    results = await checkUrls(uniqueUrls);
  }
  const reportBroken = images.rows.filter((image) => !results.get(image.url)?.ok);
  const missingProducts = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM products p WHERE p.status='ACTIVE'
     AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id=p.id AND pi.sort_order=0)`,
  );
  const productCount = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM products WHERE status='ACTIVE'");
  const report = {
    activeProducts: Number(productCount.rows[0]?.count || 0),
    activeProductsWithThumbnail: Number(productCount.rows[0]?.count || 0) - Number(missingProducts.rows[0]?.count || 0),
    activeProductsMissingThumbnail: Number(missingProducts.rows[0]?.count || 0),
    totalImageRows: images.rows.length,
    distinctImageUrls: uniqueUrls.length,
    validImageUrls: uniqueUrls.filter((url) => results.get(url)?.ok).length,
    brokenImageUrls: reportBroken.length,
    brokenRecords: reportBroken.slice(0, 30).map((image) => ({ product: image.product_name, url: image.url, status: results.get(image.url)?.status })),
    illustrationImageRows: images.rows.filter((image) => image.url.startsWith("/images/catalog-illustrations/")).length,
    concurrency,
    retryCount: 1,
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.activeProductsMissingThumbnail || report.brokenImageUrls) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Image check failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
