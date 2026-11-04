import { apiGet } from "./apiClient";
import { privateRequest } from "./privateClient";

export const flashSalesApi = {
  list: (options = {}) => apiGet("/flash-sales", options),
  detail: (id, options = {}) => apiGet(`/flash-sales/${encodeURIComponent(id)}`, options),
  adminList: (status, options = {}) => privateRequest(`/admin/flash-sales${status ? `?status=${encodeURIComponent(status)}` : ""}`, options),
  adminCreate: (body) => privateRequest("/admin/flash-sales", { method: "POST", body }),
  adminUpdate: (id, body) => privateRequest(`/admin/flash-sales/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  adminCancel: (id) => privateRequest(`/admin/flash-sales/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
