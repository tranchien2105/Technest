const internalKeys = new Set(["dataset", "seedKey", "seedOrdinal", "categoryLabel"]);

const labels = {
  specifications: "Thông số kỹ thuật", specs: "Thông số kỹ thuật", warranty: "Bảo hành",
  color: "Màu sắc", finish: "Màu / bề mặt", option: "Thứ tự phiên bản", note: "Ghi chú",
  features: "Tính năng", connectivity: "Kết nối", connection: "Kết nối", battery: "Pin",
  weight: "Trọng lượng", dimensions: "Kích thước", material: "Chất liệu", compatibility: "Tương thích",
};

export function attributeLabel(key) { return labels[key] || key; }
export function isKnownAttribute(key) { return Object.hasOwn(labels, key); }

export function newAttributeField(key = "", value = "") {
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value === "object" ? "object" : typeof value;
  return {
    id: crypto.randomUUID(), key, kind, fixedKey: isKnownAttribute(key),
    value: kind === "number" ? String(value) : value,
    multiline: typeof value === "string" && (value.length > 90 || key === "note"),
    children: kind === "object" ? objectFields(value) : kind === "array" ? value.map((item) => newAttributeField("", item)) : [],
  };
}

function objectFields(value) {
  return Object.entries(value || {}).map(([key, item]) => newAttributeField(key, item));
}

export function attributesToFields(value = {}) {
  return objectFields(Object.fromEntries(Object.entries(value).filter(([key]) => !internalKeys.has(key))));
}

function fieldValue(field) {
  if (field.kind === "object") return fieldsToObject(field.children);
  if (field.kind === "array") return field.children.map(fieldValue);
  if (field.kind === "null") return null;
  if (field.kind === "number") {
    if (String(field.value).trim() === "" || !Number.isFinite(Number(field.value))) throw new Error(`Vui lòng nhập giá trị số hợp lệ cho ${attributeLabel(field.key)}.`);
    return Number(field.value);
  }
  return field.value;
}

function fieldsToObject(fields) {
  const seen = new Set();
  return Object.fromEntries(fields.map((field) => {
    const key = field.key.trim();
    if (!key) throw new Error("Vui lòng nhập tên cho từng thông số hoặc xóa dòng chưa dùng.");
    if (seen.has(key)) throw new Error(`Tên thông số “${attributeLabel(key)}” bị trùng trong cùng một nhóm.`);
    seen.add(key);
    return [key, fieldValue(field)];
  }));
}

export function fieldsToAttributes(fields, original = {}) {
  const metadata = Object.fromEntries(Object.entries(original).filter(([key]) => internalKeys.has(key)));
  for (const field of fields) {
    if (internalKeys.has(field.key.trim())) throw new Error("Tên thông số này được hệ thống quản lý. Vui lòng dùng tên khác.");
  }
  return { ...metadata, ...fieldsToObject(fields) };
}
