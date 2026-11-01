import { useEffect, useState } from "react";
import { apiGet } from "../api/apiClient";

export function useHomepageConfig() {
  const [state, setState] = useState({ config: null, loading: true, error: null });
  useEffect(() => {
    const controller = new AbortController();
    apiGet("/homepage/config", { signal: controller.signal })
      .then((config) => { if (!controller.signal.aborted) setState({ config, loading: false, error: null }); })
      .catch((error) => { if (!controller.signal.aborted) setState({ config: null, loading: false, error }); });
    return () => controller.abort();
  }, []);
  return state;
}
