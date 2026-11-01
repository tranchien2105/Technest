import { useCallback, useEffect, useState } from "react";
import { guardedRoute, shouldHandleLink } from "./navigation";

const currentUrl = () => location.pathname + location.search + location.hash;

export function useNavigation(authenticated, onVisit) {
  const [route, setRoute] = useState(() =>
    guardedRoute(currentUrl(), authenticated, location.origin),
  );
  const navigate = useCallback(
    (value, allowAuthenticatedDestination = false) => {
      const destination = guardedRoute(
        value,
        authenticated,
        location.origin,
        allowAuthenticatedDestination,
      );
      if (currentUrl() !== destination) history.pushState({}, "", destination);
      setRoute(destination);
      onVisit?.(destination);
      if (!new URL(destination, location.origin).hash) window.scrollTo(0, 0);
    },
    [authenticated, onVisit],
  );

  useEffect(() => {
    const destination = guardedRoute(currentUrl(), authenticated, location.origin);
    if (destination !== currentUrl()) history.replaceState({}, "", destination);
    const onPop = () => {
      const next = guardedRoute(currentUrl(), authenticated, location.origin);
      if (next !== currentUrl()) history.replaceState({}, "", next);
      setRoute(next);
      onVisit?.(next);
    };
    const onClick = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!shouldHandleLink(event, anchor, location.origin)) return;
      // Let the browser handle same-document fragments (scroll, focus and history).
      if (anchor.hash && anchor.pathname === location.pathname && anchor.search === location.search)
        return;
      event.preventDefault();
      navigate(anchor.pathname + anchor.search + anchor.hash);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
      document.removeEventListener("click", onClick);
    };
  }, [authenticated, navigate, onVisit]);

  useEffect(() => {
    const hash = new URL(route, location.origin).hash;
    if (!hash) return;
    const frame = requestAnimationFrame(() => {
      try {
        document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
      } catch {
        /* Ignore malformed fragment identifiers. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [route]);
  return { route, navigate, path: new URL(route, location.origin).pathname };
}
