import { useEffect, useState } from "react";
import { apiGet } from "../api/apiClient";

export function useBanners(position, { enabled = true } = {}) {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!enabled) {
      return () => controller.abort();
    }
    apiGet(`/banners?position=${encodeURIComponent(position)}`, { signal: controller.signal })
      .then((items) => {
        if (active) setState({ items: Array.isArray(items) ? items : [], loading: false, error: "" });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError") {
          setState({ items: [], loading: false, error: "Không thể tải banner lúc này." });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [position, enabled]);

  return state;
}
