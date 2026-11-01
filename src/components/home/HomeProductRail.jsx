import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function HomeProductRail({ children, className = "", language, label }) {
  const railRef = useRef(null);
  const dragRef = useRef(null);
  const draggedRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);

  const pauseAfterInteraction = () => {
    pausedRef.current = true;
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 6000);
  };

  const scroll = (direction) => {
    pauseAfterInteraction();
    railRef.current?.scrollBy({
      left: direction * railRef.current.clientWidth * 0.82,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail || pausedRef.current || dragRef.current || rail.scrollWidth <= rail.clientWidth + 4)
        return;
      const end = rail.scrollWidth - rail.clientWidth;
      if (rail.scrollLeft >= end - 12) rail.scrollTo({ left: 0, behavior: "smooth" });
      else rail.scrollBy({ left: rail.clientWidth * 0.78, behavior: "smooth" });
    }, 4600);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const startDrag = (event) => {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      event.target.closest("button, a, input, select")
    )
      return;
    pauseAfterInteraction();
    dragRef.current = {
      x: event.clientX,
      scrollLeft: railRef.current.scrollLeft,
      moved: false,
    };
    railRef.current.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) > 5) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      railRef.current.scrollLeft = drag.scrollLeft - distance;
      railRef.current.classList.add("is-dragging");
    }
  };

  const stopDrag = () => {
    if (dragRef.current?.moved) draggedRef.current = true;
    dragRef.current = null;
    railRef.current?.classList.remove("is-dragging");
  };

  return (
    <>
      <div className="home-carousel-controls" aria-label={label}>
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label={language === "vi" ? "Cuộn sang trái" : "Scroll left"}
        >
          <ChevronLeft size={19} />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label={language === "vi" ? "Cuộn sang phải" : "Scroll right"}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <div
        className={`home-rail-track ${className}`.trim()}
        ref={railRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClickCapture={(event) => {
          if (!draggedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          draggedRef.current = false;
        }}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          if (!dragRef.current) pausedRef.current = false;
        }}
        onFocusCapture={() => {
          pausedRef.current = true;
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) pausedRef.current = false;
        }}
      >
        {children}
      </div>
    </>
  );
}
