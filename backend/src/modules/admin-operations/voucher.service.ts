import { and, count, eq, isNull, sql } from "drizzle-orm";
import { vouchers, voucherRedemptions } from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";
import type { Transaction } from "./common.js";
export async function evaluateVoucher(
  tx: Transaction,
  code: string | undefined,
  subtotal: bigint,
  userId: number,
  lock = false,
) {
  if (!code) return { discount: 0n, voucher: null };
  const query = tx
    .select()
    .from(vouchers)
    .where(eq(vouchers.code, code.trim().toUpperCase()))
    .limit(1);
  const [voucher] = await (lock ? query.for("update") : query);
  const now = new Date();
  if (
    !voucher ||
    !voucher.active ||
    voucher.startsAt > now ||
    voucher.endsAt <= now ||
    voucher.usedCount >= voucher.usageLimit
  )
    throw new AppError(
      409,
      "VOUCHER_UNAVAILABLE",
      "Mã giảm giá không tồn tại, hết hạn hoặc đã hết lượt sử dụng.",
    );
  if (subtotal < voucher.minSubtotal)
    throw new AppError(
      409,
      "VOUCHER_MINIMUM",
      `Đơn tối thiểu ${voucher.minSubtotal.toLocaleString("vi-VN")} đ để dùng mã này.`,
    );
  const [usage] = await tx
    .select({ n: count() })
    .from(voucherRedemptions)
    .where(
      and(
        eq(voucherRedemptions.voucherId, voucher.id),
        eq(voucherRedemptions.userId, userId),
        isNull(voucherRedemptions.releasedAt),
      ),
    );
  if ((usage?.n || 0) >= voucher.perUserLimit)
    throw new AppError(409, "VOUCHER_USER_LIMIT", "Bạn đã dùng hết lượt cho mã này.");
  let discount = voucher.type === "PERCENT" ? (subtotal * voucher.value) / 100n : voucher.value;
  if (voucher.maxDiscount !== null && discount > voucher.maxDiscount)
    discount = voucher.maxDiscount;
  if (discount > subtotal) discount = subtotal;
  return { discount, voucher };
}
export async function redeemVoucher(
  tx: Transaction,
  voucherId: bigint,
  userId: number,
  orderId: bigint,
  discount: bigint,
) {
  await tx.insert(voucherRedemptions).values({ voucherId, userId, orderId, discount });
  await tx
    .update(vouchers)
    .set({ usedCount: sql`${vouchers.usedCount} + 1` })
    .where(eq(vouchers.id, voucherId));
}
export async function releaseVoucher(tx: Transaction, orderId: bigint) {
  const [released] = await tx
    .update(voucherRedemptions)
    .set({ releasedAt: new Date() })
    .where(and(eq(voucherRedemptions.orderId, orderId), isNull(voucherRedemptions.releasedAt)))
    .returning();
  if (released)
    await tx
      .update(vouchers)
      .set({ usedCount: sql`greatest(${vouchers.usedCount} - 1, 0)` })
      .where(eq(vouchers.id, released.voucherId));
}
