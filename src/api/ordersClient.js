import { privateRequest } from "./privateClient";

export function orderView(order) {
  const id = String(order.id);
  const orderNumber = order.orderNumber || order.order_number || `TN-${id.padStart(8, "0")}`;
  return { ...order, orderNumber, total: order.totalAmount, shipping: order.shippingFee,
    customer: { name: order.shippingAddress.fullName, address: order.shippingAddress.address, city: order.shippingAddress.city, phone: order.shippingAddress.phone },
    items: (order.items || []).map((item) => ({ ...item, price: item.unitPrice })),
  };
}
export const ordersApi = {
  preview: (body) => privateRequest("/checkout/preview", { method: "POST", body }),
  create: (body, key) => privateRequest("/orders", { method: "POST", body, headers: { "Idempotency-Key": key } }).then(orderView),
  list: (page = 1, filter = {}) => privateRequest(`/orders?${new URLSearchParams({ page, limit: 20, ...filter })}`),
  detail: (id) => privateRequest(`/orders/${encodeURIComponent(id)}`).then(orderView),
  cancel: (id) => privateRequest(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }).then(orderView),
  adminList: (query, options = {}) => privateRequest(`/admin/orders?${query}`, options),
  adminDetail: (id) => privateRequest(`/admin/orders/${encodeURIComponent(id)}`),
  transition: (id, status, note) => privateRequest(`/admin/orders/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status, note } }),
};
