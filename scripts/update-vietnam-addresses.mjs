import { readFile, writeFile, mkdir } from "node:fs/promises";

// Pin both snapshots so updating addresses is deliberate and reproducible.
const repository = "https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database";
const snapshots = [
  { mode: "current", version: "v5.2.0", provinces: 34, districts: 0, wards: 3321 },
  { mode: "legacy", version: "v2.4.1", provinces: 63, districts: 696, wards: 10035 },
];
const inputDirectory = process.argv[2];
const destination = new URL("../src/data/vietnam/", import.meta.url);
const area = (entry) => ({ code: entry.Code, name: entry.FullName });
await mkdir(destination, { recursive: true });

for (const snapshot of snapshots) {
  const source = `${repository}/${snapshot.version}/json/full_json_generated_data_vn_units.json`;
  const response = inputDirectory ? null : await fetch(source);
  if (response && !response.ok) throw new Error(`Address download failed: ${response.status}`);
  const original = inputDirectory
    ? JSON.parse(await readFile(`${inputDirectory}/technest-vn-${snapshot.mode}.json`, "utf8"))
    : await response.json();
  const data = original.map((province) => ({
    ...area(province),
    // Keep short province values compatible with existing order/account records.
    name: province.Name,
    fullName: province.FullName,
    ...(snapshot.mode === "current"
      ? { wards: province.Wards.map(area) }
      : { districts: province.District.map((district) => ({ ...area(district), wards: (district.Ward || []).map(area) })) }),
  }));
  const districts = data.flatMap((province) => province.districts || []);
  const wards = data.flatMap((province) => province.wards || province.districts.flatMap((district) => district.wards));
  if (data.length !== snapshot.provinces || districts.length !== snapshot.districts || wards.length !== snapshot.wards) {
    throw new Error(`Unexpected administrative unit counts for ${snapshot.mode}`);
  }
  const licenseResponse = inputDirectory ? null : await fetch(`${repository}/${snapshot.version}/LICENSE`);
  if (licenseResponse && !licenseResponse.ok) throw new Error(`License download failed: ${licenseResponse.status}`);
  const license = inputDirectory
    ? await readFile(`${inputDirectory}/technest-vn-license.txt`, "utf8")
    : await licenseResponse.text();
  await writeFile(new URL(`${snapshot.mode}.json`, destination), `${JSON.stringify(data)}\n`);
  await writeFile(new URL("LICENSE", destination), license);
  console.log(`${snapshot.mode}: ${data.length} provinces, ${districts.length} districts, ${wards.length} wards (${snapshot.version})`);
}
