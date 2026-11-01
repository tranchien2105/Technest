const API_BASE = `${import.meta.env?.VITE_API_BASE_URL || "http://localhost:3000/api/v1"}/auth`;

let accessToken = null;
let csrfToken = null;
let refreshPromise = null;

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

export function hasRefreshSession() {
  return Boolean(readCookie("technest_csrf"));
}

async function send(path, { method = "POST", body, csrf = false, authenticated = false } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (authenticated && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (csrf) {
    const token = csrfToken || readCookie("technest_csrf");
    if (token) headers["X-CSRF-Token"] = token;
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    const error = new Error("Unable to connect to Technest.");
    error.code = "NETWORK_ERROR";
    throw error;
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.error?.message || "Unable to connect to Technest.");
    error.code = result?.error?.code || "NETWORK_ERROR";
    error.details = result?.error?.details;
    throw error;
  }
  const data = result?.data;
  if (data?.accessToken) accessToken = data.accessToken;
  if (data?.csrfToken) csrfToken = data.csrfToken;
  return data;
}

export function register(input) {
  return send("/register", { body: input });
}

export function login(input) {
  return send("/login", { body: input });
}

export function getMe() {
  return send("/me", { method: "GET", authenticated: true });
}

export function restoreSession() {
  if (!csrfToken) csrfToken = readCookie("technest_csrf");
  if (!csrfToken) return Promise.resolve(null);
  if (!refreshPromise) {
    const refresh = async () => {
      // Serialize refresh-token rotation across tabs so a second tab does not
      // race the first one with the same one-time refresh cookie.
      const rotate = async () => {
        csrfToken = readCookie("technest_csrf") || csrfToken;
        try {
          await send("/refresh", { csrf: true });
        } catch (error) {
          if (error.code !== "REFRESH_ALREADY_USED") throw error;
          await new Promise((resolve) => setTimeout(resolve, 150));
          csrfToken = readCookie("technest_csrf") || csrfToken;
          await send("/refresh", { csrf: true });
        }
        return { user: await getMe() };
      };
      if (typeof navigator !== "undefined" && navigator.locks?.request) {
        return navigator.locks.request("technest-auth-refresh", rotate);
      }
      return rotate();
    };
    refreshPromise = refresh()
      .catch(() => {
        clearAuth();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function logout() {
  try {
    await send("/logout", { csrf: true });
  } finally {
    clearAuth();
  }
}

export function clearAuth() {
  accessToken = null;
  csrfToken = null;
}

export function getAccessToken() {
  return accessToken;
}
