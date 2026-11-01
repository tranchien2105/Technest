import { loadEnv } from "../../config/env.js";
import { createDatabase } from "../../config/database.js";

const env = loadEnv();
const database = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "development" || database.pathname !== "/technest_dev") {
  throw new Error("Data-quality checker is restricted to development database technest_dev");
}
const { pool } = createDatabase(env.DATABASE_URL, { connectionTimeoutMillis: 10000, statement_timeout: 30000, query_timeout: 32000 });

try {
  if (process.argv.includes("--repair")) {
    await pool.query(
      `UPDATE order_items oi SET image_url=(
        SELECT pi.url FROM product_images pi WHERE pi.product_id=oi.product_id ORDER BY pi.sort_order, pi.id LIMIT 1
      ) WHERE oi.image_url IS NULL AND EXISTS (
        SELECT 1 FROM product_images pi WHERE pi.product_id=oi.product_id
      )`,
    );
  }
  const metrics = await pool.query(
    `SELECT
      (SELECT count(*) FROM categories)::int AS categories,
      (SELECT count(*) FROM brands)::int AS brands,
      (SELECT count(DISTINCT brand_id) FROM products WHERE status='ACTIVE')::int AS active_brands,
      (SELECT count(*) FROM products)::int AS products,
      (SELECT count(*) FROM products WHERE status='ACTIVE')::int AS active_products,
      (SELECT count(*) FROM product_variants)::int AS variants,
      (SELECT count(*) FROM product_images)::int AS images,
      (SELECT count(*) FROM inventories)::int AS inventories,
      (SELECT count(*) FROM users WHERE role='CUSTOMER')::int AS customers,
      (SELECT count(*) FROM orders)::int AS orders,
      (SELECT count(*) FROM order_items)::int AS order_items,
      (SELECT count(*) FROM order_status_history)::int AS order_status_history,
      (SELECT count(*) FROM inventory_movements)::int AS inventory_movements,
      (SELECT count(*) FROM inventory_reservations)::int AS inventory_reservations,
      (SELECT count(*) FROM user_addresses)::int AS addresses`,
  );
  const violations = await pool.query(
    `SELECT
      (SELECT count(*) FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id WHERE b.id IS NULL OR c.id IS NULL)::int AS missing_brand_or_category,
      (SELECT count(*) FROM products p WHERE btrim(p.description)='')::int AS missing_description,
      (SELECT count(*) FROM products p WHERE p.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id=p.id AND i.sort_order=0))::int AS active_missing_thumbnail,
      (SELECT count(*) FROM products p WHERE (SELECT count(*) FROM product_images i WHERE i.product_id=p.id)<2 OR (SELECT count(*) FROM product_images i WHERE i.product_id=p.id)>5)::int AS products_with_image_count_outside_2_5,
      (SELECT count(*) FROM products p WHERE (SELECT count(*) FROM product_variants v WHERE v.product_id=p.id AND v.status='ACTIVE')<2)::int AS products_with_fewer_than_two_active_variants,
      (SELECT count(*) FROM products p WHERE p.status='ACTIVE' AND (p.attributes->'specifications' IS NULL OR p.attributes->'specifications'='{}'::jsonb))::int AS missing_specifications,
      (SELECT count(*) FROM product_variants v LEFT JOIN inventories i ON i.variant_id=v.id WHERE v.price IS NULL OR v.price::numeric<=0 OR i.variant_id IS NULL)::int AS variants_missing_price_or_inventory,
      (SELECT count(*) FROM (SELECT sku FROM product_variants GROUP BY sku HAVING count(*)>1) d)::int AS duplicate_skus,
      (SELECT count(*) FROM (SELECT slug FROM products GROUP BY slug HAVING count(*)>1) d)::int AS duplicate_slugs,
      (SELECT count(*) FROM order_items oi WHERE oi.product_name IS NULL OR btrim(oi.product_name)='' OR oi.sku IS NULL OR btrim(oi.sku)='' OR oi.image_url IS NULL OR oi.unit_price<=0 OR oi.quantity<=0 OR oi.line_total<>oi.unit_price*oi.quantity)::int AS invalid_order_item_snapshots,
      (SELECT count(*) FROM orders o WHERE o.total_amount<>o.subtotal+o.shipping_fee-o.discount_amount)::int AS invalid_order_totals,
      (SELECT count(*) FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE u.id IS NULL)::int AS orders_with_invalid_user,
      (SELECT count(*) FROM order_items i LEFT JOIN orders o ON o.id=i.order_id LEFT JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id WHERE o.id IS NULL OR p.id IS NULL OR v.id IS NULL)::int AS order_items_with_invalid_foreign_keys,
      (SELECT count(*) FROM product_images i LEFT JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id WHERE p.id IS NULL OR (i.variant_id IS NOT NULL AND v.id IS NULL))::int AS images_with_invalid_foreign_keys,
      (SELECT count(*) FROM inventories WHERE on_hand<reserved OR on_hand<0 OR reserved<0)::int AS invalid_inventory_balances,
      (SELECT count(*) FROM inventory_reservations r LEFT JOIN inventories i ON i.variant_id=r.variant_id WHERE r.status='ACTIVE' AND (i.variant_id IS NULL OR i.reserved<r.quantity))::int AS active_reservation_stock_mismatch`,
  );
  const counts = metrics.rows[0] as Record<string, number>;
  const checks = violations.rows[0] as Record<string, number>;
  const targets = { categories: 60, brands: 50, active_brands: 50, products: 5000, variants: 10000, images: 15000, customers: 100, orders: 2000, order_items: 5000, addresses: 20, order_status_history: 20, inventory_movements: 20, inventory_reservations: 20 };
  const belowTarget = Object.fromEntries(Object.entries(targets).filter(([key, minimum]) => counts[key]! < minimum).map(([key, minimum]) => [key, { actual: counts[key], minimum }]));
  const report = { database: database.pathname.slice(1), counts, targets, belowTarget, violations: checks };
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(checks).some((count) => count > 0) || Object.keys(belowTarget).length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Data-quality check failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
