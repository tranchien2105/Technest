# Vietnam delivery addresses

Vendored, compact snapshots of [Vietnamese Provinces Database](https://github.com/thanglequoc/vietnamese-provinces-database), copyright Thang Le Quoc, distributed under the included MIT [LICENSE](./LICENSE).

Checked on **2026-11-07** against the [National Statistics Office administrative directory](https://danhmuchanhchinh.nso.gov.vn/NghiDinh.aspx).

| File | Upstream version | Coverage |
| --- | --- | --- |
| `current.json` | [v5.2.0](https://github.com/thanglequoc/vietnamese-provinces-database/tree/v5.2.0) | 34 provinces/cities and 3,321 wards/communes/special administrative regions, including changes effective 2026-09-20 under 388/NQ-UBTVQH16 and the 2026 provincial city changes |
| `legacy.json` | [v2.4.1](https://github.com/thanglequoc/vietnamese-provinces-database/tree/v2.4.1) | Last pre-July-2025 hierarchy: 63 provinces/cities, 696 districts and 10,035 wards/communes |

The current hierarchy has two levels; districts belong only to the legacy address option. Five legacy island districts have no subordinate wards, so checkout does not require a ward for those districts. Saved address names outside either snapshot remain visible rather than being silently converted to a different delivery location.

Only administrative codes and Vietnamese names are retained. Each snapshot is loaded on demand from the application bundle; checkout never depends on a third-party address API at runtime.

Regenerate with `node scripts/update-vietnam-addresses.mjs`. To update to a future release, change the pinned version and expected counts in that script, check the effective date against the official directory, and update this document. For offline regeneration, pass a directory containing `technest-vn-current.json`, `technest-vn-legacy.json` (upstream full JSON files), and `technest-vn-license.txt`.
