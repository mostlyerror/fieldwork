"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps a scrollable region and signals scrollability: a thin always-visible
 * scrollbar plus top/bottom gradient fades that appear only when there's more
 * content in that direction (macOS hides overlay scrollbars, so the box read as
 * static). The fade assumes a white background — pass bg-white on the content.
 */
export function ScrollFade({
  children,
  className = "",
  fadeColor = "white",
}: {
  children: React.ReactNode;
  className?: string;
  fadeColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(true);
  const [bottom, setBottom] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setTop(el.scrollTop <= 1);
    setBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const grad = (dir: "to bottom" | "to top") =>
    `linear-gradient(${dir}, ${fadeColor}, rgba(255,255,255,0))`;

  return (
    <div className="relative h-full min-h-0">
      <div ref={ref} onScroll={update} className={`scroll-thin h-full overflow-y-auto ${className}`}>
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-6 transition-opacity duration-200"
        style={{ background: grad("to bottom"), opacity: top ? 0 : 1 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 transition-opacity duration-200"
        style={{ background: grad("to top"), opacity: bottom ? 0 : 1 }}
      />
    </div>
  );
}
