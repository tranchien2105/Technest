import { privateRequest } from "./privateClient";

export const accountApi = {
  profile: (options) => privateRequest("/account/profile", options),
  updateProfile: (body) => privateRequest("/account/profile", { method: "PATCH", body }),
  addresses: (options) => privateRequest("/account/addresses", options),
  createAddress: (body) => privateRequest("/account/addresses", { method: "POST", body }),
  updateAddress: (id, body) => privateRequest(`/account/addresses/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  setDefaultAddress: (id) => privateRequest(`/account/addresses/${encodeURIComponent(id)}/default`, { method: "PATCH" }),
  deleteAddress: (id) => privateRequest(`/account/addresses/${encodeURIComponent(id)}`, { method: "DELETE" }),
  changePassword: (body) => privateRequest("/account/change-password", { method: "POST", body }),
  sessions: (options) => privateRequest("/account/sessions", options),
  revokeSession: (id) => privateRequest(`/account/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
