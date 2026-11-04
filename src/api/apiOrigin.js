// API deployments can use either an absolute host or a same-origin path.
export function resolveApiOrigin(apiBase, pageOrigin = globalThis.location?.origin || "http://localhost:3000") {
  return new URL(apiBase, pageOrigin).origin;
}
