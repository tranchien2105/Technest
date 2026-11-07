import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { changeVietnamAddress, findVietnamArea, initialVietnamAddress, loadVietnamAreas } from "../src/domain/vietnamAddress.js";

const readSnapshot = async (mode) => JSON.parse(await readFile(new URL(`../src/data/vietnam/${mode}.json`, import.meta.url), "utf8"));

test("current address snapshot covers every province and 3,321 distinct communes with 2026 city changes", async () => {
  const areas = await readSnapshot("current");
  assert.equal(areas.length, 34);
  assert.equal(new Set(areas.map((area) => area.code)).size, 34);
  const wards = areas.flatMap((area) => area.wards);
  assert.equal(wards.length, 3321);
  assert.equal(new Set(wards.map((area) => area.code)).size, 3321);
  for (const province of areas) {
    assert.ok(province.wards.length > 0, province.name);
    assert.match(province.code, /^\d{2}$/);
    for (const ward of province.wards) {
      assert.match(ward.code, /^\d{5}$/);
      assert.match(ward.name, /^(Phường|Xã|Đặc khu) /iu);
    }
  }
  for (const name of ["Bắc Ninh", "Quảng Ninh", "Đồng Nai"]) {
    assert.equal(findVietnamArea(areas, name).fullName, `Thành phố ${name}`);
  }
  assert.ok(findVietnamArea(findVietnamArea(areas, "Hồ Chí Minh").wards, "Đặc khu Côn Đảo"));
});

test("legacy address snapshot includes all districts, communes and the island districts without wards", async () => {
  const areas = await readSnapshot("legacy");
  const districts = areas.flatMap((area) => area.districts);
  const wards = districts.flatMap((area) => area.wards);
  assert.equal(areas.length, 63);
  assert.equal(districts.length, 696);
  assert.equal(new Set(districts.map((area) => area.code)).size, 696);
  assert.equal(wards.length, 10035);
  assert.equal(new Set(wards.map((area) => area.code)).size, 10035);
  assert.equal(districts.filter((area) => area.wards.length === 0).length, 5);
  const hcm = findVietnamArea(areas, "TP. Hồ Chí Minh");
  assert.equal(findVietnamArea(hcm.districts, "Bình Thạnh").name, "Quận Bình Thạnh");
  const district = findVietnamArea(hcm.districts, "Quận 1");
  assert.equal(findVietnamArea(district.wards, "Bến Nghé").name, "Phường Bến Nghé");
});

test("changing province, district or address format clears dependent values", () => {
  const saved = { mode: "legacy", city: "Hồ Chí Minh", district: "Quận 1", ward: "Phường Bến Nghé" };
  assert.deepEqual(changeVietnamAddress(saved, "city", "Hà Nội"), { mode: "legacy", city: "Hà Nội", district: "", ward: "" });
  assert.deepEqual(changeVietnamAddress(saved, "district", "Quận 3"), { ...saved, district: "Quận 3", ward: "" });
  assert.deepEqual(changeVietnamAddress(saved, "mode", "current"), { mode: "current", city: "", district: "", ward: "" });
  assert.equal(saved.ward, "Phường Bến Nghé");
});

test("saved addresses retain historical names without guessing a new location", async () => {
  const historical = initialVietnamAddress({ city: "Hồ Chí Minh", district: "Quận 3", ward: "Phường 2" });
  assert.equal(historical.mode, "legacy");
  assert.equal(historical.ward, "Phường 2");
  assert.equal(initialVietnamAddress({ city: "Hồ Chí Minh", ward: "Phường Sài Gòn" }).mode, "current");
  const areas = await readSnapshot("current");
  assert.equal(findVietnamArea(areas, "Quảng Nam"), undefined);
  assert.equal(findVietnamArea(areas, ""), undefined);
  await assert.rejects(loadVietnamAreas("missing"), /Unknown address format/);
});
