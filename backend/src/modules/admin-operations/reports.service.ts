import { sql } from "drizzle-orm";
import { AppError } from "../../shared/errors.js";
import { type Database, dateRange } from "./common.js";
export async function getReports(db: Database, from?: string, to?: string) {
  const { start, end } = dateRange(from, to);
  if (end <= start || end.getTime() - start.getTime() > 367 * 86400000)
    throw new AppError(400, "INVALID_REPORT_RANGE", "Khoảng báo cáo tối đa 366 ngày.");
  const summary =
    await db.execute(sql`select count(*)::int as orders, count(*) filter(where status='CANCELLED')::int as cancelled,
    count(*) filter(where status='DELIVERED' and payment_status='PAID')::int as delivered,
    coalesce(sum(total_amount) filter(where status='DELIVERED' and payment_status='PAID'),0)::text as revenue
    from orders where updated_at >= ${start} and updated_at < ${end}`);
  const refunds = await db.execute(
    sql`select coalesce(sum(refund_amount),0)::text as amount from after_sales_requests where status='RESOLVED' and resolved_at >= ${start} and resolved_at < ${end}`,
  );
  const daily = await db.execute(
    sql`select to_char(updated_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') as date, count(*)::int as orders, sum(total_amount)::text as revenue from orders where status='DELIVERED' and payment_status='PAID' and updated_at >= ${start} and updated_at < ${end} group by 1 order by 1`,
  );
  const top =
    await db.execute(sql`select i.product_id::text as id, max(i.product_name) as name, sum(i.quantity)::int as quantity,
    sum(i.line_total * (o.subtotal-o.discount_amount) / nullif(o.subtotal,0))::text as revenue
    from order_items i join orders o on o.id=i.order_id where o.status='DELIVERED' and o.payment_status='PAID' and o.updated_at >= ${start} and o.updated_at < ${end} group by i.product_id order by sum(i.quantity) desc limit 20`);
  const slow = await db.execute(
    sql`select p.id::text as id, p.name, v.sku, (i.on_hand-i.reserved)::int as available from inventories i join product_variants v on v.id=i.variant_id join products p on p.id=v.product_id where p.status='ACTIVE' and v.status='ACTIVE' and i.on_hand > i.reserved and not exists(select 1 from order_items oi join orders o on o.id=oi.order_id where oi.variant_id=v.id and o.status='DELIVERED' and o.updated_at >= ${start} and o.updated_at < ${end}) order by available desc limit 50`,
  );
  const metrics = summary.rows[0] as { revenue: string };
  const refundAmount = String(refunds.rows[0]?.amount || "0");
  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
    metrics: {
      ...metrics,
      refunds: refundAmount,
      netRevenue: (BigInt(metrics.revenue) - BigInt(refundAmount)).toString(),
    },
    daily: daily.rows,
    topProducts: top.rows,
    slowStock: slow.rows,
    policy:
      "Doanh thu COD đã giao/đã thu, theo ngày hoàn tất (UTC+7). Tiền hoàn là số tiền đã ghi nhận xử lý; không phải lệnh hoàn qua ngân hàng. Chưa tính giá vốn.",
  };
}
