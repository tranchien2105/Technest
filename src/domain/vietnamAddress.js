const snapshots = {
  current: () => import("../data/vietnam/current.json"),
  legacy: () => import("../data/vietnam/legacy.json"),
};
const pending = new Map();

export function loadVietnamAreas(mode) {
  if (!Object.hasOwn(snapshots, mode)) return Promise.reject(new Error("Unknown address format"));
  if (!pending.has(mode)) {
    const request = snapshots[mode]().then((module) => module.default).catch((error) => {
      pending.delete(mode);
      throw error;
    });
    pending.set(mode, request);
  }
  return pending.get(mode);
}

function areaName(value) {
  return String(value || "").normalize("NFC").trim().toLocaleLowerCase("vi")
    .replace(/^(?:thành phố|tỉnh|quận|huyện|thị xã|phường|xã|thị trấn|đặc khu|tp\.?)\s+/u, "")
    .replace(/\s+/g, " ").trim();
}

export function findVietnamArea(areas, value) {
  if (!value) return undefined;
  return areas.find((area) => area.name === value || area.fullName === value)
    || areas.find((area) => areaName(area.name) === areaName(value));
}

export function initialVietnamAddress(address) {
  return {
    mode: address?.district ? "legacy" : "current",
    city: address?.city || "",
    district: address?.district || "",
    ward: address?.ward || "",
  };
}

export function changeVietnamAddress(selection, field, value) {
  if (field === "mode") return { mode: value, city: "", district: "", ward: "" };
  if (field === "city") return { ...selection, city: value, district: "", ward: "" };
  if (field === "district") return { ...selection, district: value, ward: "" };
  return { ...selection, ward: value };
}
