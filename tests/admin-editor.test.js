import test from "node:test";
import assert from "node:assert/strict";
import { attributesToFields, fieldsToAttributes, newAttributeField } from "../src/admin/catalogEditor.js";

test("structured editing round trips nested specifications and original value types", () => {
  const original = { specifications: { RAM: "16 GB", ports: ["USB-C", "HDMI"], details: { weight: 1.2 } }, warranty: "24 tháng", color: "001", option: 2, wireless: false, optional: null, alternatives: [{ name: "Black" }] };
  assert.deepEqual(fieldsToAttributes(attributesToFields(original), original), original);
});

test("editing specifications preserves hidden system metadata and untouched siblings", () => {
  const original = { dataset: "development-illustration", seedKey: "seed-key", seedOrdinal: 3, categoryLabel: "Bàn phím", specifications: { connection: "USB", layout: "75%" }, warranty: "12 tháng" };
  const fields = attributesToFields(original);
  assert.equal(fields.some((field) => field.key === "dataset" || field.key === "seedKey"), false);
  fields.find((field) => field.key === "specifications").children.find((field) => field.key === "connection").value = "Bluetooth";
  const result = fieldsToAttributes(fields, original);
  assert.deepEqual(result, { ...original, specifications: { connection: "Bluetooth", layout: "75%" } });
});

test("duplicate or blank names and invalid numeric values cannot silently overwrite data", () => {
  assert.throws(() => fieldsToAttributes([newAttributeField()]), /nhập tên/);
  assert.throws(() => fieldsToAttributes([newAttributeField("RAM", "8 GB"), newAttributeField(" RAM ", "16 GB")]), /bị trùng/);
  const [number] = attributesToFields({ option: 0 });
  assert.equal(fieldsToAttributes([number]).option, 0);
  number.value = "";
  assert.throws(() => fieldsToAttributes([number]), /giá trị số hợp lệ/);
  assert.throws(() => fieldsToAttributes([newAttributeField("seedKey", "replacement")]), /hệ thống quản lý/);
});

test("new custom fields keep stable row identifiers and remain editable", () => {
  const field = newAttributeField();
  const id = field.id;
  field.key = "color";
  assert.equal(field.fixedKey, false);
  field.key = "color temperature";
  field.value = "6500 K";
  assert.equal(field.id, id);
  assert.deepEqual(fieldsToAttributes([field]), { "color temperature": "6500 K" });
});

test("explicit removal deletes only that attribute, retaining other values and metadata", () => {
  const original = { warranty: "12 tháng", color: "Đen", dataset: "catalog" };
  const fields = attributesToFields(original).filter((field) => field.key !== "warranty");
  assert.deepEqual(fieldsToAttributes(fields, original), { color: "Đen", dataset: "catalog" });
});
