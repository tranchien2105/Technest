import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { opsRequest } from "./operationsApi";
import { adminApi } from "../api/adminClient";
import { useDebouncedValue } from "./useAdminList";

// Fetch only the visible search window, including when the catalog has thousands of brands.
export default function AdminReferencePicker({ kind, value = "", onChange, label, placeholder = "Tìm và chọn…", required = false, disabled = false, initialLabel = "", source = "products", excludeId }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({ id: value, name: initialLabel });
  const [result, setResult] = useState({ items: [], hasMore: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const debounced = useDebouncedValue(query.trim(), 250);
  const selectedLabel = selected.id === value ? selected.name : "";
  useEffect(() => { input.current?.setCustomValidity(required && !value ? "Chọn một mục trong danh sách kết quả." : ""); }, [required, value]);
  useEffect(() => {
    if (!value || selectedLabel || source !== "products") return;
    const controller = new AbortController();
    opsRequest(`products/references?${new URLSearchParams({ type: kind, id: value, limit: "1" })}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted && data.items[0]) setSelected(data.items[0]); })
      .catch(() => {});
    return () => controller.abort();
  }, [kind, value, selectedLabel, source]);
  useEffect(() => {
    if (!open || query.trim() !== debounced) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      const params = new URLSearchParams({ q: debounced, limit: "30", page: "1" });
      const request = source === "products"
        ? opsRequest(`products/references?${params}&type=${kind}`, { signal: controller.signal })
        : adminApi.categories(params.toString(), { signal: controller.signal }).then((data) => ({ items: data.items, hasMore: data.pagination.total > data.items.length }));
      request.then((data) => { if (!controller.signal.aborted) { setResult({ ...data, items: data.items.filter((item) => String(item.id) !== String(excludeId)) }); setActive(0); } })
        .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, debounced, kind, source, query, excludeId]);
  const choose = (item) => { setSelected(item); onChange(String(item.id)); setOpen(false); setQuery(""); input.current?.focus(); };
  const busy = loading || (open && query.trim() !== debounced);
  return <div className="admin-reference-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className="admin-reference-input">
      <Search size={16} aria-hidden="true"/>
      <input ref={input} role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${id}-results`} aria-autocomplete="list" aria-activedescendant={open && result.items[active] ? `${id}-${active}` : undefined}
        autoComplete="off" required={required} disabled={disabled} placeholder={placeholder} value={open ? query : selectedLabel || (value ? initialLabel || `#${value}` : "")}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onClick={() => { if (!open) { setOpen(true); setQuery(""); } }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); if (value) onChange(""); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive((index) => Math.max(0, Math.min(result.items.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
          if (event.key === "Enter" && open) { event.preventDefault(); if (!busy && result.items[active]) choose(result.items[active]); }
        }}/>
      {value && !disabled ? <button type="button" aria-label={`Bỏ chọn ${label.toLowerCase()}`} onClick={() => { onChange(""); setSelected({ id: "", name: "" }); setQuery(""); }}><X size={15}/></button> : <ChevronDown size={15} aria-hidden="true"/>}
    </div>
    {open && <div className="admin-reference-popover">
      {busy ? <p role="status">Đang tìm…</p> : error ? <p role="alert">{error}</p> : <>
        <div id={`${id}-results`} role="listbox" aria-label={label}>
          {result.items.map((item, index) => <button type="button" role="option" aria-selected={String(item.id) === String(value)} id={`${id}-${index}`} className={active === index ? "is-active" : ""} key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>{item.name}</button>)}
        </div>
        {!result.items.length && <p>Không tìm thấy kết quả.</p>}
        {result.hasMore && <small>Có thêm kết quả. Nhập tên cụ thể để tìm nhanh hơn.</small>}
      </>}
    </div>}
  </div>;
}
