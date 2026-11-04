import { useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken, restoreSession } from "../api/authClient";
import { notificationsApi } from "../api/notificationsClient";
import { NotificationsContext } from "./notificationsContext";
import { resolveApiOrigin } from "../api/apiOrigin";

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
const API_ORIGIN = resolveApiOrigin(API_BASE);
const SOCKET_SCRIPT = `${API_ORIGIN}/socket.io/socket.io.js`;
let scriptPromise;

function loadSocketClient() {
  if (typeof window === "undefined") return Promise.reject(new Error("Socket is unavailable"));
  if (window.io) return Promise.resolve(window.io);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SOCKET_SCRIPT}"]`);
      const script = existing || document.createElement("script");
      script.src = SOCKET_SCRIPT;
      script.async = true;
      script.onload = () => window.io ? resolve(window.io) : reject(new Error("Socket client did not load"));
      script.onerror = () => { script.remove(); scriptPromise = undefined; reject(new Error("Socket client did not load")); };
      if (!existing) document.head.append(script);
    });
  }
  return scriptPromise;
}

export function NotificationsProvider({ user, children }) {
  const userId = user?.id ? String(user.id) : null;
  const [countState, setCountState] = useState({ userId: null, count: 0 });
  const [revision, setRevision] = useState(0);
  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await notificationsApi.unreadCount();
      setCountState({ userId, count: Number.isFinite(result?.unreadCount) ? result.unreadCount : 0 });
    } catch {
      // Keep the last server-confirmed count while the API is temporarily unavailable.
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    let socket;
    let recovering = false;
    if (!userId) return undefined;
    const initialFetch = window.setTimeout(() => { void refreshUnreadCount(); }, 0);
    loadSocketClient().then((io) => {
      if (!active) return;
      socket = io(API_ORIGIN, {
        withCredentials: true,
        auth: (callback) => callback({ token: getAccessToken() || "" }),
      });
      const refresh = () => {
        setRevision((value) => value + 1);
        void refreshUnreadCount();
      };
      socket.on("connect", refresh);
      socket.on("notification:new", () => {
        setRevision((value) => value + 1);
        void refreshUnreadCount();
      });
      socket.on("notification:unread-count", (payload) => {
        if (Number.isFinite(payload?.unreadCount)) setCountState({ userId, count: payload.unreadCount });
      });
      socket.on("connect_error", async (error) => {
        if (recovering || !String(error?.message).includes("UNAUTHENTICATED")) return;
        recovering = true;
        await restoreSession();
        if (active && getAccessToken()) socket?.connect();
        recovering = false;
      });
      socket.on("disconnect", async (reason) => {
        if (reason !== "io server disconnect" || recovering) return;
        recovering = true;
        await restoreSession();
        if (active && getAccessToken()) socket?.connect();
        recovering = false;
      });
    }).catch(() => {});
    return () => {
      active = false;
      socket?.removeAllListeners();
      socket?.disconnect();
      window.clearTimeout(initialFetch);
    };
  }, [userId, refreshUnreadCount]);

  const unreadCount = userId && countState.userId === userId ? countState.count : 0;
  const value = useMemo(() => ({ unreadCount, refreshUnreadCount, revision }), [unreadCount, refreshUnreadCount, revision]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
