import { useEffect, useRef, useState } from "react";
import { apiGet } from "../api/apiClient";

function applySeo(page) {
  document
    .querySelectorAll(
      'head [data-seo]:not([name="google-site-verification"]), head meta[name="description"], head meta[name="robots"], head link[rel="canonical"], head meta[property^="og:"], head meta[name^="twitter:"]',
    )
    .forEach((node) => node.remove());
  document.title = page.title;
  const add = (tag, attrs, text) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    node.dataset.seo = "";
    if (text) node.textContent = text;
    document.head.append(node);
  };
  add("meta", { name: "description", content: page.description });
  add("meta", { name: "robots", content: page.robots });
  if (page.canonical) add("link", { rel: "canonical", href: page.canonical });
  for (const [key, value] of Object.entries({
    title: page.title,
    description: page.description,
    type: page.type,
    url: page.canonical,
    image: page.image,
    site_name: "Technest",
  })) {
    if (value) add("meta", { property: `og:${key}`, content: value });
  }
  for (const [key, value] of Object.entries({
    card: "summary_large_image",
    title: page.title,
    description: page.description,
    image: page.image,
  })) {
    if (value) add("meta", { name: `twitter:${key}`, content: value });
  }
  add(
    "script",
    { type: "application/ld+json" },
    JSON.stringify({ "@context": "https://schema.org", "@graph": page.schemas }),
  );
}

export function useSeo(route) {
  const previous = useRef(route);
  const navigated = useRef(false);
  const [initial] = useState(() => {
    if (typeof document === "undefined") return null;
    try {
      return JSON.parse(document.getElementById("technest-seo-state")?.textContent || "null");
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const fallback = {
      title: "Technest",
      description: "Công nghệ và phụ kiện tại Technest.",
      robots: "noindex, follow",
      type: "website",
      schemas: [],
    };
    if (previous.current !== route) {
      navigated.current = true;
      applySeo(fallback);
    }
    previous.current = route;
    const schedule = (page) => {
      const boundary = page.expiresAt
        ? new Date(page.expiresAt).getTime() - Date.now() + 100
        : Infinity;
      const poll = /^\/products\/[^/]+/.test(route) ? 30000 : Infinity;
      const delay = Math.min(boundary, poll);
      if (Number.isFinite(delay))
        timer = setTimeout(
          () => {
            // Expired offers must disappear even if the refresh request fails.
            if (boundary <= delay)
              applySeo({ ...fallback, title: page.title, description: page.description });
            void refresh();
          },
          Math.max(1000, delay),
        );
    };
    const refresh = async () => {
      try {
        let page = await apiGet(`/seo/page?path=${encodeURIComponent(route)}&metadata=1`, {
          signal: controller.signal,
        });
        for (let i = 0; page.redirect && i < 3; i++)
          page = await apiGet(`/seo/page?path=${encodeURIComponent(page.redirect)}&metadata=1`, {
            signal: controller.signal,
          });
        if (controller.signal.aborted) return;
        applySeo(page);
        schedule(page);
      } catch {
        if (!controller.signal.aborted) applySeo(fallback);
      }
    };
    if (
      !navigated.current &&
      initial?.requestPath === route &&
      (!initial.expiresAt || new Date(initial.expiresAt).getTime() > Date.now())
    ) {
      applySeo(initial);
      schedule(initial);
    } else void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [route, initial]);
}
