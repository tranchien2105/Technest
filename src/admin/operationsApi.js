import { privateRequest } from "../api/privateClient";
export const opsRequest = (path, options) => privateRequest(`/admin/${path}`, options);
export async function uploadImages(files, scope = "products") {
  const body = new FormData();
  for (const file of files) body.append("images", file);
  return opsRequest(scope === "banners" ? "banners/uploads" : "uploads", { method: "POST", body });
}
export async function downloadExcel(kind) {
  const blob = await opsRequest(`exports/${kind}`, { download: true });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `technest-${kind}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function canAdmin(user, scope, write = false) {
  return (
    user?.role === "ADMIN" ||
    (user?.role === "STAFF" &&
      (user.permissions?.includes(`${scope}:write`) ||
        (!write && user.permissions?.includes(`${scope}:read`))))
  );
}
