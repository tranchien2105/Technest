import { createContext, useContext } from "react";

export const NotificationsContext = createContext({ unreadCount: 0, refreshUnreadCount: async () => {}, revision: 0 });

export function useNotifications() {
  return useContext(NotificationsContext);
}
