export const ORDER_STEPS = ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export function normalizeOrderStatus(status) {
  if (status === "PENDING") return "PLACED";
  if (status === "CANCELLED") return status;
  return ORDER_STEPS.includes(status) ? status : "PLACED";
}

export function orderTimeline(status) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "CANCELLED") {
    return ORDER_STEPS.map((step, index) => ({
      step,
      state: index === 0 ? "complete" : "cancelled",
    }));
  }
  const statusIndex = ORDER_STEPS.indexOf(normalized);
  const activeIndex = normalized === "DELIVERED" ? -1 : Math.min(statusIndex + 1, 4);
  return ORDER_STEPS.map((step, index) => ({
    step,
    state: index <= statusIndex ? "complete" : index === activeIndex ? "active" : "upcoming",
  }));
}
