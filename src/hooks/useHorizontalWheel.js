import { useEffect } from "react";

export function useHorizontalWheel(railRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const rail = railRef.current;
    if (!rail) return undefined;

    const handleWheel = (event) => {
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 1) return;
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;
      const atStart = rail.scrollLeft <= 1;
      const atEnd = rail.scrollLeft >= maxScroll - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1;
      event.preventDefault();
      rail.scrollLeft = Math.max(0, Math.min(maxScroll, rail.scrollLeft + delta * multiplier));
    };

    rail.addEventListener("wheel", handleWheel, { passive: false });
    return () => rail.removeEventListener("wheel", handleWheel);
  }, [railRef, enabled]);
}
