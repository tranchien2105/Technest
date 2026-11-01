export const formatPrice = (value) => {
  const formatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });
  if (typeof value === "bigint") return formatter.format(value);
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const amount = BigInt(value);
    return amount <= BigInt(Number.MAX_SAFE_INTEGER)
      ? formatter.format(Number(amount))
      : formatter.format(amount);
  }
  return formatter.format(value);
};
