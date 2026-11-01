import { getAccessToken, restoreSession } from "./authClient.js";
const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

export function parseOrderEvent(message) {
  const lines = message.replaceAll("\r\n", "\n").split("\n");
  if (!lines.some((line) => line === "event: order:status-updated")) return null;
  try {
    const event = JSON.parse(lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n"));
    if (!event || !/^[1-9]\d{0,18}$/.test(String(event.orderId)) || typeof event.orderNumber !== "string" || event.orderNumber.length > 100 || !["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(event.status) || !Number.isFinite(Date.parse(event.updatedAt))) return null;
    return { orderId: String(event.orderId), orderNumber: event.orderNumber, status: event.status, updatedAt: event.updatedAt };
  } catch { return null; }
}

// One authenticated stream per subscriber; reconnects without putting tokens into URLs.
export function watchOrders(admin, onUpdate) {
  const controller = new AbortController();
  let timer;
  const pause = (delay) => new Promise((resolve) => {
    const finish = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", finish); resolve(); };
    timer = setTimeout(finish, delay);
    controller.signal.addEventListener("abort", finish, { once: true });
  });
  const listen = async () => {
    let delay = 1000;
    while (!controller.signal.aborted) {
      let reader;
      try {
        if (!getAccessToken()) await restoreSession();
        if (controller.signal.aborted || !getAccessToken()) return;
        const response = await fetch(`${API_BASE}${admin ? "/admin" : ""}/orders/events`, { headers: { Authorization: `Bearer ${getAccessToken()}` }, signal: controller.signal });
        if (response.status === 401) await restoreSession();
        else if (response.status === 403) return;
        else if (response.ok && response.body) {
          reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          delay = 1000;
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll("\r\n", "\n");
            let boundary;
            while ((boundary = buffer.indexOf("\n\n")) !== -1) {
              const event = parseOrderEvent(buffer.slice(0, boundary));
              buffer = buffer.slice(boundary + 2);
              if (event && !controller.signal.aborted) onUpdate(event);
            }
            if (buffer.length > 65536) throw new Error("Event stream exceeded buffer limit");
          }
        }
      } catch { /* Reconnect after network interruption; cleanup aborts the loop. */ }
      finally { if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
      if (!controller.signal.aborted) { await pause(delay); delay = Math.min(delay * 2, 15000); }
    }
  };
  void listen();
  return () => { controller.abort(); clearTimeout(timer); };
}
