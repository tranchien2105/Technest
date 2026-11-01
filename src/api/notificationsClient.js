import { privateRequest } from "./privateClient";

export const notificationsApi = {
  list({ page = 1, limit = 20, type, unread } = {}, options = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) query.set("type", type);
    if (unread !== undefined) query.set("unread", String(unread));
    return privateRequest(`/notifications?${query}`, options);
  },
  unreadCount(options = {}) {
    return privateRequest("/notifications/unread-count", options);
  },
  markRead(id) {
    return privateRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
  },
  markAllRead() {
    return privateRequest("/notifications/read-all", { method: "PATCH" });
  },
};
