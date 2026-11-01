import { loadEnv } from "../../config/env.js";
import { createDatabase } from "../../config/database.js";

const env = loadEnv();
const databaseUrl = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "development" || databaseUrl.pathname !== "/technest_dev") {
  throw new Error("Seed verification only runs on NODE_ENV=development database technest_dev");
}
const { pool } = createDatabase(env.DATABASE_URL, {
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 32000,
});

try {
  const { rows: tables } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const counts: Record<string, number> = {};
  for (const { tablename } of tables) {
    const { rows } = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM public."${tablename.replaceAll('"', '""')}"`,
    );
    counts[tablename] = rows[0]!.count;
  }

  const { rows: enumRows } = await pool.query(
    `SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
       FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY t.typname`,
  );
  const { rows: constraintRows } = await pool.query(
    `SELECT c.contype AS type, count(*)::int AS count
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' GROUP BY c.contype ORDER BY c.contype`,
  );
  const { rows: indexRows } = await pool.query(
    `SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const { rows: bannerPlacementRows } = await pool.query(
    `SELECT coalesce(position, 'UNASSIGNED') AS position, count(*)::int AS count
       FROM store_banners GROUP BY position ORDER BY position NULLS LAST`,
  );
  const { rows: integrityRows } = await pool.query(
    `SELECT
      (SELECT count(*) FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id WHERE b.id IS NULL OR c.id IS NULL)::int AS products_missing_references,
      (SELECT count(*) FROM products p WHERE p.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id=p.id AND i.sort_order=0))::int AS active_products_without_primary_image,
      (SELECT count(*) FROM product_variants v LEFT JOIN inventories i ON i.variant_id=v.id WHERE i.variant_id IS NULL)::int AS variants_without_inventory,
      (SELECT count(*) FROM inventories WHERE on_hand < 0 OR reserved < 0 OR reserved > on_hand)::int AS invalid_inventory,
      (SELECT count(*) FROM orders o WHERE o.total_amount <> o.subtotal + o.shipping_fee - o.discount_amount)::int AS invalid_order_totals,
      (SELECT count(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id))::int AS orders_without_items,
      (SELECT count(*) FROM order_items i LEFT JOIN orders o ON o.id=i.order_id LEFT JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id WHERE o.id IS NULL OR p.id IS NULL OR v.id IS NULL OR i.quantity <= 0 OR i.line_total <> i.unit_price * i.quantity)::int AS invalid_order_items,
      (SELECT count(*) FROM store_banners WHERE starts_at IS NOT NULL AND ends_at IS NOT NULL AND starts_at >= ends_at)::int AS invalid_banner_dates,
      (SELECT count(*) FROM store_banners WHERE active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()))::int AS currently_visible_banners,
      (SELECT count(*) FROM vouchers WHERE value <= 0 OR usage_limit <= 0 OR per_user_limit <= 0 OR used_count > usage_limit OR ends_at <= starts_at OR (type='PERCENT' AND value > 100))::int AS invalid_vouchers,
      (SELECT count(*) FROM vouchers v WHERE v.used_count <> (SELECT count(*) FROM voucher_redemptions r WHERE r.voucher_id=v.id AND r.released_at IS NULL))::int AS voucher_usage_count_mismatch,
      (SELECT count(*) FROM voucher_redemptions r LEFT JOIN orders o ON o.id=r.order_id LEFT JOIN users u ON u.id=r.user_id WHERE o.id IS NULL OR u.id IS NULL OR r.discount < 0)::int AS invalid_voucher_redemptions,
      (SELECT count(*) FROM after_sales_requests a LEFT JOIN orders o ON o.id=a.order_id LEFT JOIN order_items i ON i.id=a.item_id WHERE o.id IS NULL OR i.id IS NULL OR o.user_id <> a.user_id OR a.quantity <= 0 OR a.quantity > i.quantity)::int AS invalid_after_sales_requests,
      (SELECT count(*) FROM product_images i LEFT JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id WHERE p.id IS NULL OR (i.variant_id IS NOT NULL AND (v.id IS NULL OR v.product_id <> i.product_id)))::int AS invalid_product_images,
      (SELECT count(*) FROM inventory_reservations r LEFT JOIN inventories i ON i.variant_id=r.variant_id WHERE r.status='ACTIVE' AND (i.variant_id IS NULL OR i.reserved < r.quantity))::int AS active_reservations_without_stock`,
  );
  const integrity = integrityRows[0] as Record<string, number>;
  const failed = Object.entries(integrity).filter(
    ([name, count]) => name !== "currently_visible_banners" && count > 0,
  );
  const visibleBannerCount = integrity.currently_visible_banners ?? 0;
  if (visibleBannerCount > 30)
    failed.push(["currently_visible_banners_over_api_limit", visibleBannerCount]);
  const report = {
    database: databaseUrl.pathname.slice(1),
    tables: counts,
    bannerPlacements: bannerPlacementRows,
    schema: { constraints: constraintRows, indexes: indexRows[0]?.count ?? 0, enums: enumRows },
    integrity,
  };
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) {
    console.error(
      `Integrity checks failed: ${failed.map(([name, count]) => `${name}=${count}`).join(", ")}`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Incremental seed verification failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
