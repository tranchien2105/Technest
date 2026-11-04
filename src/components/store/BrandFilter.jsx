import { useEffect, useState } from "react";
import { apiGet } from "../../api/apiClient";

export default function BrandFilter({ brands, value, onChange, language }) {
  const vi = language === "vi";
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ key: "", items: [], selected: null, error: false });
  const key = `${query}:${value}`;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      Promise.all([
        apiGet(`/brands?limit=50&q=${encodeURIComponent(query)}`, { signal: controller.signal }),
        value && value !== "all" ? apiGet(`/brands?ids=${encodeURIComponent(value)}&limit=1`, { signal: controller.signal }) : Promise.resolve([]),
      ]).then(([items, selected]) => setResult({ key, items, selected: selected[0], error: false })).catch((error) => {
        if (error.name !== "AbortError") setResult({ key, items: [], selected: null, error: true });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, value, key]);
  const options = result.key === key && !result.error ? result.items : brands;
  const selected = options.find((item) => item.id === value) || result.selected;
  return <label>{vi ? "Thương hiệu" : "Brand"}
    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={vi ? "Tìm thương hiệu…" : "Search brands…"} aria-label={vi ? "Tìm thương hiệu" : "Search brands"}/>
    <select value={value || "all"} onChange={(event) => onChange(event.target.value)} aria-label={vi ? "Chọn thương hiệu" : "Choose brand"}>
      <option value="all">{vi ? "Tất cả thương hiệu" : "All brands"}</option>
      {value && value !== "all" && !options.some((item) => item.id === value) && <option value={value}>{selected?.name || value}</option>}
      {options.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
    </select>
    {result.key === key && result.error && <small role="status">{vi ? "Chưa tải được thương hiệu." : "Brands are unavailable."}</small>}
  </label>;
}
