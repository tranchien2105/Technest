import { useEffect, useState } from "react";

export function useAdminPageSize(name) {
  const key = `technest.admin.pageSize.${name}`;
  const [limit, setLimit] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return [50, 100, 200, 500].includes(saved) ? saved : 50;
    } catch { return 50; }
  });
  useEffect(() => { try { localStorage.setItem(key, String(limit)); } catch { /* Storage may be unavailable. */ } }, [key, limit]);
  return [limit, setLimit];
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}
