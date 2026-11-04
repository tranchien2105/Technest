import type { Pool } from "pg";
import type { SeoOverride } from "./seo.types.js";
// Deliberately conservative: generated/illustrative catalog data must never
// become a Google merchant offer or public sitemap entry.
export const eligibleProductSql = `p.status='ACTIVE' AND p.price>0
 AND EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.status='ACTIVE' AND coalesce(v.price,p.price)>0)
 AND NOT (p.attributes ? 'seedBatch' OR p.attributes ? 'developmentCatalog' OR p.attributes ? 'isDemo')
 AND p.slug NOT LIKE 'catalog-%' AND p.slug NOT LIKE 'tn-%'
 AND lower(p.description) NOT LIKE '%dữ liệu phát triển%'
 AND lower(p.description) NOT LIKE '%sản phẩm minh họa%'
 AND EXISTS(SELECT 1 FROM product_images im WHERE im.product_id=p.id AND im.url NOT LIKE '%storefront-curated%' AND im.url NOT LIKE '%storefront-demo%' AND im.url NOT LIKE '%placeholder%')
 AND NOT EXISTS(SELECT 1 FROM seo_metadata sm WHERE sm.entity_type='products' AND sm.entity_key=p.id::text AND (sm.noindex OR sm.canonical_path<>''))`;
export function createSeoRepository(pool: Pick<Pool, "query">) {
  return {
    async redirectSlug(slug: string) {
      const row = (
        await pool.query(
          "SELECT p.id::text FROM seo_product_redirects r JOIN products p ON p.id=r.product_id WHERE r.old_slug=$1 AND p.status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM products existing WHERE existing.slug=$1)",
          [slug],
        )
      ).rows[0];
      return row?.id as string | undefined;
    },
    async override(kind: string, key: string): Promise<SeoOverride | null> {
      const r = await pool.query(
        'SELECT title,description,social_image AS "socialImage",canonical_path AS "canonicalPath",noindex FROM seo_metadata WHERE entity_type=$1 AND entity_key=$2',
        [kind, key],
      );
      return r.rows[0] || null;
    },
    async entity(kind: "categories" | "brands", slug: string) {
      const table = kind === "categories" ? "categories" : "brands";
      const r = await pool.query(`SELECT id::text,slug,name FROM ${table} WHERE slug=$1`, [slug]);
      return r.rows[0] as { id: string; slug: string; name: string } | undefined;
    },
    async entityEligible(kind: "categories" | "brands", id: string) {
      const relation =
        kind === "categories"
          ? "(p.category_id::text=$1 OR p.category_id IN (SELECT id FROM categories WHERE parent_category_id::text=$1))"
          : "p.brand_id::text=$1";
      return Boolean(
        (
          await pool.query(
            `SELECT 1 FROM products p WHERE ${relation} AND ${eligibleProductSql} LIMIT 1`,
            [id],
          )
        ).rowCount,
      );
    },
    async eligible(id: string) {
      return (
        (await pool.query(`SELECT 1 FROM products p WHERE p.id=$1 AND ${eligibleProductSql}`, [id]))
          .rowCount === 1
      );
    },
    async nextSaleStart(variantId: string) {
      const row = (
        await pool.query(
          `SELECT min(c.starts_at) time FROM flash_sale_items i JOIN flash_sale_campaigns c ON c.id=i.campaign_id WHERE i.variant_id=$1 AND c.status IN ('ACTIVE','SCHEDULED') AND c.starts_at>now() AND i.quota-i.reserved_quantity-i.sold_quantity>0`,
          [variantId],
        )
      ).rows[0];
      return row?.time as Date | null;
    },
    async sale(variantId: string) {
      const r = await pool.query(
        `SELECT i.flash_price::text price,c.ends_at AS "endsAt" FROM flash_sale_items i JOIN flash_sale_campaigns c ON c.id=i.campaign_id JOIN inventories n ON n.variant_id=i.variant_id
        WHERE i.variant_id=$1 AND n.on_hand-n.reserved>0 AND c.status IN ('ACTIVE','SCHEDULED') AND c.starts_at<=now() AND c.ends_at>now() AND i.quota-i.reserved_quantity-i.sold_quantity>0
        ORDER BY i.flash_price,c.id LIMIT 1`,
        [variantId],
      );
      return r.rows[0] as { price: string; endsAt: Date } | undefined;
    },
    async sitemap(kind: string, page: number) {
      const offset = (page - 1) * 1000;
      if (kind === "products")
        return (
          await pool.query(
            `SELECT '/products/'||p.slug path, p.updated_at AS modified FROM products p WHERE ${eligibleProductSql} ORDER BY p.id LIMIT 1000 OFFSET $1`,
            [offset],
          )
        ).rows as { path: string; modified?: Date }[];
      const table = kind === "categories" ? "categories" : "brands";
      const relation =
        kind === "categories"
          ? "(p.category_id=e.id OR p.category_id IN (SELECT id FROM categories WHERE parent_category_id=e.id))"
          : "p.brand_id=e.id";
      return (
        await pool.query(
          `SELECT '/${table}/'||e.slug path FROM ${table} e WHERE EXISTS(SELECT 1 FROM products p WHERE ${relation} AND ${eligibleProductSql})
        AND NOT EXISTS(SELECT 1 FROM seo_metadata sm WHERE sm.entity_type=$2 AND sm.entity_key=e.id::text AND (sm.noindex OR sm.canonical_path<>'')) ORDER BY e.id LIMIT 1000 OFFSET $1`,
          [offset, table],
        )
      ).rows as { path: string; modified?: Date }[];
    },
    async sitemapCounts() {
      const result: Record<string, number> = {};
      for (const kind of ["products", "categories", "brands"]) {
        const table = kind === "products" ? "products" : kind;
        const where =
          kind === "products"
            ? eligibleProductSql
            : `EXISTS(SELECT 1 FROM products p WHERE ${kind === "categories" ? "(p.category_id=e.id OR p.category_id IN (SELECT id FROM categories WHERE parent_category_id=e.id))" : "p.brand_id=e.id"} AND ${eligibleProductSql}) AND NOT EXISTS(SELECT 1 FROM seo_metadata sm WHERE sm.entity_type='${kind}' AND sm.entity_key=e.id::text AND (sm.noindex OR sm.canonical_path<>''))`;
        result[kind] = Number(
          (
            await pool.query(
              `SELECT count(*) FROM ${table} ${kind === "products" ? "p" : "e"} WHERE ${where}`,
            )
          ).rows[0].count,
        );
      }
      return result;
    },
    async save(kind: string, key: string, input: SeoOverride) {
      const table = { products: "products", categories: "categories", brands: "brands" }[kind];
      if (table && !(await pool.query(`SELECT 1 FROM ${table} WHERE id::text=$1`, [key])).rowCount)
        return false;
      if (!table && (kind !== "pages" || !["home", "products", "flash-sale"].includes(key)))
        return false;
      await pool.query(
        `INSERT INTO seo_metadata(entity_type,entity_key,title,description,social_image,canonical_path,noindex) VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(entity_type,entity_key) DO UPDATE SET title=excluded.title,description=excluded.description,social_image=excluded.social_image,canonical_path=excluded.canonical_path,noindex=excluded.noindex,updated_at=now()`,
        [
          kind,
          key,
          input.title,
          input.description,
          input.socialImage,
          input.canonicalPath,
          input.noindex,
        ],
      );
      return true;
    },
  };
}
export type SeoRepository = ReturnType<typeof createSeoRepository>;
