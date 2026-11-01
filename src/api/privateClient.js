import { getAccessToken, restoreSession } from "./authClient";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

export class PrivateApiError extends Error {
  constructor(message, code = "API_ERROR", status = 0) {
    super(message);
    this.name = "PrivateApiError";
    this.code = code;
    this.status = status;
  }
}

export async function privateRequest(path, { method = "GET", body, signal, headers = {}, retry = true, download = false } = {}) {
  let token = getAccessToken();
  if (!token) {
    await restoreSession();
    token = getAccessToken();
  }
  if (!token) throw new PrivateApiError("Vui lòng đăng nhập lại để tiếp tục.", "UNAUTHENTICATED", 401);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      signal,
      headers: {
        ...headers,
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new PrivateApiError("Không thể kết nối máy chủ Technest.", "NETWORK_ERROR");
  }
  if (response.status === 401 && retry) {
    await restoreSession();
    return privateRequest(path, { method, body, signal, headers, download, retry: false });
  }
  if (download && response.ok) return response.blob();
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    throw new PrivateApiError(payload?.error?.message || "Yêu cầu không thành công.", payload?.error?.code, response.status);
  }
  return payload.data;
}
