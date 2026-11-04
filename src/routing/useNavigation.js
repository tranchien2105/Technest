import { useCallback, useEffect, useRef, useState } from "react";
import { guardedRoute, shouldHandleLink } from "./navigation";

const currentUrl = () => location.pathname + location.search + location.hash;

export function useNavigation(authenticated, onVisit) {
  const [route, setRoute] = useState(() =>
    guardedRoute(currentUrl(), authenticated, location.origin),
  );
  const routeRef = useRef(route);
  const historyIndexRef = useRef(
    typeof history !== "undefined" && Number.isInteger(history.state?.__technestIndex)
      ? history.state.__technestIndex
      : 0,
  );
  const skipPopToRef = useRef(null);
  const navigate = useCallback(
    (value, allowAuthenticatedDestination = false, { replace = false } = {}) => {
      const destination = guardedRoute(
        value,
        authenticated,
        location.origin,
        allowAuthenticatedDestination,
      );
      const current = new URL(currentUrl(), location.origin);
      const next = new URL(destination, location.origin);
      if (currentUrl() !== destination) {
        const guard = new CustomEvent("technest:before-navigate", {
          detail: { from: currentUrl(), to: destination },
          cancelable: true,
        });
        window.dispatchEvent(guard);
        if (guard.defaultPrevented) return;
        const currentIndex = Number.isInteger(history.state?.__technestIndex)
          ? history.state.__technestIndex
          : historyIndexRef.current;
        history.replaceState({ ...history.state, __technestIndex: currentIndex, __technestScrollY: window.scrollY }, "", currentUrl());
        historyIndexRef.current = replace ? currentIndex : currentIndex + 1;
        if (replace) history.replaceState({ ...history.state, __technestIndex: currentIndex }, "", destination);
        else history.pushState({ __technestIndex: historyIndexRef.current, __technestScrollY: 0 }, "", destination);
      }
      routeRef.current = destination;
      setRoute(destination);
      onVisit?.(destination);
      if (!next.hash && current.pathname !== next.pathname) window.scrollTo(0, 0);
    },
    [authenticated, onVisit],
  );

  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const destination = guardedRoute(currentUrl(), authenticated, location.origin);
    if (destination !== currentUrl()) history.replaceState({}, "", destination);
    if (!Number.isInteger(history.state?.__technestIndex)) {
      history.replaceState({ ...history.state, __technestIndex: historyIndexRef.current, __technestScrollY: window.scrollY }, "", currentUrl());
    } else historyIndexRef.current = history.state.__technestIndex;
    let scrollFrame = 0;
    let scrollSaveTimer = 0;
    const saveScroll = () => {
      window.clearTimeout(scrollSaveTimer);
      scrollSaveTimer = window.setTimeout(() => {
        history.replaceState(
          { ...history.state, __technestScrollY: window.scrollY },
          "",
          currentUrl(),
        );
      }, 100);
    };
    const onPop = () => {
      const next = guardedRoute(currentUrl(), authenticated, location.origin);
      if (next !== currentUrl()) history.replaceState({}, "", next);
      const nextIndex = history.state?.__technestIndex;
      if (skipPopToRef.current !== null && nextIndex === skipPopToRef.current) {
        skipPopToRef.current = null;
        historyIndexRef.current = nextIndex;
        return;
      }
      const guard = new CustomEvent("technest:before-navigate", {
        detail: { from: routeRef.current, to: next },
        cancelable: true,
      });
      window.dispatchEvent(guard);
      if (guard.defaultPrevented) {
        if (Number.isInteger(nextIndex) && nextIndex !== historyIndexRef.current) {
          skipPopToRef.current = historyIndexRef.current;
          history.go(historyIndexRef.current - nextIndex);
        } else {
          history.pushState({ ...history.state, __technestIndex: historyIndexRef.current, __technestScrollY: window.scrollY }, "", routeRef.current);
        }
        return;
      }
      if (Number.isInteger(nextIndex)) historyIndexRef.current = nextIndex;
      routeRef.current = next;
      setRoute(next);
      onVisit?.(next);
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const url = new URL(next, location.origin);
        if (url.hash) {
          try {
            document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
          } catch {
            window.scrollTo(0, history.state?.__technestScrollY || 0);
          }
        } else window.scrollTo(0, history.state?.__technestScrollY || 0);
      });
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
    const onHashChange = () => {
      const next = currentUrl();
      const nextUrl = new URL(next, location.origin);
      const current = new URL(routeRef.current, location.origin);
      if (nextUrl.pathname !== current.pathname || nextUrl.search !== current.search) return;
      routeRef.current = next;
      setRoute(next);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("scroll", saveScroll, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      history.scrollRestoration = previousRestoration;
      cancelAnimationFrame(scrollFrame);
      window.clearTimeout(scrollSaveTimer);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("scroll", saveScroll);
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
