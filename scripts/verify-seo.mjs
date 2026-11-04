import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.SEO_VERIFY_BASE || "http://localhost:5173";
const api = process.env.SEO_VERIFY_API || "http://localhost:3000/api/v1";
const catalog = await (await fetch(`${api}/products?limit=1`)).json();
const product = catalog.data.items[0];
const checks = [];
for (const path of [
  "/",
  `/products/${product.slug}`,
  `/categories/${product.category.slug}`,
  `/brands/${product.brand.slug}`,
  "/products?page=2",
  "/products/seo-product-that-does-not-exist",
  "/admin",
  "/account",
  "/checkout",
  "/robots.txt",
  "/sitemap.xml",
]) {
  const started = performance.now();
  const r = await fetch(base + path, { headers: { Accept: "text/html" }, redirect: "manual" });
  const html = await r.text();
  const title = /<title[^>]*>(.*?)<\/title>/.exec(html)?.[1];
  const schemas = [
    ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => JSON.parse(m[1]));
  if (path.startsWith("/products/seo-product-that")) assert.equal(r.status, 404);
  else if (path === "/sitemap.xml")
    assert.equal(r.status, 503); // local development must never publish a sitemap
  else assert.equal(r.status, 200);
  if (path.startsWith("/products/") && !path.includes("does-not-exist")) {
    assert.ok(title.includes(product.name.replaceAll("&", "&amp;")));
    assert.ok(schemas.some((s) => s["@graph"]?.some((item) => item["@type"] === "Product")));
    assert.ok(html.includes("<h1>"));
  }
  if (title) assert.ok(html.includes("noindex"));
  checks.push({
    path,
    status: r.status,
    durationMs: Math.round(performance.now() - started),
    title,
    robots: r.headers.get("x-robots-tag"),
    schemaTypes: schemas.flatMap((s) => s["@graph"]?.map((item) => item["@type"]) || []),
  });
}
const idResponse = await fetch(`${base}/products/${product.id}`, {
  headers: { Accept: "text/html" },
  redirect: "manual",
});
assert.equal(idResponse.status, 308);
assert.equal(idResponse.headers.get("location"), `/products/${product.slug}`);
const report = {
  mode: "HTTP source HTML verification; no browser automation; development noindex",
  base,
  checkedAt: new Date().toISOString(),
  checks,
  numericRedirect: { status: idResponse.status, location: idResponse.headers.get("location") },
};
await writeFile(
  new URL(
    process.env.SEO_VERIFY_REPORT || "../docs/technest-seo-http-verification.json",
    import.meta.url,
  ),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
